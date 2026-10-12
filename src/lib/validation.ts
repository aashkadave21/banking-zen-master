import { z } from "zod";

/** Order.Register.Validate — shared by browser forms and server functions. */
export function ageOn(dob: string, today = new Date()): number {
  const d = new Date(dob + "T00:00:00Z");
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");

export const registrationSchema = z.object({
  full_name: z.string().trim().min(3, "Enter your full name").max(100),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
    .refine((v) => ageOn(v) >= 18, "You must be at least 18 years old"),
  address: z.string().trim().min(10, "Enter your full address").max(300),
  mobile_no: z.string().regex(/^[0-9]{10}$/, "Enter a 10-digit mobile number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  account_type: z.enum(["Savings", "Current"]),
  password: passwordSchema,
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(72),
  device: z.string().max(128).optional(),
});
