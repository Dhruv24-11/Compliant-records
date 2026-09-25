import express from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { recordId, action, userEmail } = req.query;
  const db = getDb();

  let query = `
    SELECT a.id, a.record_id, a.user_id, a.user_email, a.action, a.field_changed,
           a.old_value, a.new_value, a.timestamp,
           r.title as record_title
    FROM audit_trail a
    LEFT JOIN records r ON a.record_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (recordId) {
    query += ' AND a.record_id = ?';
    params.push(recordId);
  }
  if (action) {
    query += ' AND a.action = ?';
    params.push(action);
  }
  if (userEmail) {
    query += ' AND a.user_email = ?';
    params.push(userEmail);
  }

  query += ' ORDER BY a.id DESC LIMIT 200';

  const entries = db.prepare(query).all(...params);

  res.json({ auditTrail: entries });
});

router.all('/:id', (req, res) => {
  if (['PUT', 'POST', 'DELETE', 'PATCH'].includes(req.method)) {
    return res.status(405).json({
      error: 'Data Integrity Violation: Audit trail entries are immutable and append-only. Modification or deletion is strictly prohibited (21 CFR Part 11.10(e)).'
    });
  }
});

export default router;
