require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { eq, and, isNull, gt } = require("drizzle-orm");
const { db, client } = require("./db");
const { users, refreshTokens } = require("./db/schema");
const { generateAccessToken, generateRefreshToken, hashToken } = require("./tokens");
const { verifyAccessToken } = require("./middleware/authMiddleware");

const app = express();
const PORT = Number(process.env.PORT) || 4001;
app.use(express.json({ limit: "20kb" }));

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveRefreshToken(user, token) {
  const payload = jwt.decode(token);
  if (!payload || !payload.exp) throw new Error("Refresh token expiry is missing");
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(payload.exp * 1000),
  });
}

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Identity Service is running successfully", service: "identity-service" });
});

// POST /register
app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (![name, email, phone, password].every((v) => typeof v === "string" && v.trim())) {
      return res.status(400).json({ success: false, message: "Name, email, phone and password are required" });
    }
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    if (cleanName.length > 255 || cleanPhone.length > 255 || !validEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid name, email and phone" });
    }
    if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ success: false, message: "Password must be at least 10 characters and no more than 72 bytes" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db.insert(users).values({
      name: cleanName, email: cleanEmail, phone: cleanPhone, passwordHash,
    }).returning({ id: users.id, name: users.name, email: users.email, phone: users.phone });
    return res.status(201).json({ success: true, message: "User registered successfully", user: inserted[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }
    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to register user" });
  }
});

// POST /login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "A valid email and password are required" });
    }
    const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const tokenUser = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);
    await saveRefreshToken(tokenUser, refreshToken);
    return res.status(200).json({
      success: true, message: "Login successful", accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log in" });
  }
});

// GET /profile (requires Authorization: Bearer <accessToken>)
app.get("/profile", verifyAccessToken, async (req, res) => {
  try {
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users).where(eq(users.id, req.user.userId)).limit(1);
    if (!rows[0]) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("Profile error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load profile" });
  }
});

// POST /refresh-token; old refresh token is revoked and replaced.
app.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token is required" });
    }
    let payload;
    try { payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET); }
    catch (error) { return res.status(401).json({ success: false, message: "Invalid or expired refresh token" }); }
    if (payload.tokenType !== "refresh" || !payload.userId) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
    const oldHash = hashToken(refreshToken);
    const replacement = await db.transaction(async (tx) => {
      const revoked = await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, oldHash), eq(refreshTokens.userId, payload.userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
        .returning({ id: refreshTokens.id });
      if (revoked.length === 0) return null;
      const tokenUser = { id: payload.userId };
      const newRefreshToken = generateRefreshToken(tokenUser);
      const newAccessToken = generateAccessToken(tokenUser);
      const newPayload = jwt.decode(newRefreshToken);
      await tx.insert(refreshTokens).values({
        userId: payload.userId, tokenHash: hashToken(newRefreshToken), expiresAt: new Date(newPayload.exp * 1000),
      });
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });
    if (!replacement) return res.status(401).json({ success: false, message: "Refresh token has been revoked, expired or already used" });
    return res.status(200).json({ success: true, message: "Tokens refreshed successfully", ...replacement });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to refresh token" });
  }
});

// POST /logout; revokes the presented refresh token.
app.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token is required" });
    }
    const updated = await db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, hashToken(refreshToken)), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    if (updated.length === 0) return res.status(200).json({ success: true, message: "Session is already logged out or token is invalid" });
    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log out" });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  console.error("Unhandled API error:", err.message);
  return res.status(500).json({ success: false, message: "Internal server error" });
});

const server = app.listen(PORT, () => console.log(`Identity Service running on port ${PORT}`));

async function shutdown() {
  server.close(async () => {
    await client.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
