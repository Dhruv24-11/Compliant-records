// Compliant Records - Client Application
// 21 CFR Part 11 Data Integrity, Authentication & Electronic Signatures

const DEMO_ACCOUNTS = {
  operator: {
    email: 'operator@pharma.local',
    password: 'OperatorPassword123!',
    name: 'Jessica Lin (Manufacturing Operator)',
    role: 'operator'
  },
  reviewer: {
    email: 'reviewer@pharma.local',
    password: 'ReviewerPassword123!',
    name: 'Marcus Sterling (QA Manager / Reviewer)',
    role: 'reviewer'
  },
  admin: {
    email: 'admin@pharma.local',
    password: 'AdminPassword123!',
    name: 'Dr. Eleanor Vance (System Admin)',
    role: 'admin'
  }
};

let currentToken = localStorage.getItem('compliant_records_token') || null;
let currentUser = null;
let recordsCache = [];
let selectedRecordId = null;

// API Request Wrapper
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('Network Error:', err);
    return { ok: false, status: 0, data: { error: 'Network error connecting to API.' } };
  }
}

// Toast Notifications
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#b91c1c' : '#0f172a';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

// Autofill credentials in Login Form
function autofillCredentials(role) {
  const account = DEMO_ACCOUNTS[role];
  if (!account) return;
  document.getElementById('loginEmail').value = account.email;
  document.getElementById('loginPassword').value = account.password;
  document.getElementById('loginErrorMessage').style.display = 'none';
  showToast(`Autofilled credentials for ${account.name}`);
}

// Handle Login Form Submit
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginErrorMessage');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  errorDiv.style.display = 'none';
  btnSubmit.disabled = true;
  btnSubmit.style.opacity = '0.7';

  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  btnSubmit.disabled = false;
  btnSubmit.style.opacity = '1';

  if (res.ok) {
    currentToken = res.data.token;
    localStorage.setItem('compliant_records_token', currentToken);
    currentUser = res.data.user;

    showToast(`Welcome, ${currentUser.name}! Authenticated as ${currentUser.role.toUpperCase()}.`);
    transitionToApp();
  } else {
    // FR-2: Display generic error message without user enumeration
    errorDiv.textContent = res.data.error || 'Invalid email or password.';
    errorDiv.style.display = 'block';
  }
}

// Handle Logout
function handleLogout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('compliant_records_token');
  
  // Transition back to login view
  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginErrorMessage').style.display = 'none';
  showToast('You have been signed out successfully.');
}

// Transition from Login to App View
function transitionToApp() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appView').style.display = 'block';

  renderRoleBasedUI();
  switchTab('records');
}

// Configure UI according to authenticated user role
function renderRoleBasedUI() {
  if (!currentUser) return;

  const role = currentUser.role;
  const sessionDiv = document.getElementById('userSession');
  sessionDiv.innerHTML = `
    <div class="session-badge">
      <span class="dot" style="background:${getRoleColor(role)}"></span>
      <strong>${escapeHtml(currentUser.name)}</strong>
      <span class="badge-role badge-role-${role}">${role.toUpperCase()}</span>
    </div>
  `;

  // Update banner context text
  const roleBanner = document.getElementById('roleContextBanner');
  if (role === 'operator') {
    roleBanner.innerHTML = `<strong>Operator Role:</strong> You are authorized to originate batch records and edit records in <code>draft</code> status. Signature approval is segregated to Reviewers.`;
  } else if (role === 'reviewer') {
    roleBanner.innerHTML = `<strong>Reviewer Role:</strong> You are authorized to verify process records, inspect audit trails, and execute 21 CFR §11.50 Electronic Signatures with password re-authentication.`;
  } else if (role === 'admin') {
    roleBanner.innerHTML = `<strong>Administrator Role:</strong> Full system authority active: User provisioning (FR-12), record origination, signing, and audit trail oversight.`;
  }

  // Sidebar role description
  const sidebarDesc = document.getElementById('sidebarRoleDescription');
  if (role === 'operator') {
    sidebarDesc.textContent = 'Can create and modify draft batch records. Cannot sign records or manage users.';
  } else if (role === 'reviewer') {
    sidebarDesc.textContent = 'Can review technical data and apply binding electronic signatures. Cannot originate records.';
  } else if (role === 'admin') {
    sidebarDesc.textContent = 'Full access: create, edit, sign, view all audit trails, and provision new user accounts.';
  }

  // Create record button visibility
  const btnNewRecord = document.getElementById('btnNewRecord');
  if (btnNewRecord) {
    btnNewRecord.style.display = (role === 'operator' || role === 'admin') ? 'inline-flex' : 'none';
  }

  // User management tab indication
  const navTabUsers = document.getElementById('navTabUsers');
  if (navTabUsers) {
    if (role === 'admin') {
      navTabUsers.title = 'User Management (Admin Access Active)';
    } else {
      navTabUsers.title = 'User Management (Restricted to Admins)';
    }
  }
}

