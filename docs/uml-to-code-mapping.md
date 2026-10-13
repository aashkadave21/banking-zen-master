# UML-to-Code Mapping

| UML element | Implementation | Verification |
|---|---|---|
| User (interface): name, email, mobile_no, login(), logout() | `profiles` table; `signInCustomer` server function; `AppShell.signOut` | Lockout unit tests |
| Customer: customer_id, kyc_status, register(), view_accounts() | `customers` table; `registerCustomer`; `getMyOverview` | Registration validation tests |
| PremiumCustomer: transfer_limit, view_multi_account() | `customers.is_premium`, `transfer_limit`; dashboard account list | Phase 3 limit tests |
| Account (interface): account_number, balance, status, create_account(), deactivate_account(), generate_statement() | `accounts` table; created in `handle_new_user`; deactivate/statement in Phase 2 | Phase 2 |
| Transaction: transaction_id, amount, date, type, post() | `transactions` + `ledger_entries` tables; post() in Phase 3 | Ledger integration tests (Phase 3) |
| FraudCase: case_id, risk_score, risk_band, escalate() | `fraud_cases` table; Phase 4 | Escalation tests (Phase 4) |
| FraudAnalyst: review_case(), tune_rules() | role `fraud_analyst`; `fraud_case_reviews`, `fraud_rules` | Authorization tests (Phase 4) |
| BankAdministrator: configure_limits() | role `bank_admin`; `system_config` | Phase 5 |

Discrepancies and how they were resolved are in `requirements-traceability.md`.
