import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Seeding database via Supabase Admin Client...");

  // 1. Helper to create or get auth user
  async function ensureUser(
    email: string,
    password: string,
    metadata: {
      kind: "customer" | "staff";
      full_name: string;
      date_of_birth?: string;
      mobile_no: string;
      address?: string;
      account_type?: "Savings" | "Current";
    }
  ) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      console.log(`User ${email} already exists: ${existing.id}`);
      return existing;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) {
      console.error(`Error creating user ${email}:`, error);
      throw error;
    }
    console.log(`Created user ${email}: ${data.user.id}`);
    return data.user;
  }

  // 2. Create customer: Krrish
  const krrishUser = await ensureUser("krrish@bank.com", "Password@123", {
    kind: "customer",
    full_name: "Krrish Gadekar",
    date_of_birth: "2000-01-15",
    mobile_no: "9876543210",
    address: "42 MG Road, Bandra West, Mumbai 400050",
    account_type: "Savings",
  });

  // 3. Create customer: Priscilla
  const priscillaUser = await ensureUser("priscilla@bank.com", "Password@123", {
    kind: "customer",
    full_name: "Priscilla D'Souza",
    date_of_birth: "1998-05-20",
    mobile_no: "9876543211",
    address: "18 Sea View, Marine Drive, Mumbai 400020",
    account_type: "Savings",
  });

  // 4. Create customer: Rahul (Pending KYC for live verification demo)
  const rahulUser = await ensureUser("rahul@bank.com", "Password@123", {
    kind: "customer",
    full_name: "Rahul Sharma",
    date_of_birth: "2001-11-10",
    mobile_no: "9876543212",
    address: "12 Linking Road, Khar, Mumbai 400052",
    account_type: "Savings",
  });

  // 5. Staff users
  const adminUser = await ensureUser("admin@bank.com", "Password@123", {
    kind: "staff",
    full_name: "Chief Bank Admin",
    mobile_no: "9000000001",
  });
  const analystUser = await ensureUser("analyst@bank.com", "Password@123", {
    kind: "staff",
    full_name: "Lead Fraud Analyst",
    mobile_no: "9000000002",
  });
  const auditorUser = await ensureUser("auditor@bank.com", "Password@123", {
    kind: "staff",
    full_name: "Senior Compliance Auditor",
    mobile_no: "9000000003",
  });

  // Assign staff roles
  await supabase.from("user_roles").upsert(
    [
      { user_id: adminUser.id, role: "bank_admin" as const },
      { user_id: analystUser.id, role: "fraud_analyst" as const },
      { user_id: auditorUser.id, role: "auditor" as const },
    ],
    { onConflict: "user_id,role" }
  );

  // 6. Set Krrish KYC to Verified, Account to Active with balance ₹75,000
  const { data: krrishCust } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", krrishUser.id)
    .single();

  if (krrishCust) {
    await supabase
      .from("customers")
      .update({ kyc_status: "Verified", is_premium: true })
      .eq("id", krrishCust.id);

    await supabase
      .from("kyc_records")
      .update({
        status: "Verified",
        remarks: "Auto-verified by simulated KYC provider during onboarding",
        decided_at: new Date().toISOString(),
      })
      .eq("customer_id", krrishCust.id);

    // Update first account balance and active status
    const { data: kAccts } = await supabase
      .from("accounts")
      .select("id")
      .eq("customer_id", krrishCust.id);

    let kAcctId = kAccts?.[0]?.id;
    if (kAcctId) {
      await supabase
        .from("accounts")
        .update({
          status: "Active",
          balance: 75000 as unknown as number,
        })
        .eq("id", kAcctId);
    }

    // Add a second Current account for Krrish (for own-account transfer testing)
    const { data: currentAcct } = await supabase
      .from("accounts")
      .insert({
        account_number: "5010" + Math.floor(1000000000 + Math.random() * 9000000000),
        customer_id: krrishCust.id,
        account_type: "Current" as const,
        balance: 250000 as unknown as number,
        min_balance: 10000 as unknown as number,
        status: "Active" as const,
      })
      .select("id, account_number")
      .single();

    console.log(`Krrish savings account balance set to 75,000; current account added with 250,000`);

    // Add beneficiaries for Krrish
    await supabase.from("beneficiaries").upsert(
      [
        {
          customer_id: krrishCust.id,
          nickname: "Mom's account",
          beneficiary_name: "Priscilla",
          account_number: "123456789",
          ifsc: "SBIN0001234",
          is_active: true,
          activated_at: new Date().toISOString(),
        },
        {
          customer_id: krrishCust.id,
          nickname: "Rahul Office",
          beneficiary_name: "Rahul Sharma",
          account_number: "987654321012",
          ifsc: "HDFC0001234",
          is_active: true,
          activated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "customer_id,account_number,ifsc" }
    );
    console.log("Added pre-activated beneficiaries for Krrish");
  }

  // 7. Set Priscilla KYC to Verified and balance to ₹50,000
  const { data: priscillaCust } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", priscillaUser.id)
    .single();

  if (priscillaCust) {
    await supabase
      .from("customers")
      .update({ kyc_status: "Verified" })
      .eq("id", priscillaCust.id);

    await supabase
      .from("kyc_records")
      .update({
        status: "Verified",
        decided_at: new Date().toISOString(),
      })
      .eq("customer_id", priscillaCust.id);

    const { data: pAccts } = await supabase
      .from("accounts")
      .select("id")
      .eq("customer_id", priscillaCust.id);

    if (pAccts?.[0]?.id) {
      await supabase
        .from("accounts")
        .update({
          status: "Active",
          balance: 50000 as unknown as number,
        })
        .eq("id", pAccts[0].id);
    }
  }

  console.log("Database seeded successfully!");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
