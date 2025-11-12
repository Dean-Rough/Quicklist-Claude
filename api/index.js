// Vercel serverless function entry point
// Handles all /api/* routes

const app = require('../server.js');

// Export as both default and named for Vercel compatibility
module.exports = app;
module.exports.default = app;
