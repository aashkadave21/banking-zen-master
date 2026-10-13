import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** KYC.simulate — simulated KYC verification. Auto-approves unless full_name contains "REJECT". */
export const simulateKycVerification = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ customer_id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Get customer — ownership check
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, kyc_status")
      .eq("id", data.customer_id)
      .maybeSingle();

    if (!customer) return { ok: false as const, error: "Customer not found." };
    if (customer.user_id !== userId) return { ok: false as const, error: "Not your customer record." };
    if (customer.kyc_status !== "Pending") {
      return { ok: false as const, error: `KYC already ${customer.kyc_status}.` };
    }

    // Get profile name to decide KYC outcome
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const shouldReject = profile?.full_name?.toUpperCase().includes("REJECT");
    const newStatus = shouldReject ? "Rejected" : "Verified";

    // Update KYC record
    await supabaseAdmin
      .from("kyc_records")
      .update({
        status: newStatus,
        remarks: shouldReject
          ? "SIMULATED: Name flagged for rejection"
          : "SIMULATED: Auto-verified by simulated KYC provider",
        decided_at: new Date().toISOString(),
      })
      .eq("customer_id", data.customer_id);

    // Update customer kyc_status
    await supabaseAdmin
      .from("customers")
      .update({ kyc_status: newStatus })
      .eq("id", data.customer_id);

    // If verified, activate the account(s)
    if (!shouldReject) {
      await supabaseAdmin
        .from("accounts")
        .update({ status: "Active", updated_at: new Date().toISOString() })
        .eq("customer_id", data.customer_id)
        .eq("status", "PendingKYC");
    }

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: shouldReject ? "KYC_REJECTED" : "KYC_VERIFIED",
      entity: "kyc",
      entity_id: data.customer_id,
      details: { provider: "SIMULATED-KYC", status: newStatus },
    });

    // Notification
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: shouldReject ? "KYC verification failed" : "KYC verified — account activated!",
      body: shouldReject
        ? "Your KYC verification has been rejected by the simulated provider. Please contact support."
        : "Your KYC has been verified and your account is now active. You can start transacting.",
    });

    return {
      ok: true as const,
      status: newStatus,
      message: shouldReject
        ? "KYC rejected by simulated provider."
        : "KYC verified. Account is now active!",
    };
  });
