const jwt = require("jsonwebtoken");

function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access token is required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ success: false, message: "Access token is required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired access token" });
  }
}

module.exports = { verifyAccessToken };
