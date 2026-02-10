/**
 * Listings routes
 *
 * CRUD operations for user listings
 *
 * Usage in server.js:
 *   const listingsRoutes = require('./routes/listings');
 *   app.use(listingsRoutes({ pool, logger, authenticateToken, safeQuery, sanitizeInput }));
 */

const express = require('express');

function createListingsRoutes({
  pool,
  logger,
  authenticateToken,
  safeQuery,
  sanitizeInput,
  ensureSchemaReady,
}) {
  const router = express.Router();

  /**
   * POST /api/listings
   * Create a new listing
   */
  router.post('/api/listings', authenticateToken, async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body required' });
    }

    const {
      title,
      brand,
      category,
      description,
      condition,
      rrp,
      price,
      keywords,
      sources,
      platform,
      images,
      status,
      location,
    } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 500) {
      return res.status(400).json({ error: 'Title must be 500 characters or less' });
    }

    // Validate description
    if (description && typeof description === 'string' && description.length > 10000) {
      return res.status(400).json({ error: 'Description must be 10000 characters or less' });
    }

    // Validate arrays
    if (keywords && !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array' });
    }
    if (images && !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images must be an array' });
    }

    await ensureSchemaReady();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const userId = req.user.id;

      const cleanStatus = sanitizeInput(status) || 'draft';
      const cleanLocation = sanitizeInput(location);

      const listingResult = await client.query(
        `INSERT INTO listings (user_id, title, brand, category, description, condition, rrp, price, keywords, sources, platform, status, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          userId,
          sanitizeInput(title),
          sanitizeInput(brand),
          sanitizeInput(category),
          sanitizeInput(description),
          sanitizeInput(condition),
          sanitizeInput(rrp),
          sanitizeInput(price),
          keywords || [],
          JSON.stringify(sources || []),
          sanitizeInput(platform),
          cleanStatus,
          cleanLocation,
        ]
      );

      const listing = listingResult.rows[0];

      // Insert images
      if (images && images.length > 0) {
        const preparedImages = images
          .map((img, idx) => {
            const imageData = [img.data, img.url, img.image_url, img.thumbnail_url]
              .map((d) => (typeof d === 'string' ? d.trim() : ''))
              .find((d) => d);

            if (!imageData || !imageData.startsWith('http')) {
              logger.warn('Skipping non-URL image', { listingId: listing.id, imageIndex: idx });
              return null;
            }

            return { listingId: listing.id, imageData, order: idx, isBlurry: !!img.isBlurry };
          })
          .filter(Boolean);

        if (preparedImages.length > 0) {
          const imageValues = preparedImages
            .map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`)
            .join(', ');

          const imageParams = preparedImages.flatMap((img) => [
            img.listingId,
            img.imageData,
            img.order,
            img.isBlurry,
          ]);

          await client.query(
            `INSERT INTO images (listing_id, image_data, image_order, is_blurry) VALUES ${imageValues}`,
            imageParams
          );
        }
      }

      await client.query('COMMIT');

      // Track usage
      try {
        await safeQuery(
          `INSERT INTO usage_tracking (user_id, period_start, period_end, listings_created, ai_generations)
           VALUES ($1, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', 1, 0)
           ON CONFLICT (user_id, period_start) 
           DO UPDATE SET listings_created = usage_tracking.listings_created + 1`,
          [userId]
        );
      } catch (usageError) {
        logger.warn('Usage tracking failed:', { error: usageError.message, userId });
      }

      logger.info('Listing created:', { listingId: listing.id, userId });
      res.json({ listing });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Create listing error:', { error: error.message });
      res.status(500).json({ error: 'Failed to create listing' });
    } finally {
      client.release();
    }
  });

  /**
   * GET /api/listings
   * Get all listings for user with pagination
   */
  router.get('/api/listings', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const result = await safeQuery(
        `SELECT l.*,
                (SELECT json_agg(json_build_object('id', i.id, 
                  'image_url', CASE WHEN length(i.image_data) < 1000 THEN i.image_data ELSE NULL END, 
                  'thumbnail_url', CASE WHEN length(i.image_data) < 1000 THEN i.image_data ELSE NULL END, 
                  'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                 FROM images i WHERE i.listing_id = l.id) as images
         FROM listings l
         WHERE l.user_id = $1
         ORDER BY l.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const countResult = await safeQuery(
        'SELECT COUNT(*) as total FROM listings WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0].total);

      res.json({
        listings: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get listings error:', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  /**
   * GET /api/listings/:id
   * Get single listing
   */
  router.get('/api/listings/:id', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const listingId = parseInt(req.params.id);

      const result = await safeQuery(
        `SELECT l.*,
                (SELECT json_agg(json_build_object('id', i.id, 'image_url', i.image_data, 
                  'thumbnail_url', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                 FROM images i WHERE i.listing_id = l.id) as images
         FROM listings l
         WHERE l.id = $1 AND l.user_id = $2`,
        [listingId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      res.json({ listing: result.rows[0] });
    } catch (error) {
      logger.error('Get listing error:', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  });

  /**
   * GET /api/listings/:id/images
   * Get images for a listing
   */
  router.get('/api/listings/:id/images', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const listingId = parseInt(req.params.id);

      // Verify ownership
      const listing = await safeQuery('SELECT id FROM listings WHERE id = $1 AND user_id = $2', [
        listingId,
        userId,
      ]);

      if (listing.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const result = await safeQuery(
        `SELECT id, image_data as image_url, image_data as thumbnail_url, is_blurry as "isBlurry", image_order as "order"
         FROM images WHERE listing_id = $1 ORDER BY image_order`,
        [listingId]
      );

      res.json({ images: result.rows });
    } catch (error) {
      logger.error('Get listing images error:', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  });

  /**
   * PUT /api/listings/:id
   * Update a listing
   */
  router.put('/api/listings/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.id;
      const listingId = parseInt(req.params.id);

      // Verify ownership
      const existing = await client.query(
        'SELECT id FROM listings WHERE id = $1 AND user_id = $2',
        [listingId, userId]
      );

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Listing not found' });
      }

      const {
        title,
        brand,
        category,
        description,
        condition,
        rrp,
        price,
        keywords,
        sources,
        platform,
        status,
        location,
        images,
      } = req.body;

      await client.query(
        `UPDATE listings SET
           title = COALESCE($1, title),
           brand = COALESCE($2, brand),
           category = COALESCE($3, category),
           description = COALESCE($4, description),
           condition = COALESCE($5, condition),
           rrp = COALESCE($6, rrp),
           price = COALESCE($7, price),
           keywords = COALESCE($8, keywords),
           sources = COALESCE($9, sources),
           platform = COALESCE($10, platform),
           status = COALESCE($11, status),
           location = COALESCE($12, location),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $13`,
        [
          sanitizeInput(title),
          sanitizeInput(brand),
          sanitizeInput(category),
          sanitizeInput(description),
          sanitizeInput(condition),
          sanitizeInput(rrp),
          sanitizeInput(price),
          keywords,
          sources ? JSON.stringify(sources) : null,
          sanitizeInput(platform),
          sanitizeInput(status),
          sanitizeInput(location),
          listingId,
        ]
      );

      // Update images if provided
      if (images && Array.isArray(images)) {
        await client.query('DELETE FROM images WHERE listing_id = $1', [listingId]);

        const preparedImages = images
          .map((img, idx) => {
            const imageData = [img.data, img.url, img.image_url, img.thumbnail_url]
              .map((d) => (typeof d === 'string' ? d.trim() : ''))
              .find((d) => d);
            if (!imageData || !imageData.startsWith('http')) return null;
            return { listingId, imageData, order: idx, isBlurry: !!img.isBlurry };
          })
          .filter(Boolean);

        if (preparedImages.length > 0) {
          const imageValues = preparedImages
            .map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`)
            .join(', ');
          const imageParams = preparedImages.flatMap((img) => [
            img.listingId,
            img.imageData,
            img.order,
            img.isBlurry,
          ]);
          await client.query(
            `INSERT INTO images (listing_id, image_data, image_order, is_blurry) VALUES ${imageValues}`,
            imageParams
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated listing
      const result = await safeQuery(
        `SELECT l.*,
                (SELECT json_agg(json_build_object('id', i.id, 'image_url', i.image_data, 
                  'thumbnail_url', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                 FROM images i WHERE i.listing_id = l.id) as images
         FROM listings l WHERE l.id = $1`,
        [listingId]
      );

      logger.info('Listing updated:', { listingId, userId });
      res.json({ listing: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Update listing error:', { error: error.message });
      res.status(500).json({ error: 'Failed to update listing' });
    } finally {
      client.release();
    }
  });

  /**
   * DELETE /api/listings/:id
   * Delete a listing
   */
  router.delete('/api/listings/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.id;
      const listingId = parseInt(req.params.id);

      const existing = await client.query(
        'SELECT id FROM listings WHERE id = $1 AND user_id = $2',
        [listingId, userId]
      );

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Listing not found' });
      }

      // Delete images first (foreign key)
      await client.query('DELETE FROM images WHERE listing_id = $1', [listingId]);
      await client.query('DELETE FROM listings WHERE id = $1', [listingId]);

      await client.query('COMMIT');

      logger.info('Listing deleted:', { listingId, userId });
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Delete listing error:', { error: error.message });
      res.status(500).json({ error: 'Failed to delete listing' });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/listings/:id/mark-sold
   * Mark a listing as sold
   */
  router.post('/api/listings/:id/mark-sold', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const listingId = parseInt(req.params.id);

      const result = await safeQuery(
        `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [listingId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      logger.info('Listing marked as sold:', { listingId, userId });
      res.json({ listing: result.rows[0] });
    } catch (error) {
      logger.error('Mark sold error:', { error: error.message });
      res.status(500).json({ error: 'Failed to mark listing as sold' });
    }
  });

  return router;
}

module.exports = createListingsRoutes;
