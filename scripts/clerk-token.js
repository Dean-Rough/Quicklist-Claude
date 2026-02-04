#!/usr/bin/env node
/**
 * Generates a Clerk testing token so automated tests can authenticate.
 *
 * Requires:
 *   CLERK_SECRET_KEY
 *   CLERK_PUBLISHABLE_KEY (or CLERK_FRONTEND_API)
 *
 * Optional:
 *   CLERK_FRONTEND_API        - overrides publishable key parsing
 *   CLERK_TEST_TOKEN_FILE     - write token to this file
 *   CLERK_TEST_DEBUG=true     - enable verbose logging from @clerk/testing
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { clerkSetup } = require('@clerk/testing/playwright');
const { parsePublishableKey } = require('@clerk/shared/keys');

const logError = (message, error) => {
  console.error(`[clerk:token] ${message}`);
  if (error) {
    console.error(error);
  }
  process.exit(1);
};

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  logError('CLERK_SECRET_KEY is required to generate a test token.');
}

const getFrontendApi = (publishableKey) => {
  if (!publishableKey) return null;
  try {
    const parsed = parsePublishableKey(publishableKey.replace(/\$$/, ''));
    return parsed?.frontendApi || null;
  } catch (error) {
    return null;
  }
};

const publishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  logError('Missing Clerk publishable key. Set CLERK_PUBLISHABLE_KEY in your .env file.');
}

const frontendApi = process.env.CLERK_FRONTEND_API || getFrontendApi(publishableKey);

if (!frontendApi) {
  logError(
    'Unable to determine Clerk frontend API. Provide CLERK_FRONTEND_API or a valid publishable key.'
  );
}

const tokenFile = process.env.CLERK_TEST_TOKEN_FILE;

const main = async () => {
  await clerkSetup({
    frontendApiUrl: frontendApi,
    publishableKey,
    secretKey,
    debug: process.env.CLERK_TEST_DEBUG === 'true',
  });

  const sessionToken = process.env.CLERK_TESTING_TOKEN;

  if (!sessionToken) {
    logError(
      'Clerk did not return a testing token. Check that testing tokens are enabled for your project.'
    );
  }

  if (tokenFile) {
    fs.writeFileSync(path.resolve(tokenFile), sessionToken, 'utf8');
  }

  process.stdout.write(sessionToken);
};

main().catch((error) => {
  logError(error.message || error, error);
});
