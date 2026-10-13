# Banking Zen Master

ANTIGRAVITY MASTER PROMPT — FULL-STACK ONLINE BANKING SYSTEM (OBS)

1. Project Objective

Build a complete, functional, integrated full-stack web application for the Online Banking System (OBS) case study, following the Software Engineering documentation provided with this project.

This application is being developed for a college Software Engineering assignment with the following requirements:

Implement at least two core modules of the chosen case study.

Implement the modules according to the existing UML class diagram and sequence diagrams.

Each group member must implement one module.

Integrate all modules into a single working application.

Demonstrate the integrated application in a 5–8 minute video.

Prepare a report containing implementation details, descriptions, and screenshots.

Do not create just a frontend prototype. Implement the frontend, backend, database, business logic, API integration, validations, authentication, and testing.

The final application must be runnable locally and suitable for a live demonstration.

2. Mandatory Reference Documents

First, inspect all available project documentation and use it as the authoritative specification.

The reference documents include:

SRS_Aashka_Dave_2024300039 (3).pdf — Software Requirements Specification.

SE_EXP3_AASHKA_2024300039 (4).pdf — UML Class Diagram and class definitions.

SE_EXP4_AASHKA_2024300039 (2).pdf — Sequence Diagrams.

OBS_Use_Case_Diagram_Aashka_2024300039 (3).pdf — Actors, use cases, include/extend relationships.

Activity_Diagram_EXP5_Aashka_2024300039 (2).pdf — Fund Transfer with Fraud Detection activity flow.

Aashka_Dave_2024300039_DFD_SE_exp6 (2).pdf — Context, Level 1 and Level 2 Data Flow Diagrams.

OBS_WBS_and_Project_Schedule_Aashka_2024300039 (1).pdf — Work Breakdown Structure and project schedule.

If the PDFs are in the project workspace, read them. If they are outside the workspace, locate them through the available attachments or ask me to make them accessible. Do not silently replace the supplied specifications with a generic banking design.

Before implementation, create a requirement traceability document mapping each implemented feature to its SRS requirement, class, method, use case, and relevant sequence/activity diagram.

If any diagram conflicts with another document, record the discrepancy and propose a minimal resolution rather than silently inventing new classes or methods.

3. Modules to Implement

Implement the following two modules completely. Keep the architecture extensible for the remaining OBS features.

MODULE 1 — Account Management

This module will be implemented by Group Member 1.

A. Customer registration

Implement:

Registration form with full name, date of birth, address, mobile number, email, account type, and password.

Field-level validation.

Minimum age of 18 years.

Valid email format and 10-digit mobile number.

Secure password hashing using bcrypt or Argon2.

Customer creation with a unique customer ID.

KYC status tracking: Pending, Verified, or Rejected.

Account activation only after successful KYC verification.

Registration confirmation and reference number.

Use a simulated KYC verification service for the college demonstration. Clearly label simulated verification; do not claim to connect to an actual government or bank service.

B. Login and session management

Implement:

Login using email or another supported identifier and password.

Generic authentication failure messages.

Secure session management using HTTP-only cookies or another appropriately secured authentication mechanism.

Logout.

Protected routes.

Role-based authorization.

Login history and audit events.

Failed-login counter and a 30-minute lockout after five consecutive failures.

New-device OTP verification, with a demo-safe OTP delivery mechanism.

Session expiry and invalid-session handling.

Never store plaintext passwords or expose password hashes through the API.

C. Account dashboard

After login, show:

Customer profile.

Customer ID.

KYC status.

Account number in masked form.

Account type.

Current balance.

Account status.

Recent transactions.

Quick actions for transfer, statements, and profile management.

Provide an account list so the application can support multiple accounts per customer where permitted by the class diagram and SRS.

Use seeded demonstration data to make the dashboard meaningful immediately after setup.

D. Profile management

Implement:

View profile.

Update permitted personal information.

Validate email and mobile changes.

Persist changes to the database.

Record changes in the audit log.

Do not allow customers to change privileged fields such as their KYC status, balance, or account status directly.

E. Balance enquiry and transaction statements

Implement:

Account balance enquiry.

Date-range filtering.

Transaction list with reference number, date, description, debit, credit, and status.

Opening and closing balances.

Running balance.

Statement export as CSV and PDF, if feasible.

Maximum statement period of 12 months.

Every transaction displayed must come from the backend database, not hardcoded frontend arrays.

