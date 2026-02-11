// Vercel serverless function wrapper
// This file allows Vercel to run the Express app as a serverless function

const app = require('../server.js');

// Export as default for Vercel serverless
module.exports = app;
module.exports.default = app;
