import { describe, expect, it } from "vitest";
import { afterFailure, isLocked } from "@/lib/lockout";
import { ageOn, registrationSchema } from "@/lib/validation";

const valid = {
  full_name: "Aashka Dave",
  date_of_birth: "2000-01-15",
  address: "12 Marine Drive, Mumbai 400002",
  mobile_no: "9876543210",
  email: "aashka@example.com",
  account_type: "Savings" as const,
  password: "Secure123",
};

describe("Order.Register.Validate", () => {
  it("accepts a valid registration", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects applicants younger than 18", () => {
    const d = new Date();
    const dob = `${d.getUTCFullYear() - 17}-01-01`;
    expect(registrationSchema.safeParse({ ...valid, date_of_birth: dob }).success).toBe(false);
  });
  it("treats the 18th birthday as eligible", () => {
    expect(ageOn("2008-10-12", new Date("2026-10-12T00:00:00Z"))).toBe(18);
    expect(ageOn("2008-10-13", new Date("2026-10-12T00:00:00Z"))).toBe(17);
  });
  it("requires a 10-digit mobile number", () => {
    expect(registrationSchema.safeParse({ ...valid, mobile_no: "98765" }).success).toBe(false);
  });
  it("requires a valid email", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("Order.Login.Lock", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  it("does not lock after four failures", () => {
    let s = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < 4; i++) s = afterFailure(s, now);
    expect(isLocked(s, now)).toBe(false);
  });
  it("locks for 30 minutes on the fifth failure", () => {
    let s = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < 5; i++) s = afterFailure(s, now);
    expect(isLocked(s, new Date("2026-10-12T10:29:59Z"))).toBe(true);
    expect(isLocked(s, new Date("2026-10-12T10:30:01Z"))).toBe(false);
  });
});