F. Account deactivation

Implement the Account.deactivate_account() operation according to the class diagram and SRS.

Allow deactivation only when:

The account balance is zero.

No loan is open.

No dormancy case is open.

Required OTP confirmation succeeds.

If the prerequisites are not met, return an understandable error message.

Record the deactivation event in the audit log.

MODULE 2 — Fund Transfer with Fraud Detection

This module will be implemented by Group Member 2.

It must integrate directly with Account Management.

A. Beneficiary management

Implement:

Add beneficiary.

View beneficiary list.

Update permitted beneficiary details.

Activate beneficiary after OTP confirmation.

Configurable cooling-off period.

Display beneficiary activation status.

Prevent transfers to inactive beneficiaries or beneficiaries whose cooling-off period has not elapsed.

Persist beneficiaries in the database and associate them with the correct customer.

Follow the existing class diagram and DFD for beneficiary relationships and data stores. If the implementation needs a Beneficiary entity that is absent from the class diagram, document and justify the change.

B. Transfer form

Create a transfer form containing:

Source account.

Transfer type: own account or third-party beneficiary.

Destination account or beneficiary.

Amount.

Remarks.

Transfer confirmation.

Validate that:

The amount is positive.

The source account belongs to the authenticated customer.

Both accounts are eligible for the requested operation.

The source account has sufficient funds.

The beneficiary is active and outside its cooling-off period when applicable.

Per-transaction and daily transfer limits are respected.

Use the SRS defaults of ₹2,00,000 per transaction and ₹5,00,000 cumulative per day unless changed through authorized configuration.

Enforce limits on the backend, not merely in the UI.

C. Fraud detection engine

Implement a deterministic, rule-based fraud engine. Do not use an opaque machine-learning model.

Calculate a risk score from 0–100 using configurable rules and weights.

Create rules for demonstration, such as:

Unusually large transfer amount.

Rapid repeated transfers.

New or recently activated beneficiary.

Unusual transaction frequency.

Suspicious login/device context where available.

These are implementation examples, not additional mandatory rules from the supplied class diagram. Keep the rules configurable and document the chosen scoring method.

Return:

Risk score.

Risk band: LOW, MEDIUM, or HIGH.

Triggered rules.

Action taken.

Make the risk engine a separate backend service/module so it can be tested independently.

Implement the following decision flow:

LOW risk

Continue through the required transfer confirmation flow.

Require the applicable OTP verification.

Proceed to transaction posting after successful validation.

MEDIUM risk

Require step-up OTP.

Display an advisory alert.

Permit no more than two failed step-up attempts before escalating the transaction to HIGH.

Reject or cancel the transaction when the challenge expires or the attempt limit is reached.

HIGH risk

Block the transfer.

Freeze the source account when required by the specified fraud workflow.

Create a fraud case.

Record the triggered rules.

Notify the customer through the demo notification mechanism.

Make the case available to the authorized fraud-review role.

Do not expose exact fraud thresholds or sensitive internal rules in customer-facing messages.

Implement the score-band mapping and all boundary conditions consistently. The scoring configuration must be documented so the examiner can understand why a test transaction received a particular risk band.

D. OTP verification

Implement:

Six-digit OTP.

Five-minute expiry.

Maximum of three OTP attempts for the normal transfer confirmation flow.

Secure OTP generation and storage.

OTP verification on the backend.

OTP invalidation after successful use.

Expired OTP handling.

Attempt counting and transfer cancellation.

Clear success and failure messages.

For the demo, use a development-only OTP adapter that displays or logs the OTP safely in the local development environment. Never return the OTP from a production API response or expose it in normal production logs.

Clearly distinguish simulated OTP delivery from a real SMS/email gateway.

E. Transaction posting and ledger

This is the most important financial-integrity component.

Implement the existing Transaction.post() method and maintain a transaction ledger.

Requirements:

Generate a unique transaction reference.

Use database transactions to make ledger posting atomic.

Record the debit and corresponding credit for a successful internal transfer.

Ensure the ledger entries balance.

Reject insufficient-funds transfers.

Prevent partial posting.

Use an idempotency key to prevent duplicate transfers when a request is retried.

Prevent simultaneous transfers from spending the same available balance.

Store timestamps, status, amount, source, destination, and relevant references.

Record failed and blocked transfer attempts for auditing.

Keep financial records immutable; correct erroneous postings through compensating entries rather than deleting records.

