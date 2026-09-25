# Formal Software QA Test Plan: Compliant Records

**Document ID:** TP-CR-2026-001  
**Project:** Compliant Records (21 CFR Part 11 Validation Demo)  
**Author:** Dhruv Mehta  
**Target Role:** Software QA & Validation Intern (Pharmaceutical / Biotech / MedTech)  
**Methodology:** GAMP 5 Category 4 / 21 CFR Part 11 Data Integrity Verification  
**Status:** Approved & Verified  

---

## 1. Test Objectives & Scope
The objective of this test plan is to systematically verify the computerized system controls required by **FDA 21 CFR Part 11** and **ALCOA+ Data Integrity Principles** within the *Compliant Records* batch management system:
- **Authentication & Authorization:** Role-based access control (RBAC) across Operator, Reviewer, and Admin personas.
- **Contemporaneous Audit Trails (§11.10(e)):** Complete, append-only, tamper-evident transaction logging capturing user identity, timestamp, action, and field-level delta changes.
- **Electronic Signatures (§11.50 & §11.200):** Two-component authentication requiring password re-verification, manifestation of signer name, role, date/time, and intent (meaning).
- **Record Immutability (§11.10(a)):** Permanent locking of batch records upon electronic signature execution to prevent subsequent tampering.

---

## 2. Test Environment & Test Data

### 2.1 Accounts & Roles
| Role | User Name | Email | Password | Assigned Permissions |
|---|---|---|---|---|
| **Admin** | Dr. Eleanor Vance | `admin@pharma.local` | `AdminPassword123!` | System configuration, user provisioning, record origination, signing, and audit trail review |
| **Reviewer** | Marcus Sterling | `reviewer@pharma.local` | `ReviewerPassword123!` | Technical review, audit trail inspection, electronic signature execution (cannot originate records) |
| **Operator** | Jessica Lin | `operator@pharma.local` | `OperatorPassword123!` | Batch execution, record origination, and editing in `draft` status (cannot sign or manage users) |

---

## 3. Test Execution Matrix (10 Core Scenarios)

### TC-01: Valid Authentication across All Personas
- **Requirement:** FR-1 | 21 CFR §11.200
- **Pre-conditions:** System database seeded with active demo credentials.
- **Steps:**
  1. Submit `POST /api/auth/login` with `admin@pharma.local` and valid password.
  2. Submit `POST /api/auth/login` with `reviewer@pharma.local` and valid password.
  3. Submit `POST /api/auth/login` with `operator@pharma.local` and valid password.
- **Expected Result:** HTTP 200 OK. Each response contains a signed JWT session token and user payload matching the correct role.
- **Actual Result:** **PASS** (Automated in `tests/qa-scenarios.test.js`)

---

### TC-02: Invalid Login Credential Defense (Generic Error Handling)
- **Requirement:** FR-2 | System Security
- **Pre-conditions:** None.
- **Steps:**
  1. Submit `POST /api/auth/login` with valid email `admin@pharma.local` and incorrect password `WrongPasswordXYZ`.
  2. Submit `POST /api/auth/login` with nonexistent email `ghost@pharma.local`.
- **Expected Result:** HTTP 401 Unauthorized with generic message `"Invalid email or password."`. No field-specific disclosure (prevents user enumeration).
- **Actual Result:** **PASS**

---

### TC-03: Batch Record Origination & Audit Capture
- **Requirement:** FR-3, FR-6 | 21 CFR §11.10(e)
- **Pre-conditions:** Authenticated as Operator (`operator@pharma.local`).
- **Steps:**
  1. Submit `POST /api/records` with Title and Content for a new compounding batch.
  2. Inspect returned record status.
  3. Query `GET /api/records/:id` to inspect associated audit trail.
- **Expected Result:** HTTP 201 Created. Record status is initialized to `draft`. Audit log records an entry with `action: 'create'`, `user_email: 'operator@pharma.local'`, and timestamp.
- **Actual Result:** **PASS**

---

### TC-04: Draft Record Modification & Delta Change Logging
- **Requirement:** FR-4, FR-6 | ALCOA+ Accurate / Legible
- **Pre-conditions:** Draft record exists; authenticated as Operator.
- **Steps:**
  1. Submit `PUT /api/records/:id` updating the `content` field.
  2. Query `GET /api/records/:id` and review audit trail entries.
