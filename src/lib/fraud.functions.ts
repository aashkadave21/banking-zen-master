import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** FraudEngine.score(txn) — scores a transaction 0-100 based on triggered rules. */
export async function scoreTxn(
  supabaseAdmin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  txn: { id: string; amount: number; source_account_id: string; beneficiary_id: string | null; initiated_by: string },
) {
  // Get enabled rules
  const { data: rules } = await supabaseAdmin
    .from("fraud_rules")
    .select("*")
    .eq("enabled", true);

  if (!rules || rules.length === 0) return { score: 0, band: "LOW" as const, triggered: [] };

  // Get customer limits
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("transfer_limit, daily_limit")
    .eq("id", txn.initiated_by)
    .single();

  const perTxnLimit = Number(customer?.transfer_limit ?? 200000);
  const triggered: Array<{ code: string; name: string; weight: number; detail: string }> = [];

  for (const rule of rules) {
    switch (rule.code) {
      case "LARGE_AMOUNT": {
        const threshold = rule.params?.threshold ?? perTxnLimit * 0.5;
        if (txn.amount >= threshold) {
          triggered.push({ code: rule.code, name: rule.name, weight: rule.weight, detail: `Amount ₹${txn.amount} >= threshold ₹${threshold}` });
        }
        break;
      }
      case "VELOCITY": {
        const windowMin = rule.params?.window_minutes ?? 10;
        const countThreshold = rule.params?.count ?? 3;
        const since = new Date(Date.now() - windowMin * 60000).toISOString();
        const { count } = await supabaseAdmin
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("source_account_id", txn.source_account_id)
          .gte("created_at", since);
        if ((count ?? 0) >= countThreshold) {
          triggered.push({ code: rule.code, name: rule.name, weight: rule.weight, detail: `${count} transfers in ${windowMin} min` });
        }
        break;
      }
      case "NEW_BENEFICIARY": {
        if (txn.beneficiary_id) {
          const withinHours = rule.params?.within_hours ?? 24;
          const { data: ben } = await supabaseAdmin
            .from("beneficiaries")
            .select("activated_at")
            .eq("id", txn.beneficiary_id)
            .single();
          if (ben?.activated_at) {
            const hoursAgo = (Date.now() - new Date(ben.activated_at).getTime()) / 3600000;
            if (hoursAgo < withinHours) {
              triggered.push({ code: rule.code, name: rule.name, weight: rule.weight, detail: `Activated ${hoursAgo.toFixed(1)}h ago` });
            }
          }
        }
        break;
      }
      case "HIGH_FREQUENCY": {
        const countMax = rule.params?.count ?? 6;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabaseAdmin
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("initiated_by", txn.initiated_by)
          .gte("created_at", todayStart.toISOString());
        if ((count ?? 0) >= countMax) {
          triggered.push({ code: rule.code, name: rule.name, weight: rule.weight, detail: `${count} transfers today` });
        }
        break;
      }
      case "BALANCE_DRAIN": {
        const ratio = rule.params?.ratio ?? 0.9;
        const { data: acct } = await supabaseAdmin
          .from("accounts")
          .select("balance")
          .eq("id", txn.source_account_id)
          .single();
        if (acct && txn.amount >= Number(acct.balance) * ratio) {
          triggered.push({ code: rule.code, name: rule.name, weight: rule.weight, detail: `Would use ${((txn.amount / Number(acct.balance)) * 100).toFixed(0)}% of balance` });
        }
        break;
      }
      default:
        break;
    }
  }

  const rawScore = triggered.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.min(rawScore, 100);

  // Get risk band thresholds
  const { data: bandConfig } = await supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", "risk_bands")
    .single();
  const lowMax = bandConfig?.value?.low_max ?? 39;
  const medMax = bandConfig?.value?.medium_max ?? 79;

  const band = score <= lowMax ? "LOW" : score <= medMax ? "MEDIUM" : "HIGH";

  return { score, band: band as "LOW" | "MEDIUM" | "HIGH", triggered };
}

/** FraudCase.escalate() — creates a fraud case for HIGH-risk transactions. */
export async function escalateToFraudCase(
  supabaseAdmin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  txnId: string,
  accountId: string,
  score: number,
  band: string,
  triggeredRules: unknown[],
) {
  const caseId = "FC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  await supabaseAdmin.from("fraud_cases").insert({
    case_id: caseId,
    transaction_id: txnId,
    account_id: accountId,
    risk_score: score,
    risk_band: band,
    triggered_rules: triggeredRules,
    status: "Open",
    escalation_history: [{ event: "ESCALATED", timestamp: new Date().toISOString(), detail: `Auto-escalated: score ${score}, band ${band}` }],
  });

  return caseId;
}

