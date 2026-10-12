import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Customer.view_accounts() + current User — read as the signed-in user (RLS applies). */
export const getMyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, roles, customer] = await Promise.all([
      supabase.from("profiles").select("full_name, email, mobile_no, date_of_birth, address").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("customers").select("id, customer_id, kyc_status, is_premium, transfer_limit, daily_limit, kyc_records(reference_no, status, provider)").eq("user_id", userId).maybeSingle(),
    ]);
    let accounts: { id: string; account_number: string; account_type: string; balance: number; status: string; min_balance: number }[] = [];
    let recent: { id: string; reference: string; type: string; amount: number; status: string; remarks: string | null; created_at: string; source_account_id: string | null; dest_account_id: string | null }[] = [];
    if (customer.data) {
      const a = await supabase.from("accounts").select("id, account_number, account_type, balance, status, min_balance").eq("customer_id", customer.data.id).order("created_at");
      accounts = a.data ?? [];
      const t = await supabase.from("transactions").select("id, reference, type, amount, status, remarks, created_at, source_account_id, dest_account_id").order("created_at", { ascending: false }).limit(8);
      recent = t.data ?? [];
    }
    return {
      profile: profile.data,
      roles: (roles.data ?? []).map((r) => r.role),
      customer: customer.data,
      accounts,
      recent,
    };
  });
