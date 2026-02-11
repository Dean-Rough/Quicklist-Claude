// Simple test endpoint to verify serverless function works
module.exports = (req, res) => {
  res.status(200).json({
    message: 'Serverless function is working',
    timestamp: new Date().toISOString(),
    env: {
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
      hasClerkPublishable: !!process.env.CLERK_PUBLISHABLE_KEY,
      clerkPublishableValue: process.env.CLERK_PUBLISHABLE_KEY ? 'set' : 'undefined',
    },
  });
};