Use appropriate database locking or isolation to protect balances against concurrent requests.

For own-account transfers, debit one eligible account and credit another eligible account belonging to the same customer. For third-party outward transfers, use a simulated payment/clearing adapter.

Important: Do not pretend to integrate with a real bank, UPI, NEFT, or IMPS network. Clearly mark the payment network as simulated.

F. Settlement and reconciliation

Implement the failure paths shown in the activity diagram:

Successful settlement: mark the transfer successful.

Definitive settlement failure: post a compensating reversal and mark the transfer failed.

Payment timeout with an unknown outcome: mark the transaction Pending.

Pending transaction: provide an administrative reconciliation workflow.

Reconcile the final payment status before posting any reversal.

Prevent repeated reconciliation from creating duplicate ledger entries.

Do not reverse a transfer merely because the payment network timed out. Its settlement outcome must first be determined.

For an internal transfer, demonstrate atomic debit/credit posting without an unnecessary external payment-network call.

G. Fraud case management

Implement the class diagram's relevant methods:

FraudCase.escalate()

FraudAnalyst.review_case()

Account.deactivate_account()

Provide a restricted Fraud Analyst dashboard with:

Case ID.

Associated transaction reference.

Risk score and band.

Triggered rules.

Case status.

Review remarks.

Escalation history.

Relevant audit entries.

Fraud Analysts can review cases and tune permitted fraud-rule weights. They must not have authority to transfer funds or approve financial postings.

Ensure the account-freezing behavior and case-creation workflow are consistent with the sequence diagram.

4. UML Consistency Requirements

Do not treat the class diagram and sequence diagrams as optional documentation.

Use the existing classes and their operations wherever applicable:

User

Customer

PremiumCustomer

Account

Transaction

FraudCase

FraudAnalyst

BankAdministrator

Other relevant classes and interfaces already present in the reference documents.

Preserve inheritance, associations, multiplicities, responsibilities, and method names wherever the diagrams specify them.

The fund-transfer/fraud sequence must demonstrate the applicable flow:

Customer initiates transfer.

A Transaction object is created.

Transfer validation and fraud scoring occur.

HIGH-risk flow creates a FraudCase.

FraudCase.escalate() is invoked when the applicable escalation condition occurs.

FraudAnalyst.review_case() records an authorized review.

Account.deactivate_account() is used when the account must be frozen.

Transaction.post() handles valid financial posting.

The final transfer result is returned to the customer.

Do not call a method on a class that does not declare it. If the diagrams assign a method to a class or interface, preserve that responsibility in the implementation layer, even if a controller or service coordinates the operation.

Controllers may delegate to services, but business operations must remain traceable to the domain model.

Create a UML-to-code mapping document, for example:

UML elementImplementation locationVerificationCustomerCustomer model/entityRegistration testAccountAccount model/entityBalance and account-status testTransaction.post()Transaction domain/service methodLedger integration testFraudCase.escalate()Fraud case service/domain methodRisk escalation testFraudAnalyst.review_case()Fraud review serviceAuthorization testAccount.deactivate_account()Account domain/service methodDeactivation validation test

Adapt file locations to the selected architecture.

5. Recommended Technology Stack

If the repository already has a working stack, preserve it unless there is a compelling technical reason to change it.

Otherwise, use:

Frontend

React.

TypeScript.

Vite.

Tailwind CSS.

A consistent component library such as shadcn/ui.

React Router.

TanStack Query or an equivalent API-state management solution.

React Hook Form and Zod for form validation.

Backend

Node.js 20+.

Express.

TypeScript.

REST APIs.

Prisma ORM.

Database

PostgreSQL.

Version-controlled schema migrations.

Foreign keys and database constraints.

Atomic transactions and appropriate locking.

Security

bcrypt or Argon2 password hashing.

Secure authentication/session management.

Role-based access control.

Rate limiting.

Input validation.

Security headers.

Audit logging.

Testing

Vitest or Jest.

Supertest for API tests.

React Testing Library.

Playwright for end-to-end tests if feasible.

Documentation

OpenAPI/Swagger API documentation.

README.

Environment-variable example file.

Database setup and seed scripts.

Do not introduce unnecessary microservices or infrastructure that makes the college demonstration difficult to run. A modular monolith is acceptable if it preserves clear module boundaries and domain responsibilities.

6. User Roles and Authorization

Implement the roles defined by the supplied class diagram and SRS, at minimum:

Retail Customer.

