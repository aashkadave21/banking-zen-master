import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { passwordSchema } from "./validation";

const updateProfileSchema = z.object({
  address: z.string().trim().min(10, "Enter your full address").max(300).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255).optional(),
  mobile_no: z.string().regex(/^[0-9]{10}$/, "Enter a 10-digit mobile number").optional(),
});

/** Profile.update — customers may edit permitted fields only. Each change is audited. */
export const updateProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateProfileSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Fetch current profile for audit diff
    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("email, mobile_no, address")
      .eq("id", userId)
      .single();

    if (!current) return { ok: false as const, error: "Profile not found." };

    const updates: Record<string, string> = {};
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    if (data["address"] !== undefined && data["address"] !== current.address) {
      updates["address"] = data["address"];
      before["address"] = current.address ?? "";
      after["address"] = data["address"];
    }
    if (data["email"] !== undefined && data["email"] !== current.email) {
      // Check uniqueness
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data["email"])
        .neq("id", userId)
        .limit(1);
      if (existing && existing.length > 0) {
        return { ok: false as const, error: "This email is already registered." };
      }
      updates["email"] = data["email"];
      before["email"] = current.email;
      after["email"] = data["email"];
    }
    if (data["mobile_no"] !== undefined && data["mobile_no"] !== current.mobile_no) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("mobile_no", data["mobile_no"])
        .neq("id", userId)
        .limit(1);
      if (existing && existing.length > 0) {
        return { ok: false as const, error: "This mobile number is already registered." };
      }
      updates["mobile_no"] = data["mobile_no"];
      before["mobile_no"] = current.mobile_no;
      after["mobile_no"] = data["mobile_no"];
    }

    if (Object.keys(updates).length === 0) {
      return { ok: true as const, message: "No changes to save." };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) return { ok: false as const, error: error.message };

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "PROFILE_UPDATED",
      entity: "profile",
      entity_id: userId,
      details: { before, after },
    });

    return { ok: true as const, message: "Profile updated successfully." };
  });

/** Profile.changePassword — validates new password, updates via Supabase auth. */
export const changePassword = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ password: passwordSchema }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
    });

    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "PASSWORD_CHANGED",
      entity: "profile",
      entity_id: userId,
      details: {},
    });

    return { ok: true as const, message: "Password changed successfully." };
  });
