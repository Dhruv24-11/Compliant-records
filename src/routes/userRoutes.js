import express from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole, hashPassword } from '../auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY id ASC
  `).all();

  res.json({ users });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const cleanRole = role.toLowerCase().trim();
  const allowedRoles = ['admin', 'reviewer', 'operator'];
  if (!allowedRoles.includes(cleanRole)) {
    return res.status(400).json({
      error: `Invalid role '${role}'. Allowed roles: ${allowedRoles.join(', ')}.`
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(cleanName, cleanEmail, passwordHash, cleanRole, now);

  const newUser = db.prepare(`
    SELECT id, name, email, role, created_at FROM users WHERE id = ?
  `).get(Number(result.lastInsertRowid));

  res.status(201).json({
    message: 'User created successfully.',
    user: newUser
  });
});

export default router;
