# 21 CFR Part 11 & GAMP 5 Regulatory Reference Guide

**Author:** Dhruv Mehta  
**Purpose:** Interview & Domain Reference for Software QA & CSV / Validation Engineering  

---

## 1. What is 21 CFR Part 11?
Title 21 of the Code of Federal Regulations, Part 11 (21 CFR Part 11) is the United States Food and Drug Administration (FDA) regulation that establishes criteria under which electronic records and electronic signatures are considered trustworthy, reliable, and generally equivalent to paper records and handwritten signatures.

---

## 2. Core Clauses Modeled in Compliant Records

### Clause 1: §11.10(e) - Audit Trail Integrity
- **Append-Only Architecture:** The `audit_trail` table is strictly append-only. No application API route exists for `PUT`, `PATCH`, or `DELETE` on audit entries. Any HTTP tampering attempt returns HTTP 405 Method Not Allowed.
- **Field-Level Delta Tracking:** When a record is updated, the system evaluates individual fields (`title`, `content`), capturing both the `old_value` and `new_value`.
- **Contemporaneous Attributability:** The audit log automatically grabs the authenticated JWT user identity (`user_id`, `user_email`) and ISO 8601 UTC server timestamp at the exact millisecond of write execution.

---

### Clause 2: §11.50 - Electronic Signature Manifestations
When an authorized reviewer executes a signature, the system creates a formal record in the `signatures` table containing:
- `user_name`: Printed full name of signer
- `user_email` and `user_role`: Identifier & role of signer
- `meaning`: Selected from predefined regulatory meanings (`Reviewed`, `Approved`, `Rejected`)
- `timestamp`: Contemporaneous time of execution
This manifestation is rendered in the UI directly beneath the batch record data.

---

### Clause 3: §11.200 - Electronic Signature Components and Controls
- To prevent accidental clicks or unauthorized session hijacking, executing an electronic signature requires **password re-authentication**.
- The user must re-enter their current password, which is checked against the stored bcrypt hash before the signature is minted and the record locked.
- If an incorrect password is entered, the signature is aborted, HTTP 401 is returned, and the record remains unlocked in `draft`.

---

### Clause 4: §11.10(a) & Data Immutability - Record Locking
- Once a record has been signed, its status transitions to `locked`.
- The update endpoint (`PUT /api/records/:id`) enforces a strict rule: if `status === 'locked'`, any edit attempt by ANY role (including Admin and Operator) is rejected with HTTP 403 Forbidden.

---

## 3. ALCOA+ Data Integrity Principles

| Principle | Meaning | System Feature |
|---|---|---|
| **A** - Attributable | Every action traced to an individual | User ID and email recorded on every audit log & signature |
| **L** - Legible | Data is readable throughout its lifecycle | Clear text records, readable JSON representations, and structured diffs |
| **C** - Contemporaneous | Logged at the time of execution | System-generated UTC timestamps captured at the moment of DB write |
| **O** - Original | First recording of data is preserved | Changes do not overwrite prior entries; audit trail stores full history |
| **A** - Accurate | Data is error-free and truthful | Field-by-field delta verification before logging |
| **+ Complete** | No gaps in transaction history | Audit trail logs origination (`create`), modifications (`update`), and locking (`sign`) |
| **+ Consistent** | Predictable behavior across test runs | Deterministic SQLite transaction handling and 100% test coverage |
| **+ Enduring** | Stored securely without degradation | SQLite WAL database persistence |
| **+ Available** | Accessible for audit and inspection | Read-only global and per-record audit explorer views |
