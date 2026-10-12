import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loginSchema, registrationSchema } from "./validation";
import { afterFailure, GENERIC_LOGIN_ERROR, isLocked, LOCKED_ERROR } from "./lockout";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Customer.register() — validates on the server, then creates the identity; the DB trigger creates Customer, Account and KYC record. */
export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registrationSchema.extend({ origin: z.string().url().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`email.eq.${data.email},mobile_no.eq.${data.mobile_no}`)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: false as const, error: "An account already exists with this email or mobile number." };
    }
    const origin = data.origin;
    const { data: res, error } = await publicClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: origin,
        data: {
          kind: "customer",
          full_name: data.full_name,
          date_of_birth: data.date_of_birth,
          address: data.address,
          mobile_no: data.mobile_no,
          account_type: data.account_type,
        },
      },
    });
    if (error || !res.user) return { ok: false as const, error: error?.message ?? "Registration failed." };
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .select("customer_id, kyc_records(reference_no)")
      .eq("user_id", res.user.id)
      .maybeSingle();
    return {
      ok: true as const,
      customerId: cust?.customer_id ?? null,
      kycReference: (cust?.kyc_records as { reference_no: string }[] | undefined)?.[0]?.reference_no ?? null,
    };
  });

/** User.login() — enforces Order.Login.Auth (generic error) and Order.Login.Lock on the server. */
export const signInCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const { data: lock } = await supabaseAdmin
      .from("login_lockouts")
      .select("failed_count, locked_until")
      .eq("identifier", data.email)
      .maybeSingle();

    if (isLocked(lock, now)) {
      await supabaseAdmin.from("login_events").insert({ identifier: data.email, success: false, reason: "LOCKED", device_fingerprint: data.device });
      return { ok: false as const, error: LOCKED_ERROR };
    }

    const { data: auth, error } = await publicClient().auth.signInWithPassword({ email: data.email, password: data.password });

    if (error || !auth.session) {
      const next = afterFailure(lock, now);
      await supabaseAdmin.from("login_lockouts").upsert({ identifier: data.email, ...next, updated_at: now.toISOString() });
      await supabaseAdmin.from("login_events").insert({
        identifier: data.email,
        success: false,
        reason: error?.message?.includes("confirm") ? "EMAIL_UNCONFIRMED" : "BAD_CREDENTIALS",
        device_fingerprint: data.device,
      });
      if (next.locked_until) {
        await supabaseAdmin.from("audit_logs").insert({ action: "LOGIN_LOCKED", entity: "login", entity_id: data.email, details: { until: next.locked_until } });
        return { ok: false as const, error: LOCKED_ERROR };
      }
      if (error?.message?.toLowerCase().includes("confirm")) {
        return { ok: false as const, error: "Please confirm your email address first, using the link we sent you." };
      }
      return { ok: false as const, error: GENERIC_LOGIN_ERROR };
    }

    await supabaseAdmin.from("login_lockouts").upsert({ identifier: data.email, failed_count: 0, locked_until: null, updated_at: now.toISOString() });
    await supabaseAdmin.from("login_events").insert({ user_id: auth.user.id, identifier: data.email, success: true, device_fingerprint: data.device });
    await supabaseAdmin.from("audit_logs").insert({ actor_id: auth.user.id, action: "LOGIN", entity: "user", entity_id: auth.user.id });

    return {
      ok: true as const,
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });
