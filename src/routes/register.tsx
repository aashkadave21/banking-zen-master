import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { registrationSchema, type RegistrationInput } from "@/lib/validation";
import { registerCustomer } from "@/lib/auth.functions";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Open an account — OBS" },
      { name: "description", content: "Register as an OBS customer. Your account activates after KYC verification." },
      { property: "og:title", content: "Open an account — OBS" },
      { property: "og:description", content: "Register as an OBS customer." },
    ],
  }),
  component: RegisterPage,
});

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RegisterPage() {
  const register = useServerFn(registerCustomer);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ customerId: string | null; kycReference: string | null } | null>(null);
  const form = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { account_type: "Savings" },
  });
  const e = form.formState.errors;

  async function onSubmit(values: RegistrationInput) {
    setServerError(null);
    try {
      const res = await register({ data: { ...values, origin: window.location.origin } });
      if (!res.ok) return setServerError(res.error);
      setDone({ customerId: res.customerId, kycReference: res.kycReference });
    } catch {
      setServerError("Some details are invalid. Please review the form.");
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CheckCircle2 className="h-10 w-10 text-success" />
            <CardTitle className="font-display text-2xl">Registration received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted p-4">
              <dt className="text-muted-foreground">Customer ID</dt>
              <dd className="figure">{done.customerId ?? "—"}</dd>
              <dt className="text-muted-foreground">KYC reference</dt>
              <dd className="figure">{done.kycReference ?? "—"}</dd>
              <dt className="text-muted-foreground">KYC status</dt>
              <dd>Pending</dd>
            </dl>
            <p className="text-muted-foreground">
              We've emailed you a confirmation link. Your account stays inactive until KYC is verified
              (simulated verification service).
            </p>
            <Button asChild className="w-full"><Link to="/auth">Go to sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          <span className="font-display text-lg font-semibold">OBS</span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="text-3xl font-semibold">Open an account</h1>
        <p className="mt-1 text-muted-foreground">All fields are required. You must be at least 18.</p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-5 md:grid-cols-2" noValidate>
          {serverError && (
            <Alert variant="destructive" className="md:col-span-2"><AlertDescription>{serverError}</AlertDescription></Alert>
          )}
          <Field id="full_name" label="Full name" error={e.full_name?.message}>
            <Input id="full_name" aria-invalid={!!e.full_name} {...form.register("full_name")} />
          </Field>
          <Field id="date_of_birth" label="Date of birth" error={e.date_of_birth?.message}>
            <Input id="date_of_birth" type="date" aria-invalid={!!e.date_of_birth} {...form.register("date_of_birth")} />
          </Field>
          <Field id="email" label="Email" error={e.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
          </Field>
          <Field id="mobile_no" label="Mobile number" error={e.mobile_no?.message}>
            <Input id="mobile_no" inputMode="numeric" maxLength={10} aria-invalid={!!e.mobile_no} {...form.register("mobile_no")} />
          </Field>
          <div className="md:col-span-2">
            <Field id="address" label="Address" error={e.address?.message}>
              <Textarea id="address" rows={2} aria-invalid={!!e.address} {...form.register("address")} />
            </Field>
          </div>
          <Field id="account_type" label="Account type" error={e.account_type?.message}>
            <select id="account_type" className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" {...form.register("account_type")}>
              <option value="Savings">Savings (min. balance ₹1,000)</option>
              <option value="Current">Current (min. balance ₹10,000)</option>
            </select>
          </Field>
          <Field id="password" label="Password" error={e.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting…" : "Submit registration"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
