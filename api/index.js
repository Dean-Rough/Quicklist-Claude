// Vercel serverless function entry point
// Handles all /api/* routes

let app;
try {
    app = require('../server.js');
    // Export as both default and named for Vercel compatibility
    module.exports = app;
    module.exports.default = app;
} catch (error) {
    // If server.js fails to load, export an error handler
    console.error('Failed to load server.js:', error);
    module.exports = (req, res) => {
        res.status(500).json({
            error: 'Server initialization failed',
            message: error.message,
            stack: error.stack
        });
    };
}
