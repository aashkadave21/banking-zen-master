import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin.getLimits — view current system limits. */
export const getSystemLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some(r => r.role === "bank_admin")) {
      return { error: "Access denied." };
    }
    const { data: configs } = await supabase.from("system_config").select("*");
    return { configs: configs ?? [] };
  });

/** Admin.updateConfig — update system config values. */
export const updateSystemConfig = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      key: z.string(),
      value: z.record(z.unknown()),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some(r => r.role === "bank_admin")) {
      return { ok: false as const, error: "Only admins can update config." };
    }

    const { error } = await supabaseAdmin.from("system_config").update({
      value: data.value,
      updated_at: new Date().toISOString(),
    }).eq("key", data.key);

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "CONFIG_UPDATED",
      entity: "system_config",
      entity_id: data.key,
      details: { value: data.value },
    });

    return { ok: true as const, message: "Config updated." };
  });

/** Admin.getPendingSettlements — list transactions pending reconciliation. */
export const getPendingSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some(r => r.role === "bank_admin")) {
      return { settlements: [], error: "Access denied." };
    }

    const { data: settlements } = await supabase
      .from("settlement_records")
      .select("*, transactions(reference, amount, type, remarks, status, created_at)")
      .in("status", ["Submitted", "Timeout"])
      .order("submitted_at", { ascending: true });

    return { settlements: settlements ?? [] };
  });

/** Admin.reconcile — resolve a pending settlement. */
export const reconcileSettlement = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      settlement_id: z.string().uuid(),
      outcome: z.enum(["Settled", "Failed"]),
      note: z.string().max(500).optional(),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some(r => r.role === "bank_admin")) {
      return { ok: false as const, error: "Only admins can reconcile." };
    }

    // Get settlement
    const { data: settlement } = await supabaseAdmin
      .from("settlement_records")
      .select("*, transactions(id, source_account_id, dest_account_id, amount, status)")
      .eq("id", data.settlement_id)
      .single();

    if (!settlement) return { ok: false as const, error: "Settlement not found." };
    if (settlement.status === "Reconciled" || settlement.status === "Settled") {
      return { ok: false as const, error: "Already reconciled." };
    }

    const txn = settlement.transactions as { id: string; source_account_id: string; dest_account_id: string | null; amount: number; status: string };

    if (data.outcome === "Settled") {
      // Mark settled
      await supabaseAdmin.from("settlement_records").update({
        status: "Reconciled",
        outcome_note: data.note ?? "Admin reconciled as settled",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      }).eq("id", data.settlement_id);

      await supabaseAdmin.from("transactions").update({
        status: "Settled",
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);
    } else {
      // Failed — post reversal
      const { data: source } = await supabaseAdmin
        .from("accounts")
        .select("id, balance")
        .eq("id", txn.source_account_id)
        .single();

      if (source) {
        const newBalance = Number(source.balance) + Number(txn.amount);
        await supabaseAdmin.from("accounts").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", source.id);

        await supabaseAdmin.from("ledger_entries").insert({
          transaction_id: txn.id,
          account_id: source.id,
          entry_type: "CREDIT",
          amount: txn.amount,
          balance_after: newBalance,
          narration: "Reversal — settlement failed",
        });
      }

      await supabaseAdmin.from("settlement_records").update({
        status: "Failed",
        outcome_note: data.note ?? "Admin reconciled as failed — reversed",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      }).eq("id", data.settlement_id);

      await supabaseAdmin.from("transactions").update({
        status: "Reversed",
        failure_reason: "Settlement failed — reversed by admin",
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "SETTLEMENT_RECONCILED",
      entity: "settlement",
      entity_id: data.settlement_id,
      details: { outcome: data.outcome, note: data.note },
    });

    return { ok: true as const, message: `Settlement ${data.outcome === "Settled" ? "reconciled" : "reversed"}.` };
  });
