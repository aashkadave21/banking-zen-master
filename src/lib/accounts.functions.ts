import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Account.list — returns all accounts for the logged-in customer. */
export const getMyAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!customer) return { accounts: [] };

    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, account_number, account_type, balance, status, min_balance, created_at")
      .eq("customer_id", customer.id)
      .order("created_at");

    return { accounts: accounts ?? [] };
  });

/** Account.deactivate_account(reason) — allowed only when balance is zero, no open loan/dormancy, status is Active. */
export const deactivateAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      account_id: z.string().uuid(),
      reason: z.string().min(5, "Provide a reason").max(500),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Get customer
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { ok: false as const, error: "Customer not found." };

    // Get account — ownership check
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("id, balance, status, has_open_loan, has_open_dormancy_case")
      .eq("id", data.account_id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!account) return { ok: false as const, error: "Account not found or not yours." };
    if (account.status !== "Active") return { ok: false as const, error: `Cannot deactivate: account status is ${account.status}.` };
    if (Number(account.balance) !== 0) return { ok: false as const, error: "Cannot deactivate: balance must be zero." };
    if (account.has_open_loan) return { ok: false as const, error: "Cannot deactivate: account has an open loan." };
    if (account.has_open_dormancy_case) return { ok: false as const, error: "Cannot deactivate: account has a dormancy flag." };

    // Deactivate
    const { error } = await supabaseAdmin
      .from("accounts")
      .update({ status: "Deactivated", updated_at: new Date().toISOString() })
      .eq("id", data.account_id);

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "ACCOUNT_DEACTIVATED",
      entity: "account",
      entity_id: data.account_id,
      details: { reason: data.reason },
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Account deactivated",
      body: `Your account ending ${account.id.slice(-4)} has been deactivated. Reason: ${data.reason}`,
    });

    return { ok: true as const, message: "Account deactivated successfully." };
  });

/** Account.freeze — used by fraud engine to freeze an account (FRAUD_FREEZE). No balance check. */
export const freezeAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      account_id: z.string().uuid(),
      reason: z.string().default("FRAUD_FREEZE"),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("accounts")
      .update({ status: "Frozen", updated_at: new Date().toISOString() })
      .eq("id", data.account_id);

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "ACCOUNT_FROZEN",
      entity: "account",
      entity_id: data.account_id,
      details: { reason: data.reason },
    });

    return { ok: true as const };
  });
