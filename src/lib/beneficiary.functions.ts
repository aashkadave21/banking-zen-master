import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addBeneficiarySchema = z.object({
  nickname: z.string().trim().min(2, "Nickname required").max(50),
  beneficiary_name: z.string().trim().min(3, "Name required").max(100),
  account_number: z.string().regex(/^[0-9]{9,18}$/, "9-18 digit account number"),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
});

/** Beneficiary.list — returns all beneficiaries for the logged-in customer. */
export const getMyBeneficiaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) return { beneficiaries: [] };

    const { data: beneficiaries } = await supabase
      .from("beneficiaries")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    return { beneficiaries: beneficiaries ?? [] };
  });

/** Beneficiary.add — creates a new beneficiary in PENDING status. Requires OTP activation. */
export const addBeneficiary = createServerFn({ method: "POST" })
  .validator((input: unknown) => addBeneficiarySchema.parse(input))
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

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("beneficiaries")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("account_number", data.account_number)
      .eq("ifsc", data.ifsc)
      .limit(1);

    if (existing && existing.length > 0) {
      return { ok: false as const, error: "This beneficiary already exists." };
    }

    // Check if it's an internal OBS account
    const { data: internalAccount } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("account_number", data.account_number)
      .maybeSingle();

    const { data: beneficiary, error } = await supabaseAdmin
      .from("beneficiaries")
      .insert({
        customer_id: customer.id,
        nickname: data.nickname,
        beneficiary_name: data.beneficiary_name,
        account_number: data.account_number,
        ifsc: data.ifsc,
        is_active: false,
      })
      .select("id")
      .single();

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "BENEFICIARY_ADDED",
      entity: "beneficiary",
      entity_id: beneficiary.id,
      details: { ...data, is_internal: !!internalAccount },
    });

    return { ok: true as const, beneficiary_id: beneficiary.id };
  });

/** Beneficiary.activate — after OTP verified, set cooling-off period then activate. */
export const activateBeneficiary = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ beneficiary_id: z.string().uuid() }).parse(input)
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

    const { data: ben } = await supabaseAdmin
      .from("beneficiaries")
      .select("id, is_active, customer_id")
      .eq("id", data.beneficiary_id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!ben) return { ok: false as const, error: "Beneficiary not found." };
    if (ben.is_active) return { ok: false as const, error: "Already active." };

    // Get cooling-off config (default 30 minutes for demo)
    const { data: config } = await supabaseAdmin
      .from("system_config")
      .select("value")
      .eq("key", "beneficiary")
      .single();
    const coolingMinutes = ((config?.value as any)?.cooling_off_minutes as number) ?? 30;

    const coolUntil = new Date(Date.now() + coolingMinutes * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("beneficiaries")
      .update({
        is_active: true,
        activated_at: new Date().toISOString(),
        cooling_off_until: coolUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.beneficiary_id);

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "BENEFICIARY_ACTIVATED",
      entity: "beneficiary",
      entity_id: data.beneficiary_id,
      details: { cooling_off_until: coolUntil },
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Beneficiary activated",
      body: `Your beneficiary has been activated. Cooling-off period ends at ${new Date(coolUntil).toLocaleString()}.`,
    });

    return { ok: true as const, cooling_off_until: coolUntil };
  });

/** Beneficiary.update — update nickname/name only. */
export const updateBeneficiary = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      beneficiary_id: z.string().uuid(),
      nickname: z.string().trim().min(2).max(50).optional(),
      beneficiary_name: z.string().trim().min(3).max(100).optional(),
    }).parse(input)
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

    const updates: Record<string, string> = {};
    if (data["nickname"]) updates["nickname"] = data["nickname"];
    if (data["beneficiary_name"]) updates["beneficiary_name"] = data["beneficiary_name"];

    if (Object.keys(updates).length === 0) {
      return { ok: true as const, message: "No changes." };
    }

    const { error } = await supabaseAdmin
      .from("beneficiaries")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", data.beneficiary_id)
      .eq("customer_id", customer.id);

    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, message: "Beneficiary updated." };
  });
