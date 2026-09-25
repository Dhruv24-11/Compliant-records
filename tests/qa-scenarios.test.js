import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { initDatabase, setDb } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

let server;
let baseUrl;

test.before(async () => {
  const db = initDatabase(':memory:');
  setDb(db);
  seedDatabase(db);

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(endpoint, options = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, password) {
  return await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

test('Compliant Records - 21 CFR Part 11 QA Validation Suite', async (t) => {
  let adminToken;
  let reviewerToken;
  let operatorToken;

  await t.test('Scenario 1: Valid login for each role (Admin, Reviewer, Operator)', async () => {
    const adminRes = await login('admin@pharma.local', 'AdminPassword123!');
    assert.equal(adminRes.status, 200);
    assert.ok(adminRes.data.token);
    assert.equal(adminRes.data.user.role, 'admin');
    adminToken = adminRes.data.token;

    const reviewerRes = await login('reviewer@pharma.local', 'ReviewerPassword123!');
    assert.equal(reviewerRes.status, 200);
    assert.ok(reviewerRes.data.token);
    assert.equal(reviewerRes.data.user.role, 'reviewer');
    reviewerToken = reviewerRes.data.token;

    const operatorRes = await login('operator@pharma.local', 'OperatorPassword123!');
    assert.equal(operatorRes.status, 200);
    assert.ok(operatorRes.data.token);
    assert.equal(operatorRes.data.user.role, 'operator');
    operatorToken = operatorRes.data.token;
  });

  await t.test('Scenario 2: Invalid login (wrong password) returns generic error', async () => {
    const res = await login('admin@pharma.local', 'WrongPasswordXYZ');
    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Invalid email or password.');
  });

  let createdRecordId;

  await t.test('Scenario 3: Operator creates a record -> record is draft and logged in audit trail', async () => {
    const title = 'Batch Record #BR-2026-999: Purified Sterile Buffer Preparation';
    const content = 'Formulation: 1000L buffer tank filled with WFI. Conductivity verified at 1.1 uS/cm. Temperature 21.4C.';

    const createRes = await request('/api/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ title, content })
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.record.status, 'draft');
    assert.equal(createRes.data.record.title, title);
    createdRecordId = createRes.data.record.id;

    const detailRes = await request(`/api/records/${createdRecordId}`, {
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(detailRes.status, 200);
    const auditLogs = detailRes.data.auditTrail;
    const createLog = auditLogs.find((log) => log.action === 'create');
    assert.ok(createLog);
    assert.equal(createLog.user_email, 'operator@pharma.local');
  });

  await t.test('Scenario 4: Operator edits a record -> audit trail records old and new values', async () => {
    const updatedContent = 'Formulation: 1000L buffer tank filled with WFI. Conductivity verified at 1.1 uS/cm. Temperature 21.4C. pH adjusted to 7.20.';

    const updateRes = await request(`/api/records/${createdRecordId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ content: updatedContent })
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.record.content, updatedContent);

    const detailRes = await request(`/api/records/${createdRecordId}`, {
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    const updateLog = detailRes.data.auditTrail.find(
      (log) => log.action === 'update' && log.field_changed === 'content'
    );
    assert.ok(updateLog);
    assert.ok(updateLog.old_value.includes('Temperature 21.4C.'));
    assert.ok(updateLog.new_value.includes('pH adjusted to 7.20.'));
  });

  await t.test('Scenario 5: Non-operator role (Reviewer) attempts to create a record -> rejected (403)', async () => {
    const res = await request('/api/records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({
        title: 'Unauthorized Record by Reviewer',
        content: 'Reviewers are not permitted to originate production records.'
      })
    });
    assert.equal(res.status, 403);
  });

  await t.test('Scenario 7: Reviewer signs with incorrect password -> rejected, record remains unlocked', async () => {
    const signAttempt = await request(`/api/records/${createdRecordId}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({
        password: 'WrongReviewerPassword999!',
        meaning: 'Approved'
      })
    });

    assert.equal(signAttempt.status, 401);
    const detailRes = await request(`/api/records/${createdRecordId}`, {
      headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    assert.equal(detailRes.data.record.status, 'draft');
  });

  await t.test('Scenario 6: Reviewer signs a record with correct password -> record locks', async () => {
    const signRes = await request(`/api/records/${createdRecordId}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({
        password: 'ReviewerPassword123!',
        meaning: 'Approved'
      })
    });

    assert.equal(signRes.status, 200);
    assert.equal(signRes.data.record.status, 'locked');
    assert.equal(signRes.data.signatures.length, 1);
    assert.equal(signRes.data.signatures[0].meaning, 'Approved');
  });

  await t.test('Scenario 8: Any role attempts to edit a locked record -> rejected (403)', async () => {
    const opEditRes = await request(`/api/records/${createdRecordId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ content: 'Tamper attempt by Operator' })
    });
    assert.equal(opEditRes.status, 403);

    const adminEditRes = await request(`/api/records/${createdRecordId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ content: 'Tamper attempt by Admin' })
    });
    assert.equal(adminEditRes.status, 403);
  });

  await t.test('Scenario 9: Admin creates a new user -> appears in user list with correct role', async () => {
    const newUserPayload = {
      name: 'Dr. Robert Chen (Validation Lead)',
      email: 'robert.chen@pharma.local',
      password: 'SecurePassword2026!',
      role: 'reviewer'
    };

    const createRes = await request('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(newUserPayload)
    });

    assert.equal(createRes.status, 201);
    const listRes = await request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(listRes.status, 200);
    const found = listRes.data.users.find((u) => u.email === newUserPayload.email);
    assert.ok(found);
  });

  await t.test('Scenario 10: Non-admin attempts to view/create users -> rejected (403)', async () => {
    const opView = await request('/api/users', {
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(opView.status, 403);

    const opCreate = await request('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        name: 'Hacker User',
        email: 'hacker@pharma.local',
        password: 'Pass',
        role: 'admin'
      })
    });
    assert.equal(opCreate.status, 403);
  });

  await t.test('Data Integrity: Direct modification or deletion of audit logs is rejected (405)', async () => {
    const deleteAttempt = await request('/api/audit-trail/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(deleteAttempt.status, 405);
  });
});