Premium Customer.

Bank Administrator.

Fraud Analyst.

Add Loan Officer, Nominee, and Auditor interfaces only as needed for the scope or future extensibility.

Role restrictions must be enforced by the backend.

Examples:

Customers can view only their own accounts and transactions.

Customers cannot change their balances or approve their own fraud cases.

Fraud Analysts can review fraud cases but cannot move funds.

Administrators can access only the management operations assigned to their role.

Unauthorized requests must return appropriate HTTP status codes.

Do not rely on hiding buttons in the frontend as the authorization mechanism.

Create seeded demo users for each implemented role, with clearly documented local-only credentials.

7. UI/UX Requirements

Create a polished, modern banking dashboard appropriate for a professional software engineering project demonstration.

Public pages

Landing page.

Login.

Customer registration.

KYC status/reference lookup, if supported by the SRS.

Customer application

Dashboard.

Accounts.

Account details.

Beneficiaries.

Fund transfer.

OTP confirmation.

Transfer receipt.

Transaction history.

Statements.

Profile settings.

Fraud Analyst application

Fraud overview.

Fraud case queue.

Case details.

Risk score and triggered rules.

Review and escalation actions.

Authorized rule configuration.

Design requirements

Clean, professional banking-style interface.

Consistent typography, spacing, colors, and components.

Responsive desktop and mobile layouts.

Sidebar navigation.

Useful empty states.

Loading states.

Error messages and confirmation dialogs.

Search, sorting, filters, and pagination where appropriate.

INR currency formatting.

Masked account numbers.

Accessible forms and keyboard navigation.

Charts only when they display meaningful data from the backend.

Avoid excessive gradients, distracting animations, meaningless charts, and decorative UI that hides incomplete functionality.

Every visible button must perform its intended action.

Do not create non-functional placeholder buttons, fake transaction results, or hardcoded dashboard metrics.

8. Database Design

Design a normalized relational schema consistent with the UML model and DFD data stores.

At minimum, consider the following entities:

Users.

Customers.

Accounts.

Transactions.

LedgerEntries.

Beneficiaries.

OTPChallenges.

FraudRules.

FraudCases.

FraudCaseReviews.

LoginEvents.

AuditLogs.

KYCRecords.

PaymentInstructions or SettlementRecords, if required by the architecture.

Use additional entities only when justified by the requirements.

Implement:

Primary keys.

Foreign keys.

Unique constraints.

Check constraints for valid amounts and states.

Proper indexes.

Created/updated timestamps.

Appropriate decimal types for monetary values.

Referential integrity.

Database migrations.

Seed data.

Use Decimal/NUMERIC for financial amounts rather than floating-point arithmetic.

Document how the implementation maps to DFD stores D1 (Customer & Account), D2 (Transaction Ledger), D3 (Beneficiary), D5 (Fraud Rule & Risk Case), and D9 (Audit Log).

Ensure each business transaction and ledger entry has a well-defined relationship.

9. Backend API Requirements

Create a consistent REST API structure, with routes appropriate to the architecture.

Example route groups:

Authentication

POST /api/auth/register

POST /api/auth/login

POST /api/auth/logout

POST /api/auth/verify-otp

GET /api/auth/me

Accounts

GET /api/accounts

GET /api/accounts/:id

GET /api/accounts/:id/balance

PATCH /api/accounts/:id/profile

POST /api/accounts/:id/deactivate

Statements

GET /api/accounts/:id/transactions

GET /api/accounts/:id/statement

Beneficiaries

GET /api/beneficiaries

POST /api/beneficiaries

PATCH /api/beneficiaries/:id

POST /api/beneficiaries/:id/activate

Transfers

POST /api/transfers/preview

POST /api/transfers

GET /api/transfers/:id

GET /api/transfers/:id/receipt

Fraud

GET /api/fraud/cases

GET /api/fraud/cases/:id

POST /api/fraud/cases/:id/review

POST /api/fraud/cases/:id/escalate

GET /api/fraud/rules

PATCH /api/fraud/rules/:id

Reconciliation

GET /api/admin/reconciliation/pending

POST /api/admin/reconciliation/:id/resolve

These are suggested endpoints, not a requirement to reproduce every path exactly. Adapt them to the final implementation.

For every endpoint, implement:

Request validation.

Authentication and authorization.

Appropriate status codes.

Consistent JSON response structures.

Useful error messages.

Audit events for sensitive actions.

