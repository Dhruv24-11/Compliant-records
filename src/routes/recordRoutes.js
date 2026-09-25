import express from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole, comparePassword } from '../auth.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT r.id, r.title, r.content, r.status, r.created_by, r.created_at, r.updated_at,
           u.name as creator_name, u.email as creator_email
    FROM records r
    JOIN users u ON r.created_by = u.id
    ORDER BY r.id DESC
  `).all();

  res.json({ records });
});

router.get('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  if (isNaN(recordId)) {
    return res.status(400).json({ error: 'Invalid record ID.' });
  }

  const db = getDb();
  const record = db.prepare(`
    SELECT r.id, r.title, r.content, r.status, r.created_by, r.created_at, r.updated_at,
           u.name as creator_name, u.email as creator_email
    FROM records r
    JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `).get(recordId);

  if (!record) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const auditTrail = db.prepare(`
    SELECT id, record_id, user_id, user_email, action, field_changed, old_value, new_value, timestamp
    FROM audit_trail
    WHERE record_id = ?
    ORDER BY id ASC
  `).all(recordId);

  const signatures = db.prepare(`
    SELECT id, record_id, user_id, user_name, user_email, user_role, meaning, timestamp
    FROM signatures
    WHERE record_id = ?
    ORDER BY id ASC
  `).all(recordId);

  res.json({
    record,
    auditTrail,
    signatures
  });
});

router.post('/', requireAuth, requireRole('operator', 'admin'), (req, res) => {
  const { title, content } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Record title is required.' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Record content is required.' });
  }

  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  const now = new Date().toISOString();
  const db = getDb();

  const insertRecord = db.prepare(`
    INSERT INTO records (title, content, status, created_by, created_at, updated_at)
    VALUES (?, ?, 'draft', ?, ?, ?)
  `);
  const recordResult = insertRecord.run(cleanTitle, cleanContent, req.user.id, now, now);
  const recordId = Number(recordResult.lastInsertRowid);

  const insertAudit = db.prepare(`
    INSERT INTO audit_trail (record_id, user_id, user_email, action, field_changed, old_value, new_value, timestamp)
    VALUES (?, ?, ?, 'create', 'record', NULL, ?, ?)
  `);
  insertAudit.run(
    recordId,
    req.user.id,
    req.user.email,
    JSON.stringify({ title: cleanTitle, content: cleanContent, status: 'draft' }),
    now
  );

  const createdRecord = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId);

  res.status(201).json({
    message: 'Record created successfully in draft status.',
    record: createdRecord
  });
});

router.put('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  if (isNaN(recordId)) {
    return res.status(400).json({ error: 'Invalid record ID.' });
  }

  const db = getDb();
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId);

  if (!record) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (record.status === 'locked') {
    return res.status(403).json({
      error: 'Data Integrity Violation: Locked records are immutable and cannot be edited by any role (21 CFR §11.10(e)).'
    });
  }

  if (req.user.role !== 'operator' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: `Access denied. Role '${req.user.role}' cannot edit records.`
    });
  }

  const { title, content } = req.body || {};
  if (!title && !content) {
    return res.status(400).json({ error: 'At least one field (title or content) must be provided for update.' });
  }

  const newTitle = title !== undefined ? title.trim() : record.title;
  const newContent = content !== undefined ? content.trim() : record.content;
  const now = new Date().toISOString();

  const insertAudit = db.prepare(`
    INSERT INTO audit_trail (record_id, user_id, user_email, action, field_changed, old_value, new_value, timestamp)
    VALUES (?, ?, ?, 'update', ?, ?, ?, ?)
  `);

  let changedCount = 0;

  if (newTitle !== record.title) {
    insertAudit.run(recordId, req.user.id, req.user.email, 'title', record.title, newTitle, now);
    changedCount++;
  }

  if (newContent !== record.content) {
    insertAudit.run(recordId, req.user.id, req.user.email, 'content', record.content, newContent, now);
    changedCount++;
  }

  if (changedCount > 0) {
    db.prepare(`
      UPDATE records SET title = ?, content = ?, updated_at = ? WHERE id = ?
    `).run(newTitle, newContent, now, recordId);
  }

  const updatedRecord = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId);

  res.json({
    message: changedCount > 0 ? 'Record updated successfully.' : 'No changes detected.',
    record: updatedRecord
  });
});

router.post('/:id/sign', requireAuth, requireRole('reviewer', 'admin'), (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  if (isNaN(recordId)) {
    return res.status(400).json({ error: 'Invalid record ID.' });
  }

  const { password, meaning } = req.body || {};

  const allowedMeanings = ['Reviewed', 'Approved', 'Rejected'];
  if (!meaning || !allowedMeanings.includes(meaning)) {
    return res.status(400).json({
      error: `Invalid signature meaning. Must be one of: ${allowedMeanings.join(', ')}.`
    });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password re-entry is required to apply electronic signature.' });
  }

  const db = getDb();
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId);

  if (!record) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (record.status === 'locked') {
    return res.status(400).json({ error: 'Record is already locked and cannot be signed again.' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({
      error: 'Electronic Signature Verification Failed: Incorrect password.'
    });
  }

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO signatures (record_id, user_id, user_name, user_email, user_role, meaning, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    req.user.id,
    req.user.name,
    req.user.email,
    req.user.role,
    meaning,
    now
  );

  db.prepare(`
    UPDATE records SET status = 'locked', updated_at = ? WHERE id = ?
  `).run(now, recordId);

  db.prepare(`
    INSERT INTO audit_trail (record_id, user_id, user_email, action, field_changed, old_value, new_value, timestamp)
    VALUES (?, ?, ?, 'sign', 'status', 'draft', 'locked', ?)
  `).run(recordId, req.user.id, req.user.email, now);

  const updatedRecord = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId);
  const signatures = db.prepare('SELECT * FROM signatures WHERE record_id = ?').all(recordId);

  res.json({
    message: `Record successfully signed as '${meaning}' and locked.`,
    record: updatedRecord,
    signatures
  });
});

export default router;
