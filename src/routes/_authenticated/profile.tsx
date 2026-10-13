import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getMyOverview } from "@/lib/me.functions";
import { updateProfile, changePassword } from "@/lib/profile.functions";
import { simulateKycVerification } from "@/lib/kyc.functions";
import { toast } from "sonner";

const overviewQuery = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — OBS" },
      { name: "description", content: "Edit your profile information." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: ProfilePage,
});

const profileSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  mobile_no: z.string().regex(/^[0-9]{10}$/, "Enter a 10-digit mobile number"),
  address: z.string().trim().min(10, "Enter your full address").max(300),
});

const passwordFormSchema = z.object({
  password: z.string().min(8, "At least 8 characters").max(72)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ProfilePage() {
  const { data } = useSuspenseQuery(overviewQuery);
  const { profile, customer, roles } = data;
  const queryClient = useQueryClient();
  const doUpdate = useServerFn(updateProfile);
  const doPassword = useServerFn(changePassword);
  const doKyc = useServerFn(simulateKycVerification);

  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [kycBusy, setKycBusy] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: profile?.email ?? "",
      mobile_no: profile?.mobile_no ?? "",
      address: profile?.address ?? "",
    },
  });

  const pwForm = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onProfileSubmit(values: z.infer<typeof profileSchema>) {
    setProfileMsg(null);
    try {
      const res = await doUpdate({ data: values });
      if (!res.ok) {
        setProfileMsg({ ok: false, text: res.error });
      } else {
        setProfileMsg({ ok: true, text: res.message });
        queryClient.invalidateQueries({ queryKey: ["me"] });
        toast.success("Profile updated");
      }
    } catch {
      setProfileMsg({ ok: false, text: "Failed to update profile." });
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
    setPwMsg(null);
    try {
      const res = await doPassword({ data: { password: values.password } });
      if (!res.ok) {
        setPwMsg({ ok: false, text: res.error });
      } else {
        setPwMsg({ ok: true, text: res.message });
        pwForm.reset();
        toast.success("Password changed");
      }
    } catch {
      setPwMsg({ ok: false, text: "Failed to change password." });
    }
  }

  async function onVerifyKyc() {
    if (!customer) return;
    setKycBusy(true);
    try {
      const res = await doKyc({ data: { customer_id: customer.id } });
      if (res.ok) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("KYC verification failed.");
    } finally {
      setKycBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal information.</p>
      </div>

      {/* Read-only info */}
      <Card>
        <CardHeader><CardTitle className="font-display">Account Info</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Full name</span>
            <span className="font-medium">{profile?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date of birth</span>
            <span className="figure">{profile?.date_of_birth ?? "—"}</span>
          </div>
          {customer && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer ID</span>
                <span className="figure">{customer.customer_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">KYC status</span>
                <div className="flex items-center gap-2">
                  <Badge variant={customer.kyc_status === "Verified" ? "default" : customer.kyc_status === "Rejected" ? "destructive" : "secondary"}>
                    {customer.kyc_status}
                  </Badge>
                  {customer.kyc_status === "Pending" && (
                    <Button size="sm" variant="outline" onClick={onVerifyKyc} disabled={kycBusy}>
                      {kycBusy ? "Verifying…" : "Verify KYC (Simulated)"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span>{roles.join(", ") || "customer"}{customer.is_premium && " · Premium"}</span>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">Name, DOB, customer ID, and KYC status cannot be changed.</p>
        </CardContent>
      </Card>

      {/* Editable profile */}
      <Card>
        <CardHeader><CardTitle className="font-display">Edit Profile</CardTitle></CardHeader>
        <CardContent>
          {profileMsg && (
            <Alert variant={profileMsg.ok ? "default" : "destructive"} className="mb-4">
              <AlertDescription>{profileMsg.text}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...profileForm.register("email")} />
              {profileForm.formState.errors.email && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile_no">Mobile number</Label>
              <Input id="mobile_no" inputMode="numeric" maxLength={10} {...profileForm.register("mobile_no")} />
              {profileForm.formState.errors.mobile_no && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.mobile_no.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" rows={2} {...profileForm.register("address")} />
              {profileForm.formState.errors.address && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.address.message}</p>
              )}
            </div>
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              {profileForm.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader><CardTitle className="font-display">Change Password</CardTitle></CardHeader>
        <CardContent>
          {pwMsg && (
            <Alert variant={pwMsg.ok ? "default" : "destructive"} className="mb-4">
              <AlertDescription>{pwMsg.text}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" {...pwForm.register("password")} />
              {pwForm.formState.errors.password && (
                <p className="text-xs text-destructive">{pwForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...pwForm.register("confirm")} />
              {pwForm.formState.errors.confirm && (
                <p className="text-xs text-destructive">{pwForm.formState.errors.confirm.message}</p>
              )}
            </div>
            <Button type="submit" disabled={pwForm.formState.isSubmitting}>
              {pwForm.formState.isSubmitting ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        SIMULATED SERVICES — KYC verification uses a simulated provider.
      </p>
    </div>
  );
}