Protection against duplicate or unauthorized requests.

Generate and maintain Swagger/OpenAPI documentation.

10. Integration Requirements

Both group members must work on the same integrated application.

Define clear module boundaries:

Member 1: Account Management

Customer registration.

Authentication.

Account dashboard.

Profile and balance.

Statements.

Account status.

Member 2: Fund Transfer and Fraud Detection

Beneficiaries.

Transfer validation.

Fraud scoring.

OTP challenge.

Ledger posting.

Transfer status.

Fraud case management.

Agree on the database schema, API contracts, authentication mechanism, shared UI components, error conventions, and domain interfaces before parallel implementation.

The fund-transfer module must use real account and customer records from Account Management.

Both modules must use the same database and authentication system.

Do not build two separate applications that merely look connected.

Add integration tests demonstrating that:

A registered and verified customer can log in.

The customer can see their actual seeded or created account.

The customer can create and activate a beneficiary.

The customer can initiate a valid transfer.

The risk engine evaluates the transfer.

OTP verification succeeds or fails correctly.

A successful internal transfer produces balanced ledger entries.

An invalid or high-risk transfer is blocked as specified.

Fraud cases appear in the authorized analyst dashboard.

Updated balances and transactions appear immediately in Account Management.

Duplicate requests do not duplicate transfers.

Unauthorized users cannot access another customer's data.

11. Testing and Acceptance Criteria

Write automated tests rather than relying exclusively on manual testing.

Account Management tests

Valid and invalid registration.

Age and field validation.

Duplicate account/identity handling.

Password hashing.

Successful and unsuccessful login.

Five-attempt account lockout.

Session expiry.

KYC gating.

Account ownership authorization.

Balance and statement calculations.

Deactivation restrictions.

Fund Transfer tests

Valid transfer.

Negative, zero, and excessive amount.

Insufficient funds.

Inactive beneficiary.

Cooling-off period.

Per-transaction limit.

Daily cumulative limit.

LOW, MEDIUM, and HIGH fraud scenarios.

OTP success, expiry, and attempt limits.

Balanced ledger posting.

Concurrent transfers.

Duplicate idempotency key.

Settlement success.

Settlement failure and compensating reversal.

Timeout and pending reconciliation.

Fraud case creation and review permissions.

Required completion conditions

No critical runtime errors.

No unhandled API errors in the primary workflows.

Database migrations run successfully.

Seed script works on a clean database.

Both modules work together.

Critical business rules are enforced on the backend.

Automated tests cover financial integrity and authorization.

All primary demonstration scenarios pass.

Run the actual available lint, type-check, test, and build commands. Fix failures caused by the implementation and document any pre-existing unrelated failures.

Never report tests as passing unless they were executed and their results were observed.

12. Demo Mode

Prepare a controlled local demonstration environment.

Include seeded accounts with different balances and statuses, several beneficiaries, a few historical transactions, and test cases that reliably exercise all three fraud bands.

Provide a developer-only mechanism to simulate:

OTP success and failure.

OTP expiry.

LOW/MEDIUM/HIGH risk.

Payment settlement success.

Payment settlement failure.

Payment timeout.

Reconciliation outcomes.

Fraud Analyst review.

These controls must be unavailable to normal customer accounts and must never bypass production authorization or financial-integrity rules.

Document how to reset the database to its original demo state.

13. Required Project Deliverables

Create the following in the repository:

A. Source code

Complete frontend.

Complete backend.

Database schema and migrations.

Seed scripts.

Shared domain types where appropriate.

Automated tests.

Environment configuration example.

B. Documentation

Create a docs/ directory containing:

requirements-traceability.md

uml-to-code-mapping.md

architecture.md

database-design.md

api-documentation.md

testing-report.md

integration-guide.md

demo-script.md

report.md

Preserve the supplied UML diagrams as references when possible. Do not claim newly generated diagrams are identical to the original diagrams unless verified.

C. Screenshots

Create a screenshot checklist and capture genuine screenshots of the running application, where the environment permits:

Landing/login page.

Customer registration.

Account dashboard.

Account details and balance.

Transaction history.

Beneficiary management.

Fund transfer form.

OTP verification.

Successful transfer receipt.

LOW/MEDIUM/HIGH fraud outcomes.

Fraud Analyst case dashboard.

Blocked transfer or frozen account.

Pending settlement and reconciliation.

Database or test output demonstrating ledger integrity.

