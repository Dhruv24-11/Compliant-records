# Requirements Traceability Matrix (RTM)

**Project:** Compliant Records  
**Author:** Dhruv Mehta  
**Standard:** 21 CFR Part 11 / GAMP 5 Life-Cycle Traceability  

| Req ID | Requirement Summary | 21 CFR Part 11 / Regulatory Clause | Implementation Location | Test Case | Automated Test Assertion | Status |
|---|---|---|---|---|---|---|
| **FR-1** | User authentication with email/password; JWT session token | 21 CFR §11.200 (Identification controls) | `src/routes/authRoutes.js` | **TC-01** | `qa-scenarios.test.js` Scenario 1 | **VERIFIED** |
| **FR-2** | Generic error on invalid credentials without enumeration | System Security Best Practice | `src/routes/authRoutes.js` | **TC-02** | `qa-scenarios.test.js` Scenario 2 | **VERIFIED** |
| **FR-3** | Operators & Admins create records in `draft` status | 21 CFR §11.10(g) Authority checks | `src/routes/recordRoutes.js` | **TC-03, TC-05** | `qa-scenarios.test.js` Scenario 3 & 5 | **VERIFIED** |
| **FR-4** | Edit records only while in `draft` status | 21 CFR §11.10(a) System integrity | `src/routes/recordRoutes.js` | **TC-04** | `qa-scenarios.test.js` Scenario 4 | **VERIFIED** |
| **FR-5** | Authenticated users can view record, audit trail, signatures | 21 CFR §11.10(b) Record inspection | `src/routes/recordRoutes.js` | **TC-03, TC-04** | `qa-scenarios.test.js` Scenario 3 | **VERIFIED** |
| **FR-6** | Append-only audit log capturing user, action, field delta, time | 21 CFR §11.10(e) Computer-generated audit trail | `src/routes/recordRoutes.js` | **TC-03, TC-04** | `qa-scenarios.test.js` Scenario 3 & 4 | **VERIFIED** |
| **FR-7** | Audit logs can never be edited or deleted | 21 CFR §11.10(e) Tamper-evident audit log | `src/routes/auditRoutes.js` | **TC-08** | `qa-scenarios.test.js` Data Integrity Test | **VERIFIED** |
| **FR-8** | Reviewers & Admins can sign with meaning (Reviewed/Approved/Rejected) | 21 CFR §11.50 Signature manifestations | `src/routes/recordRoutes.js` | **TC-06** | `qa-scenarios.test.js` Scenario 6 | **VERIFIED** |
| **FR-9** | Signature execution requires password re-entry | 21 CFR §11.200(a)(1) Identity re-verification | `src/routes/recordRoutes.js` | **TC-07** | `qa-scenarios.test.js` Scenario 7 | **VERIFIED** |
| **FR-10** | Successful signature transitions record to `locked` status | 21 CFR §11.10(a) Record protection | `src/routes/recordRoutes.js` | **TC-06** | `qa-scenarios.test.js` Scenario 6 | **VERIFIED** |
| **FR-11** | Locked records reject all further edit attempts regardless of role | ALCOA+ Principles / Data Immutability | `src/routes/recordRoutes.js` | **TC-08** | `qa-scenarios.test.js` Scenario 8 | **VERIFIED** |
| **FR-12** | Admins view/create users; non-admins rejected with 403 | 21 CFR §11.10(d) Limiting system access | `src/routes/userRoutes.js` | **TC-09, TC-10** | `qa-scenarios.test.js` Scenario 9 & 10 | **VERIFIED** |
| **NFR-1** | Local execution with built-in SQLite (`node:sqlite`) | GAMP 5 Category 4 Infrastructure | `src/db.js` | All | In-memory & WAL persistent execution | **VERIFIED** |
| **NFR-2** | Passwords stored only as bcrypt hashes | Data Security & Part 11 Password Controls | `src/auth.js` | All | Zero plain-text credentials stored | **VERIFIED** |
| **NFR-3** | Deterministic behavior across repeated test runs | Test Automation Reliability | `tests/qa-scenarios.test.js` | All | 100% Pass Rate over consecutive runs | **VERIFIED** |
