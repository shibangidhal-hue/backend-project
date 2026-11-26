const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
   process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, tokenType: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
