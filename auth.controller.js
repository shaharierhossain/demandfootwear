/**
 * Auth controller — demonstrates the MINIMUM real-world requirements
 * the front-end demo intentionally skips:
 *   - passwords are hashed with bcrypt before being stored, never in plaintext
 *   - a signed JWT (or session cookie) is issued on success, not a fake token
 *   - admin accounts are just Users with role=ADMIN, checked server-side
 */
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../services/prisma");

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const COOKIE_NAME = process.env.ADMIN_SESSION_COOKIE_NAME || "df_session";

function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

// Sets the session as a signed, HTTP-only cookie so front-end JavaScript
// never touches the raw token (this is what protects it from theft via XSS).
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // requires HTTPS in production
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(422).json({ error: "Name, email and a password of at least 8 characters are required." });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({ data: { name, email, phone, passwordHash, role: "CUSTOMER" } });
    const token = issueToken(user);
    setSessionCookie(res, token);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Compare against a stored hash even if user is null, to reduce timing-based user enumeration.
    const validHash = user ? user.passwordHash : "$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsalt";
    const ok = await bcrypt.compare(password || "", validHash);
    if (!user || !ok) return res.status(401).json({ error: "Invalid email or password." });

    const token = issueToken(user);
    setSessionCookie(res, token);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
}

// Lets the front-end ask "am I logged in, and as whom?" without ever
// reading the cookie itself (it's HTTP-only and invisible to JS).
async function me(req, res) {
  res.json({ user: req.user });
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
}

module.exports = { register, login, logout, me };
