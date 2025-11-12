// Simple test endpoint to verify serverless function works
module.exports = (req, res) => {
    res.status(200).json({
        message: 'Serverless function is working',
        timestamp: new Date().toISOString(),
        env: {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            hasDatabase: !!process.env.DATABASE_URL,
            hasClerk: !!process.env.CLERK_SECRET_KEY
        }
    });
};
