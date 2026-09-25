import { initDatabase, getDb } from './db.js';
import { hashPassword } from './auth.js';

export function seedDatabase(customDb = null) {
  const db = customDb || getDb();

  db.exec(`
    DELETE FROM signatures;
    DELETE FROM audit_trail;
    DELETE FROM records;
    DELETE FROM users;
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const pastTime = new Date(Date.now() - 3600000 * 24).toISOString();

  const adminId = Number(insertUser.run(
    'Dr. Eleanor Vance (System Admin)',
    'admin@pharma.local',
    hashPassword('AdminPassword123!'),
    'admin',
    pastTime
  ).lastInsertRowid);

  const reviewerId = Number(insertUser.run(
    'Marcus Sterling (QA Manager)',
    'reviewer@pharma.local',
    hashPassword('ReviewerPassword123!'),
    'reviewer',
    pastTime
  ).lastInsertRowid);

  const operatorId = Number(insertUser.run(
    'Jessica Lin (Manufacturing Operator)',
    'operator@pharma.local',
    hashPassword('OperatorPassword123!'),
    'operator',
    pastTime
  ).lastInsertRowid);

  const insertRecord = db.prepare(`
    INSERT INTO records (title, content, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const rec1Title = 'Batch Record #BR-2026-089: Lyophilized Vaccine Formulation - Lot 44B';
  const rec1Content = 'Compounding step: 500L sterile WFI (Water-for-Injection) equilibrated to 22.0°C. Active pharmaceutical ingredient (API-09) added at 14:15. pH adjusted to 6.85 using 0.1M sterile NaOH. Pre-filtration bioburden sample drawn. Status ready for sterile fill.';
  const rec1Id = Number(insertRecord.run(
    rec1Title,
    rec1Content,
    'draft',
    operatorId,
    pastTime,
    pastTime
  ).lastInsertRowid);

  const insertAudit = db.prepare(`
    INSERT INTO audit_trail (record_id, user_id, user_email, action, field_changed, old_value, new_value, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    rec1Id,
    operatorId,
    'operator@pharma.local',
    'create',
    'record',
    null,
    JSON.stringify({ title: rec1Title, content: rec1Content, status: 'draft' }),
    pastTime
  );

  const rec2Title = 'Batch Record #BR-2026-074: Monoclonal Antibody mAb-107 Ultrafiltration - Lot 12A';
  const rec2InitialContent = 'Tangential flow filtration executed with 30kDa PES cassette. Initial flux rate: 45 LMH.';
  const rec2FinalContent = 'Tangential flow filtration executed with 30kDa PES cassette. Initial flux rate: 45 LMH. Final retentate concentration achieved: 52.4 mg/mL. Cassette integrity tested post-run: pass (pressure hold 0.4 bar drop over 5 min). Released for final formulation.';
  const intermediateTime = new Date(Date.now() - 3600000 * 12).toISOString();
  const signTime = new Date(Date.now() - 3600000 * 4).toISOString();

  const rec2Id = Number(insertRecord.run(
    rec2Title,
    rec2FinalContent,
    'locked',
    operatorId,
    pastTime,
    signTime
  ).lastInsertRowid);

  insertAudit.run(
    rec2Id,
    operatorId,
    'operator@pharma.local',
    'create',
    'record',
    null,
    JSON.stringify({ title: rec2Title, content: rec2InitialContent, status: 'draft' }),
    pastTime
  );

  insertAudit.run(
    rec2Id,
    operatorId,
    'operator@pharma.local',
    'update',
    'content',
    rec2InitialContent,
    rec2FinalContent,
    intermediateTime
  );

  insertAudit.run(
    rec2Id,
    reviewerId,
    'reviewer@pharma.local',
    'sign',
    'status',
    'draft',
    'locked',
    signTime
  );

  db.prepare(`
    INSERT INTO signatures (record_id, user_id, user_name, user_email, user_role, meaning, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    rec2Id,
    reviewerId,
    'Marcus Sterling (QA Manager)',
    'reviewer@pharma.local',
    'reviewer',
    'Approved',
    signTime
  );

  console.log(`Seeded records: Record #${rec1Id} (Draft), Record #${rec2Id} (Locked & Signed)`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  initDatabase();
  seedDatabase();
}
