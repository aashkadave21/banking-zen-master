<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- All money-moving and privileged writes go through server functions (or security-definer SQL); clients get SELECT-only grants with RLS. Why: financial integrity must be enforced on the backend.
- Ledger and audit tables are immutable (triggers block UPDATE/DELETE); corrections use compensating entries. Why: SRS Transfer.Atomic / audit requirements.
- Validation schemas live in `src/lib/validation.ts` and are shared by forms and server functions. Why: one source of truth for business rules.
- Docs for the college submission live in `docs/`; UML names (post, escalate, review_case, deactivate_account) must be preserved in code. Why: traceability to the supplied diagrams.
