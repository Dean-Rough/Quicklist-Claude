// Vercel serverless function entry point
// Handles all /api/* routes

// Load the Express app
const app = require('../server.js');

// Export handler for Vercel
module.exports = app;
