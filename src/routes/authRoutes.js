import express from 'express';
import { getDb } from '../db.js';
import { comparePassword, generateToken, requireAuth } from '../auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = getDb();
  const stmt = db.prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?');
  const user = stmt.get(email.trim().toLowerCase());

  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(user);

  res.json({
    message: 'Authentication successful.',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
