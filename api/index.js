// Vercel serverless function entry point
// Handles all /api/* routes

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
    try {
        // Debug: Check what files are available
        const rootDir = path.join(__dirname, '..');
        const files = fs.readdirSync(rootDir);
        const serverExists = fs.existsSync(path.join(rootDir, 'server.js'));

        // Try to require server
        if (serverExists) {
            const app = require('../server.js');
            return app(req, res);
        } else {
            return res.status(500).json({
                error: 'server.js not found',
                rootDir,
                files: files.slice(0, 20), // First 20 files
                cwd: process.cwd()
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Failed to load or execute server',
            message: error.message,
            stack: error.stack
        });
    }
};