Use real application screens and genuine test results. Never fabricate screenshots, test results, or successful external integrations.

D. Report

Prepare a college-submission-ready report with:

Title page.

Problem statement.

Objectives.

Scope.

Technology stack.

System architecture.

Class diagram and sequence-diagram mapping.

Use-case and DFD mapping.

Module descriptions.

Database design.

Frontend and backend implementation.

Important algorithms and business rules.

Integration approach.

Testing methodology and actual results.

Screenshots with figure numbers and explanations.

Limitations.

Future scope.

Conclusion.

Use the supplied documents and their terminology as the foundation. Clearly distinguish implemented functionality from simulated external services and planned features.

E. Demo video preparation

Create a docs/demo-script.md with a timed 5–8 minute walkthrough.

Suggested seven-minute plan:

0:00–0:40 — Introduce the OBS problem statement and architecture.

0:40–1:40 — Demonstrate login, account dashboard, and balance.

1:40–2:30 — Demonstrate beneficiary creation and validation.

2:30–4:10 — Demonstrate a successful fund transfer, OTP, and transaction receipt.

4:10–5:20 — Demonstrate different fraud-risk outcomes and a blocked transfer.

5:20–6:15 — Demonstrate fraud case review and audit records.

6:15–7:00 — Demonstrate transaction history, ledger consistency, and test results.

Adapt the timing to the features that genuinely work. Keep the final video within the required 5–8 minute duration.

Do not claim to upload the video to Moodle automatically. Provide the script and recording checklist so the group can record the running application and upload the video themselves.

14. Repository and Development Workflow

Before modifying files:

Inspect the current directory and existing repository.

Identify the existing framework, scripts, dependencies, and conventions.

Inspect the supplied documents.

Prepare a short implementation plan.

Define shared API contracts and database ownership.

Identify which files belong to each module.

Implement incrementally.

Run tests after each major module.

Integrate the modules.

Run end-to-end tests.

Generate the documentation and report assets.

If the repository is already initialized, preserve its Git history, existing useful work, and configuration.

Do not delete existing work or replace the project with a generic template.

If a task is too large for one pass, divide it into implementation phases and complete each phase before proceeding. Do not stop after producing only a plan, wireframes, mock data, or static frontend.

15. Suggested Implementation Phases

Phase 1 — Foundation

Repository inspection.

Requirements traceability.

Project setup.

Database schema.

Authentication.

Shared layout and navigation.

Phase 2 — Account Management

Registration.

Login.

KYC simulation.

Dashboard.

Profile and balance.

Statements.

Tests.

Phase 3 — Fund Transfer

Beneficiaries.

Transfer validation.

OTP workflow.

Transaction ledger.

Transfer receipt.

Tests.

Phase 4 — Fraud Detection

Risk scoring.

Rule configuration.

Fraud cases.

Account freeze.

Fraud Analyst dashboard.

Tests.

Phase 5 — Integration and Reliability

Connect account and transfer modules.

Implement settlement and reconciliation.

Verify authorization.

Test concurrency and idempotency.

Run end-to-end tests.

Phase 6 — Submission Preparation

Capture screenshots.

Generate the report.

Prepare the timed demo script.

Verify installation instructions.

Run the final build and test suite.

16. Final Instructions to Antigravity

Prioritize correctness, completeness, demonstrability, and consistency with the submitted Software Engineering diagrams.

Do not merely describe what should be implemented. Implement it in the actual repository.

Do not substitute static data for core backend functionality.

Do not leave primary workflows as TODOs.

Do not invent UML methods or change class responsibilities without documenting the change.

Do not represent simulated banking, OTP, KYC, or payment services as live integrations.

Do not compromise authentication, authorization, or ledger integrity for a simpler demo.

At completion, provide:

A summary of implemented modules.

The final project directory structure.

Database setup and migration commands.

Exact frontend and backend run commands.

Seeded demo account credentials for local use.

API and environment configuration instructions.

Actual test and build results.

Any incomplete features or known limitations.

Locations of the report, screenshots, and demo script.

A final checklist confirming that the two modules are integrated and ready for a live demonstration.

Definition of done: A student can clone or open the project, configure the environment, initialize the database, start the application, log in with a seeded demo user, demonstrate Account Management and Fund Transfer with Fraud Detection, verify the resulting database records, run the automated tests, and use the generated documentation to prepare the college submission.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bf00551d-3877-40d1-b783-6155d8325fd4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
