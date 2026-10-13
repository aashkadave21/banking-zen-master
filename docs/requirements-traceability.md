# Requirement Traceability (Phase 1)

| SRS requirement | Feature | UML class / method | Use case / diagram | Implementation | Status |
|---|---|---|---|---|---|
| Order.Register | Registration form (all mandatory fields) | Customer.register() | Register | `src/routes/register.tsx`, `src/lib/auth.functions.ts#registerCustomer`, DB trigger `handle_new_user` | Done |
| Order.Register.Validate | Email, 10-digit mobile, age ≥ 18, field errors | Customer.register() | Register | `src/lib/validation.ts` (client + server), trigger age check | Done, tested |
| Order.KYC.Submit | KYC record Pending/Verified/Rejected, account non-transacting until Verified | Customer.kyc_status | Register «include» KYC | `kyc_records`, `accounts.status = PendingKYC` | Record done; simulated decision in Phase 2 |
| Order.Login.Auth | Generic failure message | User.login() | Login | `signInCustomer` | Done |
| Order.Login.Lock | 30-min lock after 5 failures | User.login() | Login | `src/lib/lockout.ts`, `login_lockouts` | Done, tested |
| Order.Login.NewDevice | OTP on unrecognised device | User.login() | Login «extend» OTP | `known_devices`, device id sent at login | Phase 2 |
| — | Logout | User.logout() | Logout | `src/components/app-shell.tsx#signOut` | Done |
| Order.Statement.Generate | ≤12-month statement, running balance | Account.generate_statement() | View statement | Schema ready (`ledger_entries.balance_after`) | Phase 2 |
| Order.Deactivate | Zero balance, no loan, no dormancy, OTP | Account.deactivate_account() | Deactivate | Schema flags ready | Phase 2 |
| Transfer.* / Fraud.* | Transfer, limits, OTP, atomic ledger, scoring | Transaction.post(), FraudCase.escalate(), FraudAnalyst.review_case() | Seq. Diagram 1, Activity Diagram | Schema + rule seed ready | Phases 3–5 |

## Recorded discrepancies and resolutions

1. **Freeze vs deactivate.** Sequence Diagram 1 freezes the account through `Account.deactivate_account()`, but SRS Fraud.Irreversible says freezing must be reversible, and Order.Deactivate requires a zero balance. **Resolution:** `deactivate_account(mode)` keeps one UML method with two modes. `mode = "freeze"` (fraud path) sets status `Frozen`, which can be reversed. `mode = "close"` (customer path) applies the Order.Deactivate checks and sets status `Deactivated`.
2. **OTP for LOW-band own-account transfers.** The brief asks for OTP on LOW risk. SRS Transfer.Own and the Activity Diagram say own-account transfers run "immediately, no OTP", and Transfer.OTP limits OTP to third-party transfers. **Resolution:** follow the SRS. Third-party transfers always need OTP; own-account transfers still go through fraud scoring but do not need OTP.
3. **Beneficiary entity.** The class diagram has no Beneficiary class. The DFD defines store D3 Beneficiary. **Resolution:** add a `beneficiaries` table as a persistence entity only (no new UML operations), justified by D3 and Transfer.Beneficiary.Add.
4. **PremiumCustomer.** Modelled as `customers.is_premium` plus `transfer_limit`/`daily_limit` (single-table inheritance).
5. **HIGH-risk case owner.** SRS 3.2 says "raise an administrator case"; SRS 3.5 and the sequence diagram send the case to the Fraud Analyst. **Resolution:** the case goes to the fraud-analyst queue. Bank Administrators can read it.
