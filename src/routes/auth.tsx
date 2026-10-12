import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { signInCustomer } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — OBS" },
      { name: "description", content: "Sign in to OBS net banking." },
      { property: "og:title", content: "Sign in — OBS" },
      { property: "og:description", content: "Sign in to OBS net banking." },
    ],
  }),
  component: AuthPage,
});

function deviceId() {
  let id = localStorage.getItem("obs-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("obs-device", id);
  }
  return id;
}

function AuthPage() {
  const navigate = useNavigate();
  const signIn = useServerFn(signInCustomer);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn({ data: { email, password, device: deviceId() } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
      navigate({ to: "/dashboard", replace: true });
    } catch {
      setError("Please check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground md:flex">
        <Link to="/" className="flex items-center gap-2">
          <Landmark className="h-6 w-6" />
          <span className="font-display text-xl">OBS</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold">Secure net banking</h2>
          <p className="mt-3 max-w-sm opacity-80">
            Five wrong passwords pause sign-in for 30 minutes. We never tell anyone whether an email is registered.
          </p>
        </div>
        <p className="text-xs opacity-60">Academic demonstration — simulated services.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <h1 className="text-3xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use the email you registered with.</p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New to OBS? <Link to="/register" className="font-medium text-foreground underline">Open an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
