// Debug endpoint to see what Vercel sends
module.exports = (req, res) => {
  res.status(200).json({
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    method: req.method,
    headers: req.headers,
    query: req.query,
  });
};
