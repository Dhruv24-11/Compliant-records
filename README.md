Compliant Records is a full-stack web application engineered to demonstrate software controls, ALCOA+ data integrity, and role-based access control (RBAC) applied to electronic batch records in compliance with 21 CFR Part 11 regulations. Targeted toward Software QA, CSV Engineering, and Validation roles, the application utilizes Node.js v22 with native SQLite, Express, bcryptjs, JSON Web Tokens (JWT), and standard HTML5/CSS3. The system achieves 100% test automation across all ten core quality assurance scenarios.

Regulatory and System Architecture
The core architecture models strict FDA 21 CFR Part 11 mandates. It includes an append-only, computer-generated audit trail (§11.10(e)) that captures contemporaneous user attribution, UTC timestamps, and field-level delta comparisons between old and new values to prevent unauthorized modifications. The electronic signature workflow (§11.50) requires two-factor password re-authentication (§11.200) and binds signature manifestations—including signer name, role, timestamp, and intent—directly to the record, permanently locking it into an immutable state upon approval.

Operational Setup and Access Roles
System setup is streamlined for testing and demonstration. Running the database seed script prepares the application environment, after which executing the automated test suite verifies all system constraints. Launching the Express server hosts the web application on port 3000. Access is segmented using role-based access control across three primary personas:

Operator: Originates and edits batch records while in draft status. Operators cannot sign records or manage users.

Reviewer: Inspects batch records, reviews audit logs, and applies electronic signatures. Reviewers cannot originate new records.

Admin: Possesses full administrative authority to originate, edit, sign, inspect all audit trails, and provision user accounts.

Quality Assurance Validation Scenarios
The system is continuously verified through an automated suite covering ten critical functional and regulatory scenarios:

TC-01: Valid authentication for Admin, Reviewer, and Operator roles (§11.200).

TC-02: Defense against invalid login attempts using generic error responses without account enumeration.

TC-03: Operator batch record creation in draft status accompanied by automatic audit log entry generation.

TC-04: Draft record modifications capturing field-level old and new values in accordance with ALCOA+ accuracy principles.

TC-05: Rejection (403 Forbidden) of record creation attempts by non-operator roles to maintain RBAC segregation of duties.

TC-06: Successful signature execution by a Reviewer with verified password authentication, automatically transitioning the record to a locked state (§11.50).

TC-07: Rejection of signature attempts containing incorrect passwords, ensuring the record remains in draft status (§11.200(a)(1)).

TC-08: Enforcement of data immutability, blocking all edit attempts on locked records regardless of user role.

TC-09: Administrative user provisioning and immediate integration into active user directories.

TC-10: Strict access control preventing non-administrative roles from viewing or provisioning user accounts.