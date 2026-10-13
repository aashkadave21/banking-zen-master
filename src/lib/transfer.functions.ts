import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const transferSchema = z.object({
  source_account_id: z.string().uuid(),
  transfer_type: z.enum(["Own", "Beneficiary"]),
  dest_account_id: z.string().uuid().optional(),
  beneficiary_id: z.string().uuid().optional(),
  amount: z.number().positive("Amount must be positive"),
  remarks: z.string().max(200).optional(),
  idempotency_key: z.string().min(1).max(100),
});

/** Generate a unique transaction reference */
function generateRef() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${date}${rand}`;
}

/** Transaction.list — recent transactions for the logged-in customer. */
export const getMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { transactions: [] };

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("initiated_by", customer.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return { transactions: transactions ?? [] };
  });

/** Transfer — handles both own-account and beneficiary transfers. */
export const initiateTransfer = createServerFn({ method: "POST" })
  .validator((input: unknown) => transferSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Get customer
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, transfer_limit, daily_limit, is_premium")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { ok: false as const, error: "Customer not found." };

    // Check idempotency
    const { data: existingTxn } = await supabaseAdmin
      .from("transactions")
      .select("id, reference, status")
      .eq("initiated_by", customer.id)
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();
    if (existingTxn) {
      return { ok: true as const, transaction_id: existingTxn.id, reference: existingTxn.reference, status: existingTxn.status, message: "Duplicate request — returning original result." };
    }

    // Validate source account — ownership + status
    const { data: source } = await supabaseAdmin
      .from("accounts")
      .select("id, balance, status, min_balance, account_type, customer_id")
      .eq("id", data.source_account_id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!source) return { ok: false as const, error: "Source account not found or not yours." };
    if (source.status !== "Active") return { ok: false as const, error: `Source account is ${source.status}. Only Active accounts can transfer.` };

    // Check min balance
    const availableBalance = Number(source.balance) - Number(source.min_balance);
    if (data.amount > availableBalance) {
      return { ok: false as const, error: `Insufficient funds. Available balance (after minimum balance): ₹${availableBalance.toFixed(2)}.` };
    }

    // Per-transaction limit
    if (data.amount > Number(customer.transfer_limit)) {
      return { ok: false as const, error: `Amount exceeds per-transaction limit of ₹${Number(customer.transfer_limit).toFixed(2)}.` };
    }

    // Daily limit check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayTxns } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("initiated_by", customer.id)
      .gte("created_at", todayStart.toISOString())
      .in("status", ["Initiated", "AwaitingOTP", "Posted", "Pending", "Settled"]);

    const todayTotal = (todayTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
    if (todayTotal + data.amount > Number(customer.daily_limit)) {
      return { ok: false as const, error: `Daily limit exceeded. Used: ₹${todayTotal.toFixed(2)} / ₹${Number(customer.daily_limit).toFixed(2)}.` };
    }

    // === OWN ACCOUNT TRANSFER ===
    if (data.transfer_type === "Own") {
      if (!data.dest_account_id) return { ok: false as const, error: "Destination account required." };

      const { data: dest } = await supabaseAdmin
        .from("accounts")
        .select("id, balance, status, customer_id")
        .eq("id", data.dest_account_id)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (!dest) return { ok: false as const, error: "Destination account not found or not yours." };
      if (dest.status !== "Active") return { ok: false as const, error: `Destination account is ${dest.status}.` };
      if (dest.id === source.id) return { ok: false as const, error: "Cannot transfer to the same account." };

      const reference = generateRef();
      const newSourceBalance = Number(source.balance) - data.amount;
      const newDestBalance = Number(dest.balance) + data.amount;

      // Create transaction
      const { data: txn, error: txnErr } = await supabaseAdmin
        .from("transactions")
        .insert({
          reference,
          idempotency_key: data.idempotency_key,
          initiated_by: customer.id,
          source_account_id: source.id,
          dest_account_id: dest.id,
          type: "Own",
          amount: data.amount,
          remarks: data.remarks ?? `Own transfer to ${dest.id.slice(-4)}`,
          status: "Posted",
          risk_score: 0,
          risk_band: "LOW",
          posted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (txnErr) return { ok: false as const, error: txnErr.message };

      // Update balances
      await supabaseAdmin.from("accounts").update({ balance: newSourceBalance, updated_at: new Date().toISOString() }).eq("id", source.id);
      await supabaseAdmin.from("accounts").update({ balance: newDestBalance, updated_at: new Date().toISOString() }).eq("id", dest.id);

      // Ledger entries
      await supabaseAdmin.from("ledger_entries").insert([
        { transaction_id: txn.id, account_id: source.id, entry_type: "DEBIT", amount: data.amount, balance_after: newSourceBalance, narration: `Own transfer to XXXX${dest.id.slice(-4)}` },
        { transaction_id: txn.id, account_id: dest.id, entry_type: "CREDIT", amount: data.amount, balance_after: newDestBalance, narration: `Own transfer from XXXX${source.id.slice(-4)}` },
      ]);

      // Audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "TRANSFER_OWN",
        entity: "transaction",
        entity_id: txn.id,
        details: { reference, amount: data.amount, source: source.id, dest: dest.id },
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: "Transfer successful",
        body: `₹${data.amount.toFixed(2)} transferred between your own accounts. Ref: ${reference}`,
      });

      return { ok: true as const, transaction_id: txn.id, reference, status: "Posted", message: "Transfer completed successfully." };
    }

    // === BENEFICIARY TRANSFER ===
    if (data.transfer_type === "Beneficiary") {
      if (!data.beneficiary_id) return { ok: false as const, error: "Beneficiary required." };

      const { data: ben } = await supabaseAdmin
        .from("beneficiaries")
        .select("id, is_active, cooling_off_until, beneficiary_name, account_number")
        .eq("id", data.beneficiary_id)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (!ben) return { ok: false as const, error: "Beneficiary not found." };
      if (!ben.is_active) return { ok: false as const, error: "Beneficiary is not active. Please activate first." };
      if (ben.cooling_off_until && new Date(ben.cooling_off_until) > new Date()) {
        return { ok: false as const, error: `Beneficiary is in cooling-off period until ${new Date(ben.cooling_off_until).toLocaleString()}. Please wait.` };
      }

      // Check if internal beneficiary
      const { data: destAccount } = await supabaseAdmin
        .from("accounts")
        .select("id, balance, status")
        .eq("account_number", ben.account_number)
        .maybeSingle();

      const reference = generateRef();

      // Create transaction as Initiated (needs OTP)
      const { data: txn, error: txnErr } = await supabaseAdmin
        .from("transactions")
        .insert({
          reference,
          idempotency_key: data.idempotency_key,
          initiated_by: customer.id,
          source_account_id: source.id,
          dest_account_id: destAccount?.id ?? null,
          beneficiary_id: ben.id,
          type: "Beneficiary",
          amount: data.amount,
          remarks: data.remarks ?? `Transfer to ${ben.beneficiary_name}`,
          status: "AwaitingOTP",
          risk_score: 0,
          risk_band: "LOW",
        })
        .select("id")
        .single();

      if (txnErr) return { ok: false as const, error: txnErr.message };

      // Audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "TRANSFER_INITIATED",
        entity: "transaction",
        entity_id: txn.id,
        details: { reference, amount: data.amount, beneficiary: ben.beneficiary_name },
      });

      return {
        ok: true as const,
        transaction_id: txn.id,
        reference,
        status: "AwaitingOTP",
        requires_otp: true,
        message: "Transfer initiated. Please verify with OTP.",
      };
    }

    return { ok: false as const, error: "Invalid transfer type." };
  });

/** Transfer.complete — called after OTP verification to post the beneficiary transfer. */
export const completeTransfer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ transaction_id: z.string().uuid() }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { ok: false as const, error: "Customer not found." };

    // Get transaction
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", data.transaction_id)
      .eq("initiated_by", customer.id)
      .maybeSingle();

    if (!txn) return { ok: false as const, error: "Transaction not found." };
    if (txn.status !== "AwaitingOTP") return { ok: false as const, error: `Transaction is ${txn.status}, not awaiting OTP.` };

    // Get source account
    const { data: source } = await supabaseAdmin
      .from("accounts")
      .select("id, balance, min_balance, status")
      .eq("id", txn.source_account_id)
      .single();

    if (!source || source.status !== "Active") {
      await supabaseAdmin.from("transactions").update({ status: "Failed", failure_reason: "Source account no longer active", updated_at: new Date().toISOString() }).eq("id", txn.id);
      return { ok: false as const, error: "Source account is no longer active." };
    }

    // Re-check balance
    const available = Number(source.balance) - Number(source.min_balance);
    if (Number(txn.amount) > available) {
      await supabaseAdmin.from("transactions").update({ status: "Failed", failure_reason: "Insufficient funds", updated_at: new Date().toISOString() }).eq("id", txn.id);
      return { ok: false as const, error: "Insufficient funds." };
    }

    const newSourceBalance = Number(source.balance) - Number(txn.amount);

    // Debit source
    await supabaseAdmin.from("accounts").update({ balance: newSourceBalance, updated_at: new Date().toISOString() }).eq("id", source.id);

    // Credit destination if internal
    let newDestBalance: number | null = null;
    if (txn.dest_account_id) {
      const { data: dest } = await supabaseAdmin
        .from("accounts")
        .select("id, balance")
        .eq("id", txn.dest_account_id)
        .single();
      if (dest) {
        newDestBalance = Number(dest.balance) + Number(txn.amount);
        await supabaseAdmin.from("accounts").update({ balance: newDestBalance, updated_at: new Date().toISOString() }).eq("id", dest.id);
      }
    }

    // Ledger entries
    const ledgerEntries: Array<Record<string, unknown>> = [
      { transaction_id: txn.id, account_id: source.id, entry_type: "DEBIT", amount: txn.amount, balance_after: newSourceBalance, narration: txn.remarks ?? "Beneficiary transfer" },
    ];
    if (txn.dest_account_id && newDestBalance !== null) {
      ledgerEntries.push({ transaction_id: txn.id, account_id: txn.dest_account_id, entry_type: "CREDIT", amount: txn.amount, balance_after: newDestBalance, narration: `Credit from ${txn.reference}` });
    } else {
      // External — credit to clearing/settlement
      ledgerEntries.push({ transaction_id: txn.id, account_id: null, ledger_code: "CLEARING", entry_type: "CREDIT", amount: txn.amount, balance_after: null, narration: `Settlement for ${txn.reference}` });
    }
    await supabaseAdmin.from("ledger_entries").insert(ledgerEntries);

    // Update transaction
    await supabaseAdmin.from("transactions").update({
      status: "Posted",
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", txn.id);

    // Settlement record
    await supabaseAdmin.from("settlement_records").insert({
      transaction_id: txn.id,
      idempotency_key: txn.idempotency_key,
      status: txn.dest_account_id ? "Settled" : "Submitted",
    });

    // Audit + notification
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "TRANSFER_POSTED",
      entity: "transaction",
      entity_id: txn.id,
      details: { reference: txn.reference, amount: txn.amount },
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Transfer successful",
      body: `₹${Number(txn.amount).toFixed(2)} transferred. Ref: ${txn.reference}`,
    });

    return { ok: true as const, transaction_id: txn.id, reference: txn.reference, status: "Posted", message: "Transfer completed successfully." };
  });
