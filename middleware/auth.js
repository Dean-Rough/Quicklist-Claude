/**
 * Authentication middleware
 *
 * Extracted from server.js - Clerk-based authentication
 */

const { clerkClient, getAuth } = require('@clerk/express');

/**
 * Create authentication middleware with dependencies
 *
 * @param {object} deps - { pool, logger, ensureSchemaReady }
 * @returns {function} Express middleware
 */
function createAuthMiddleware({ pool, logger, ensureSchemaReady }) {
  return async function authenticateToken(req, res, next) {
    try {
      // Test mode bypass
      if (process.env.ALLOW_TEST_AUTH === '1' && process.env.NODE_ENV !== 'production') {
        req.user = {
          id: 1,
          clerkId: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
        };
        return next();
      }

      await ensureSchemaReady();

      // Try to get auth from Clerk middleware first (cookie-based)
      let { userId } = getAuth(req);

      // If no userId from cookie, try to verify token from Authorization header
      if (!userId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);

          try {
            const verifiedToken = await clerkClient.verifyToken(token, {
              secretKey: process.env.CLERK_SECRET_KEY,
            });
            userId = verifiedToken.sub;
          } catch (tokenError) {
            logger.warn('Token verification failed:', {
              error: tokenError.message,
              requestId: req.id,
            });
          }
        }
      }

      if (!userId) {
        return res.status(401).json({ error: 'Access token required' });
      }

      // Get full user details from Clerk
      logger.info('Fetching user details from Clerk', { userId, requestId: req.id });
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress;
      const name =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.username;
      logger.info('Got user from Clerk', { userId, email, requestId: req.id });

      // Look up or create database user record
      let dbUser;
      try {
        dbUser = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [userId]);
        logger.info('Database user lookup result', {
          userId,
          found: dbUser.rows.length > 0,
          requestId: req.id,
        });
      } catch (dbError) {
        logger.error('Database user lookup failed', {
          error: dbError.message,
          userId,
          requestId: req.id,
        });
        throw dbError;
      }

      // Create user if doesn't exist
      if (dbUser.rows.length === 0) {
        logger.info('Creating new user in database', { clerkId: userId, email });
        try {
          const newUser = await pool.query(
            `INSERT INTO users (email, clerk_id, auth_provider, name)
             VALUES ($1, $2, 'clerk', $3)
             ON CONFLICT (email) DO UPDATE SET clerk_id = $2
             RETURNING id`,
            [email, userId, name]
          );
          dbUser = newUser;
          logger.info('User created successfully', {
            dbUserId: dbUser.rows[0].id,
            email,
            requestId: req.id,
          });
        } catch (createError) {
          logger.error('Failed to create user in database', {
            error: createError.message,
            email,
            userId,
            requestId: req.id,
          });
          throw createError;
        }
      }

      // Attach user info to request
      req.user = {
        id: dbUser.rows[0].id,
        clerkId: userId,
        email: email,
        name: name,
      };

      logger.info('User authenticated', {
        dbUserId: req.user.id,
        clerkId: userId,
        email,
        requestId: req.id,
      });

      return next();
    } catch (error) {
      logger.error('Clerk authentication error:', {
        error: error.message,
        stack: error.stack,
        requestId: req.id,
        hasAuthHeader: !!req.headers.authorization,
      });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { createAuthMiddleware };