/** FraudCase.list — analyst view of all fraud cases. */
export const getFraudCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Check role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = (roles ?? []).map(r => r.role);
    if (!userRoles.includes("fraud_analyst") && !userRoles.includes("bank_admin")) {
      return { cases: [], error: "Access denied." };
    }

    const { data: cases } = await supabase
      .from("fraud_cases")
      .select("*, transactions(reference, amount, type, remarks, created_at)")
      .order("created_at", { ascending: false });

    return { cases: cases ?? [] };
  });

/** FraudAnalyst.review_case(caseId, decision, remarks) */
export const reviewFraudCase = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      case_id: z.string().uuid(),
      decision: z.enum(["ConfirmedFraud", "FalsePositive", "Closed"]),
      remarks: z.string().min(20, "Remarks must be at least 20 characters").max(1000),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Verify analyst role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = (roles ?? []).map(r => r.role);
    if (!userRoles.includes("fraud_analyst") && !userRoles.includes("bank_admin")) {
      return { ok: false as const, error: "Only fraud analysts can review cases." };
    }

    // Get case
    const { data: fraudCase } = await supabaseAdmin
      .from("fraud_cases")
      .select("*, transactions(source_account_id)")
      .eq("id", data.case_id)
      .single();

    if (!fraudCase) return { ok: false as const, error: "Case not found." };
    if (fraudCase.status === "ConfirmedFraud" || fraudCase.status === "Closed") {
      return { ok: false as const, error: `Case is already ${fraudCase.status}.` };
    }

    // Create review
    await supabaseAdmin.from("fraud_case_reviews").insert({
      case_id: data.case_id,
      analyst_id: userId,
      decision: data.decision,
      remarks: data.remarks,
    });

    // Update case
    const history = fraudCase.escalation_history as unknown[];
    history.push({
      event: "REVIEWED",
      timestamp: new Date().toISOString(),
      analyst_id: userId,
      decision: data.decision,
      remarks: data.remarks,
    });

    await supabaseAdmin.from("fraud_cases").update({
      status: data.decision,
      assigned_analyst: userId,
      escalation_history: history,
      updated_at: new Date().toISOString(),
    }).eq("id", data.case_id);

    // If FalsePositive/Closed, unfreeze the account
    if (data.decision === "FalsePositive" || data.decision === "Closed") {
      await supabaseAdmin.from("accounts").update({
        status: "Active",
        updated_at: new Date().toISOString(),
      }).eq("id", fraudCase.account_id);

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "ACCOUNT_UNFROZEN",
        entity: "account",
        entity_id: fraudCase.account_id,
        details: { reason: `Fraud case ${fraudCase.case_id} ${data.decision}`, remarks: data.remarks },
      });
    }

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "FRAUD_CASE_REVIEWED",
      entity: "fraud_case",
      entity_id: data.case_id,
      details: { decision: data.decision, remarks: data.remarks },
    });

    return { ok: true as const, message: `Case marked as ${data.decision}.` };
  });

/** FraudRules — admin can view/update rules */
export const getFraudRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const userRoles = (roles ?? []).map(r => r.role);
    if (!userRoles.includes("bank_admin") && !userRoles.includes("fraud_analyst")) {
      return { rules: [], error: "Access denied." };
    }
    const { data: rules } = await supabase.from("fraud_rules").select("*").order("code");
    return { rules: rules ?? [] };
  });

export const updateFraudRule = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      rule_id: z.string().uuid(),
      weight: z.number().int().min(0).max(100),
      enabled: z.boolean(),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Only admin
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some(r => r.role === "bank_admin")) {
      return { ok: false as const, error: "Only bank admins can update fraud rules." };
    }

    const { error } = await supabaseAdmin.from("fraud_rules").update({
      weight: data.weight,
      enabled: data.enabled,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq("id", data.rule_id);

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "FRAUD_RULE_UPDATED",
      entity: "fraud_rule",
      entity_id: data.rule_id,
      details: { weight: data.weight, enabled: data.enabled },
    });

    return { ok: true as const, message: "Rule updated." };
  });
