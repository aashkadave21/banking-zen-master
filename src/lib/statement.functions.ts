import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statementSchema = z.object({
  account_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format"),
});

/** Account.generate_statement() — date-range filter, max 12 months, with running balance. */
export const getStatement = createServerFn({ method: "GET" })
  .validator((input: unknown) => statementSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validate date range <= 12 months
    const fromDate = new Date(data.from);
    const toDate = new Date(data.to);
    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return { ok: false as const, error: "From date must be before To date." };
    if (diffDays > 366) return { ok: false as const, error: "Statement range cannot exceed 12 months." };

    // Ownership check
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { ok: false as const, error: "Customer not found." };

    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_number, account_type, balance, status")
      .eq("id", data.account_id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (!account) return { ok: false as const, error: "Account not found or not yours." };

    // Get opening balance: balance_after of the last ledger entry before 'from' date
    const { data: priorEntry } = await supabase
      .from("ledger_entries")
      .select("balance_after")
      .eq("account_id", data.account_id)
      .lt("created_at", data.from + "T00:00:00Z")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const openingBalance = priorEntry?.balance_after ?? 0;

    // Get ledger entries in range
    const { data: entries } = await supabase
      .from("ledger_entries")
      .select("id, transaction_id, entry_type, amount, balance_after, narration, created_at")
      .eq("account_id", data.account_id)
      .gte("created_at", data.from + "T00:00:00Z")
      .lte("created_at", data.to + "T23:59:59Z")
      .order("created_at", { ascending: true });

    // Compute running balance
    let running = Number(openingBalance);
    const rows = (entries ?? []).map((e) => {
      if (e.entry_type === "DEBIT") {
        running -= Number(e.amount);
      } else {
        running += Number(e.amount);
      }
      return {
        ...e,
        running_balance: running,
      };
    });

    return {
      ok: true as const,
      account,
      opening_balance: Number(openingBalance),
      closing_balance: running,
      entries: rows,
      from: data.from,
      to: data.to,
    };
  });
