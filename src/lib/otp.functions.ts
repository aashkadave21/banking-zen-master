import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** OTP.generate — creates a 6-digit OTP, stores hashed, logs to console (simulated). */
export const generateOtp = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      purpose: z.enum(["Transfer", "StepUp", "Beneficiary", "NewDevice", "Deactivate"]),
      subject_id: z.string().uuid().optional(),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Simple hash (in production use bcrypt, here we use a basic hash for demo)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(code));
    const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Invalidate any existing OTP for this purpose+subject
    await supabaseAdmin
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("purpose", data.purpose)
      .is("consumed_at", null);

    // Store new OTP
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
    const { data: otp, error } = await supabaseAdmin
      .from("otp_challenges")
      .insert({
        user_id: userId,
        purpose: data.purpose,
        subject_id: data.subject_id ?? null,
        code_hash: codeHash,
        expires_at: expiresAt,
        max_attempts: 3,
      })
      .select("id")
      .single();

    if (error) return { ok: false as const, error: "Failed to generate OTP." };

    // SIMULATED: Log OTP to console (dev mode)
    console.log(`\n📱 [SIMULATED OTP] User: ${userId} | Purpose: ${data.purpose} | Code: ${code} | Expires: ${expiresAt}\n`);

    // Also store in notifications for easy access in the UI
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: `OTP for ${data.purpose}`,
      body: `Your OTP is ${code}. Valid for 5 minutes. (SIMULATED — in production this would be sent via SMS/Email)`,
    });

    return { ok: true as const, otp_id: otp.id, expires_at: expiresAt };
  });

/** OTP.verify — checks the OTP, max 3 attempts, 5-min expiry, single use. */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      otp_id: z.string().uuid(),
      code: z.string().length(6, "OTP must be 6 digits"),
    }).parse(input)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Get OTP challenge
    const { data: otp } = await supabaseAdmin
      .from("otp_challenges")
      .select("*")
      .eq("id", data.otp_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!otp) return { ok: false as const, error: "OTP not found." };
    if (otp.consumed_at) return { ok: false as const, error: "OTP already used." };
    if (new Date(otp.expires_at) < new Date()) return { ok: false as const, error: "OTP expired." };
    if (otp.attempts >= otp.max_attempts) return { ok: false as const, error: "Too many attempts. Request a new OTP." };

    // Hash the input code
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data.code));
    const inputHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (inputHash !== otp.code_hash) {
      // Increment attempts
      await supabaseAdmin
        .from("otp_challenges")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", data.otp_id);

      const remaining = otp.max_attempts - otp.attempts - 1;
      return {
        ok: false as const,
        error: remaining > 0 ? `Invalid OTP. ${remaining} attempt(s) remaining.` : "Too many attempts. Request a new OTP.",
        attempts_remaining: remaining,
      };
    }

    // Mark as consumed
    await supabaseAdmin
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.otp_id);

    return { ok: true as const, purpose: otp.purpose, subject_id: otp.subject_id };
  });
