import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Landmark, ShieldCheck, ArrowLeftRight, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OBS — Online Banking System" },
      { name: "description", content: "Open an account, check balances and statements, and transfer funds with rule-based fraud protection." },
      { property: "og:title", content: "OBS — Online Banking System" },
      { property: "og:description", content: "Account management and fund transfer with fraud detection." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Landmark, title: "Account management", text: "Registration with KYC, profile, balance enquiry and 12-month statements." },
  { icon: ArrowLeftRight, title: "Fund transfer", text: "Own-account and beneficiary transfers with limits, cooling-off and OTP." },
  { icon: ShieldCheck, title: "Fraud detection", text: "Every transfer is scored by explainable, configurable rules before posting." },
  { icon: FileText, title: "Double-entry ledger", text: "Atomic, balanced and immutable postings with idempotent retries." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold">OBS</span>
        </div>
        <nav className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/register">Open an account</Link></Button>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
        <p className="figure text-xs uppercase tracking-[0.2em] text-muted-foreground">Online Banking System · SE Case Study</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Banking where every rupee is accounted for.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Manage your accounts and move money safely. Each transfer is checked against limits and fraud rules, then
          posted as a balanced ledger entry.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/register">Open an account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in to net banking</Link></Button>
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-px px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="p-4">
              <f.icon className="h-6 w-6 text-accent-foreground" />
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
        Academic demonstration. KYC, OTP delivery and the payment network are simulated and are not connected to any
        real bank or government service.
      </footer>
    </div>
  );
}