- **Expected Result:** HTTP 200 OK. Content updated. Audit log records `action: 'update'`, `field_changed: 'content'`, capturing the exact previous text (`old_value`) and updated text (`new_value`).
- **Actual Result:** **PASS**

---

### TC-05: RBAC Segregation of Duties - Non-Operator Origination Block
- **Requirement:** FR-3 | Segregation of Duties / 21 CFR §11.10(g)
- **Pre-conditions:** Authenticated as Reviewer (`reviewer@pharma.local`).
- **Steps:**
  1. Reviewer attempts to submit `POST /api/records` with batch record data.
- **Expected Result:** HTTP 403 Forbidden. Record creation is rejected; Quality Reviewers are segregated from manufacturing origination.
- **Actual Result:** **PASS**

---

### TC-06: Electronic Signature Execution & Record Locking
- **Requirement:** FR-8, FR-10 | 21 CFR §11.50, §11.10(a)
- **Pre-conditions:** Draft record exists; authenticated as Reviewer.
- **Steps:**
  1. Submit `POST /api/records/:id/sign` with valid password `ReviewerPassword123!` and `meaning: 'Approved'`.
  2. Inspect returned record status and signature array.
- **Expected Result:** HTTP 200 OK. Record status transitions from `draft` to `locked`. Signature manifest records signer name, email, role, meaning (`Approved`), and timestamp. Audit trail logs `action: 'sign'`.
- **Actual Result:** **PASS**

---

### TC-07: Electronic Signature Re-Authentication Failure
- **Requirement:** FR-9 | 21 CFR §11.200(a)(1)
- **Pre-conditions:** Draft record exists; authenticated as Reviewer.
- **Steps:**
  1. Submit `POST /api/records/:id/sign` with incorrect password `WrongReviewerPassword999!`.
  2. Inspect record status and signature array.
- **Expected Result:** HTTP 401 Unauthorized with error `"Electronic Signature Verification Failed: Incorrect password."`. Record remains unlocked in `draft` status; no signature added.
- **Actual Result:** **PASS**

---

### TC-08: Locked Record Immutability Enforcement
- **Requirement:** FR-11 | 21 CFR §11.10(a) Data Integrity
- **Pre-conditions:** Record is in `locked` status.
- **Steps:**
  1. Operator attempts `PUT /api/records/:lockedId`.
  2. Reviewer attempts `PUT /api/records/:lockedId`.
  3. Admin attempts `PUT /api/records/:lockedId`.
- **Expected Result:** HTTP 403 Forbidden for all attempts. System returns: `"Data Integrity Violation: Locked records are immutable and cannot be edited by any role"`.
- **Actual Result:** **PASS**

---

### TC-09: Admin User Provisioning & Password Hashing
- **Requirement:** FR-12 | System Administration
- **Pre-conditions:** Authenticated as Admin (`admin@pharma.local`).
- **Steps:**
  1. Submit `POST /api/users` with new user details and role `reviewer`.
  2. Query `GET /api/users` to verify user list.
- **Expected Result:** HTTP 201 Created. User appears in user list with specified role. Passwords are saved only as bcrypt hashes.
- **Actual Result:** **PASS**

---

### TC-10: Non-Admin Access Restriction to User Administration
- **Requirement:** FR-12 | 21 CFR §11.10(g)
- **Pre-conditions:** Authenticated as Operator or Reviewer.
- **Steps:**
  1. Submit `GET /api/users` as Operator.
  2. Submit `POST /api/users` as Operator.
  3. Submit `GET /api/users` as Reviewer.
- **Expected Result:** HTTP 403 Forbidden for all non-admin requests.
- **Actual Result:** **PASS**

---

## 4. Test Summary & QA Sign-Off
- **Total Test Cases Executed:** 10
- **Total Passed:** 10 (100%)
- **Total Failed:** 0 (0%)
- **Data Integrity / Immutability Defenses Verified:** 100%
- **Conclusion:** The *Compliant Records* software controls conform to the 21 CFR Part 11 requirements specified in the PRD.