function getRoleColor(role) {
  switch (role) {
    case 'admin': return '#f472b6';
    case 'reviewer': return '#34d399';
    case 'operator': return '#38bdf8';
    default: return '#94a3b8';
  }
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.content-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  if (tabId === 'records') {
    loadRecords();
  } else if (tabId === 'audit') {
    loadGlobalAuditTrail();
  } else if (tabId === 'users') {
    loadUsers();
  }
}

// Record Management
async function loadRecords() {
  const res = await api('/api/records');
  if (!res.ok) {
    if (res.status === 401) {
      handleLogout();
      return;
    }
    showToast('Failed to load batch records', true);
    return;
  }

  recordsCache = res.data.records || [];
  renderRecordsList();

  if (selectedRecordId) {
    selectRecord(selectedRecordId);
  } else if (recordsCache.length > 0) {
    selectRecord(recordsCache[0].id);
  }
}

function renderRecordsList() {
  const container = document.getElementById('recordsListContainer');
  const search = document.getElementById('recordSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  const filtered = recordsCache.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search) || r.content.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--slate-500); font-size: 0.85rem;">No batch records match filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="record-item ${r.id === selectedRecordId ? 'active' : ''}" onclick="selectRecord(${r.id})">
      <div class="record-item-header">
        <span class="record-item-id">ID: #${r.id}</span>
        <span class="badge-status ${r.status === 'locked' ? 'badge-locked' : 'badge-draft'}">
          ${r.status === 'locked' ? '&#128274; Locked' : '&#9998; Draft'}
        </span>
      </div>
      <div class="record-item-title">${escapeHtml(r.title)}</div>
      <div class="record-item-meta">
        <span>By: ${escapeHtml(r.creator_name || r.creator_email)}</span>
        <span>${formatDate(r.created_at)}</span>
      </div>
    </div>
  `).join('');
}

function filterRecordList() {
  renderRecordsList();
}

async function selectRecord(recordId) {
  selectedRecordId = recordId;
  renderRecordsList();

  const detailPane = document.getElementById('recordDetailPane');
  detailPane.innerHTML = `<div class="empty-state"><p>Loading record #${recordId} details & audit trail...</p></div>`;

  const res = await api(`/api/records/${recordId}`);
  if (!res.ok) {
    detailPane.innerHTML = `<div class="empty-state"><p>Error loading record.</p></div>`;
    return;
  }

  const { record, auditTrail, signatures } = res.data;
  const isLocked = record.status === 'locked';
  const canEdit = !isLocked && (currentUser.role === 'operator' || currentUser.role === 'admin');
  const canSign = !isLocked && (currentUser.role === 'reviewer' || currentUser.role === 'admin');

  detailPane.innerHTML = `
    <div class="detail-header">
      <div>
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
          <span class="badge-status ${isLocked ? 'badge-locked' : 'badge-draft'}">
            ${isLocked ? '&#128274; Locked & Immutable' : '&#9998; Draft (Unlocked)'}
          </span>
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--slate-500);">Record #${record.id}</span>
        </div>
        <h3 class="detail-title">${escapeHtml(record.title)}</h3>
        <div class="detail-meta-strip">
          <div class="meta-item">Originated by: <strong>${escapeHtml(record.creator_name || record.creator_email)}</strong></div>
          <div class="meta-item">Created: <strong>${formatDate(record.created_at)}</strong></div>
          <div class="meta-item">Last Modified: <strong>${formatDate(record.updated_at)}</strong></div>
        </div>
      </div>
      <div class="detail-actions">
        ${canEdit ? `
          <button class="btn btn-outline" onclick="openEditRecordModal(${record.id})">
            Edit Record
          </button>
        ` : ''}
        ${canSign ? `
          <button class="btn btn-danger" onclick="openSignatureModal(${record.id})">
            Sign & Lock Record
          </button>
        ` : ''}
        ${isLocked ? `
          <span class="badge-status badge-locked" style="padding: 0.4rem 0.8rem;">
            &#128274; 21 CFR §11.10(a) Lock Active
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Process Parameters / Content -->
    <div style="margin-bottom: 1.25rem;">
      <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--slate-500); margin-bottom: 0.5rem; letter-spacing: 0.05em;">
        Batch Manufacturing Data & Process Parameters
      </h4>
      <div class="content-box">${escapeHtml(record.content)}</div>
    </div>

    <!-- Electronic Signatures Card (21 CFR §11.50) -->
    <div class="signatures-card">
      <div class="signatures-card-header">
        Electronic Signatures Manifest (21 CFR §11.50)
      </div>
      ${signatures.length === 0 ? `
        <div style="font-size: 0.8rem; color: var(--slate-500); font-style: italic;">
          No signatures applied. Record is in draft status awaiting review.
        </div>
      ` : signatures.map(sig => `
        <div class="sig-manifest-item">
          <div class="sig-header">
            <div>
              <span class="sig-name">${escapeHtml(sig.user_name)}</span>
              <span class="badge-role badge-role-${sig.user_role}" style="margin-left: 0.35rem;">${sig.user_role.toUpperCase()}</span>
            </div>
            <span class="sig-meaning-badge">&#10003; ${escapeHtml(sig.meaning)}</span>
          </div>
          <div class="sig-details">
            User ID: ${sig.user_id} (${escapeHtml(sig.user_email)}) &bull; Signed At: ${formatDate(sig.timestamp)} &bull; Legally Binding Signature (§11.100)
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Append-Only Audit Trail (21 CFR §11.10(e)) -->
    <div>
      <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--slate-500); margin-bottom: 0.75rem; letter-spacing: 0.05em;">
        Append-Only Audit Trail (${auditTrail.length} ${auditTrail.length === 1 ? 'Event' : 'Events'})
      </h4>
      <div class="audit-timeline">
        ${auditTrail.map(log => `
          <div class="audit-item">
            <div class="audit-item-top">
              <div>
                <span class="audit-action-badge action-${log.action}">${log.action}</span>
                <span style="font-weight: 600; margin-left: 0.35rem;">${escapeHtml(log.user_email)}</span>
                ${log.field_changed ? `<span style="color: var(--slate-500);">&bull; field: <code>${escapeHtml(log.field_changed)}</code></span>` : ''}
              </div>
              <span class="audit-timestamp">${formatDate(log.timestamp)}</span>
            </div>
            ${log.action === 'update' ? `
              <div class="audit-diff">
                <span class="diff-old"><strong>- Old:</strong> ${escapeHtml(log.old_value)}</span>
                <span class="diff-new"><strong>+ New:</strong> ${escapeHtml(log.new_value)}</span>
              </div>
            ` : log.action === 'sign' ? `
              <div style="font-size: 0.775rem; color: var(--success); font-weight: 500; margin-top: 0.25rem;">
                Status transitioned from 'draft' to 'locked' upon signature manifestation.
              </div>
            ` : `
              <div style="font-size: 0.775rem; color: var(--slate-600); margin-top: 0.25rem;">
                Batch record originated in initial 'draft' status.
              </div>
            `}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Modal Handlers
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// 1. Electronic Signature Execution
function openSignatureModal(recordId) {
  const record = recordsCache.find(r => r.id === recordId);
  if (!record) return;

  document.getElementById('signerInfoDisplay').value = `${currentUser.name} (${currentUser.role.toUpperCase()}) - ${currentUser.email}`;
  document.getElementById('signaturePassword').value = '';
  document.getElementById('signError').style.display = 'none';
  openModal('signatureModal');
}

async function handleSignatureSubmit(e) {
  e.preventDefault();
  const password = document.getElementById('signaturePassword').value;
  const meaning = document.getElementById('signatureMeaning').value;
  const errorDiv = document.getElementById('signError');
  errorDiv.style.display = 'none';

  const res = await api(`/api/records/${selectedRecordId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ password, meaning })
  });

  if (res.ok) {
    closeModal('signatureModal');
    showToast(`Signature applied as '${meaning}'. Record is now permanently locked.`);
    loadRecords();
  } else {
    errorDiv.textContent = res.data.error || 'Signature execution failed.';
    errorDiv.style.display = 'block';
  }
}

// 2. Create Record Modal
function openNewRecordModal() {
  document.getElementById('newRecordTitle').value = '';
  document.getElementById('newRecordContent').value = '';
  document.getElementById('newRecordError').style.display = 'none';
  openModal('newRecordModal');
}

async function handleNewRecordSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('newRecordTitle').value;
  const content = document.getElementById('newRecordContent').value;
  const errorDiv = document.getElementById('newRecordError');
  errorDiv.style.display = 'none';

  const res = await api('/api/records', {
    method: 'POST',
    body: JSON.stringify({ title, content })
  });

  if (res.ok) {
    closeModal('newRecordModal');
    showToast('Batch record created successfully.');
    selectedRecordId = res.data.record.id;
    loadRecords();
  } else {
    errorDiv.textContent = res.data.error || 'Failed to create record.';
    errorDiv.style.display = 'block';
  }
}

// 3. Edit Record Modal
function openEditRecordModal(recordId) {
  const record = recordsCache.find(r => r.id === recordId);
  if (!record) return;

  document.getElementById('editRecordId').value = record.id;
  document.getElementById('editRecordTitle').value = record.title;
  document.getElementById('editRecordContent').value = record.content;
  document.getElementById('editRecordError').style.display = 'none';
  openModal('editRecordModal');
}

async function handleEditRecordSubmit(e) {
  e.preventDefault();
  const recordId = document.getElementById('editRecordId').value;
  const title = document.getElementById('editRecordTitle').value;
  const content = document.getElementById('editRecordContent').value;
  const errorDiv = document.getElementById('editRecordError');
  errorDiv.style.display = 'none';

  const res = await api(`/api/records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify({ title, content })
  });

  if (res.ok) {
    closeModal('editRecordModal');
    showToast('Batch record updated and change logged in audit trail.');
    loadRecords();
  } else {
    errorDiv.textContent = res.data.error || 'Failed to update record.';
    errorDiv.style.display = 'block';
  }
}

// 4. Global Audit Trail Explorer
async function loadGlobalAuditTrail() {
  const action = document.getElementById('auditActionFilter')?.value || '';
  const userEmail = document.getElementById('auditUserFilter')?.value || '';

  const query = new URLSearchParams();
  if (action) query.set('action', action);
  if (userEmail) query.set('userEmail', userEmail.trim());

  const res = await api(`/api/audit-trail?${query.toString()}`);
  const tbody = document.getElementById('auditTableBody');

  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Failed to load audit trail.</td></tr>`;
    return;
  }

  const entries = res.data.auditTrail || [];
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--slate-500);">No audit records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map(entry => `
    <tr>
      <td style="font-family: var(--font-mono); font-size: 0.75rem;">#${entry.id}</td>
      <td style="font-family: var(--font-mono); font-size: 0.75rem;">${formatDate(entry.timestamp)}</td>
      <td><strong>${escapeHtml(entry.user_email)}</strong></td>
      <td><span class="audit-action-badge action-${entry.action}">${entry.action}</span></td>
      <td><strong>Record #${entry.record_id}</strong></td>
      <td><code>${escapeHtml(entry.field_changed || 'N/A')}</code></td>
      <td style="font-family: var(--font-mono); font-size: 0.75rem;">${escapeHtml(entry.old_value || '—')}</td>
      <td style="font-family: var(--font-mono); font-size: 0.75rem;">${escapeHtml(entry.new_value || '—')}</td>
    </tr>
  `).join('');
}

// 5. User Management (Admin Only)
async function loadUsers() {
  const contentDiv = document.getElementById('usersContent');
  const restrictedNotice = document.getElementById('usersRestrictedNotice');
  const actionsDiv = document.getElementById('userManagementActions');

  if (currentUser.role !== 'admin') {
    contentDiv.style.display = 'none';
    actionsDiv.style.display = 'none';
    restrictedNotice.style.display = 'block';
    return;
  }

  restrictedNotice.style.display = 'none';
  contentDiv.style.display = 'block';
  actionsDiv.style.display = 'block';

  const res = await api('/api/users');
  const tbody = document.getElementById('usersTableBody');

  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${res.data.error || 'Failed to load users.'}</td></tr>`;
    return;
  }

  const users = res.data.users || [];
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-family: var(--font-mono);">#${u.id}</td>
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge-role badge-role-${u.role}">${u.role.toUpperCase()}</span></td>
      <td>${u.role === 'admin' ? 'Full system authority' : u.role === 'reviewer' ? 'Quality review & signing' : 'Batch record origination & editing'}</td>
      <td style="font-family: var(--font-mono);">${formatDate(u.created_at)}</td>
    </tr>
  `).join('');
}

function openNewUserModal() {
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserEmail').value = '';
  document.getElementById('newUserPassword').value = '';
  document.getElementById('newUserRole').value = 'operator';
  document.getElementById('newUserError').style.display = 'none';
  openModal('newUserModal');
}

async function handleNewUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName').value;
  const email = document.getElementById('newUserEmail').value;
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;
  const errorDiv = document.getElementById('newUserError');

  errorDiv.style.display = 'none';

  const res = await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role })
  });

  if (res.ok) {
    closeModal('newUserModal');
    showToast(`User ${name} created with role ${role}.`);
    loadUsers();
  } else {
    errorDiv.textContent = res.data.error || 'Failed to create user.';
    errorDiv.style.display = 'block';
  }
}

function openComplianceModal() { openModal('complianceModal'); }

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch { return isoStr; }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Initial session check on load
window.addEventListener('DOMContentLoaded', async () => {
  if (currentToken) {
    // Validate session
    const res = await api('/api/auth/me');
    if (res.ok && res.data.user) {
      currentUser = res.data.user;
      transitionToApp();
      return;
    }
  }

  // Not authenticated: display Login Screen
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('appView').style.display = 'none';
});