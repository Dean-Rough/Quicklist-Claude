// Vercel serverless function entry point
// Handles all /api/* routes

try {
    // Load the Express app
    const app = require('../server.js');

    // Wrap to add /api prefix back since Vercel strips it
    module.exports = (req, res) => {
        // Vercel strips /api from the path, so add it back
        if (!req.url.startsWith('/api')) {
            req.url = '/api' + req.url;
        }
        console.log('Request:', req.method, req.url);
        try {
            return app(req, res);
        } catch (error) {
            console.error('Handler error:', error);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    };
} catch (error) {
    console.error('Failed to load server.js:', error);
    module.exports = (req, res) => {
        res.status(500).json({
            error: 'Server failed to initialize',
            message: error.message,
            stack: error.stack
        });
    };
}
