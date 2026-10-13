import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { getMyBeneficiaries, addBeneficiary, activateBeneficiary } from "@/lib/beneficiary.functions";
import { generateOtp, verifyOtp } from "@/lib/otp.functions";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Clock, CheckCircle2, Plus, Shield } from "lucide-react";

const benQuery = queryOptions({ queryKey: ["beneficiaries"], queryFn: () => getMyBeneficiaries() });

export const Route = createFileRoute("/_authenticated/beneficiaries")({
  head: () => ({ meta: [{ title: "Beneficiaries — OBS" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(benQuery),
  component: BeneficiariesPage,
});

function getStatus(b: { is_active: boolean; cooling_off_until: string | null }) {
  if (!b.is_active) return { label: "Pending OTP", variant: "secondary" as const, icon: Shield };
  if (b.cooling_off_until && new Date(b.cooling_off_until) > new Date()) {
    return { label: "Cooling off", variant: "outline" as const, icon: Clock };
  }
  return { label: "Active", variant: "default" as const, icon: CheckCircle2 };
}

function BeneficiariesPage() {
  const { data } = useSuspenseQuery(benQuery);
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addBeneficiary);
  const doActivate = useServerFn(activateBeneficiary);
  const doGenOtp = useServerFn(generateOtp);
  const doVerifyOtp = useServerFn(verifyOtp);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ nickname: "", beneficiary_name: "", account_number: "", ifsc: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [otpStep, setOtpStep] = useState<{ benId: string; otpId: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  async function handleAdd() {
    setAddError(null);
    setAddBusy(true);
    try {
      const res = await doAdd({ data: addForm });
      if (!res.ok) {
        setAddError(res.error);
      } else {
        toast.success("Beneficiary added. Now verify with OTP to activate.");
        queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
        setShowAdd(false);
        setAddForm({ nickname: "", beneficiary_name: "", account_number: "", ifsc: "" });
      }
    } catch { setAddError("Failed to add beneficiary."); }
    finally { setAddBusy(false); }
  }

  async function startActivation(benId: string) {
    setOtpError(null);
    setOtpCode("");
    try {
      const res = await doGenOtp({ data: { purpose: "Beneficiary", subject_id: benId } });
      if (!res.ok) { toast.error(res.error); return; }
      setOtpStep({ benId, otpId: res.otp_id });
      toast.info("OTP sent! Check notifications for the simulated OTP code.");
    } catch { toast.error("Failed to send OTP."); }
  }

  async function handleVerifyAndActivate() {
    if (!otpStep) return;
    setOtpError(null);
    setOtpBusy(true);
    try {
      const verify = await doVerifyOtp({ data: { otp_id: otpStep.otpId, code: otpCode } });
      if (!verify.ok) { setOtpError(verify.error); setOtpBusy(false); return; }

      const activate = await doActivate({ data: { beneficiary_id: otpStep.benId } });
      if (!activate.ok) { setOtpError(activate.error); setOtpBusy(false); return; }

      toast.success("Beneficiary activated!");
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      setOtpStep(null);
    } catch { setOtpError("Verification failed."); }
    finally { setOtpBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Beneficiaries</h1>
          <p className="mt-1 text-muted-foreground">Manage your payment recipients.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add beneficiary</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add new beneficiary</DialogTitle>
              <DialogDescription>Enter the beneficiary's bank details.</DialogDescription>
            </DialogHeader>
            {addError && <Alert variant="destructive"><AlertDescription>{addError}</AlertDescription></Alert>}
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nickname</Label><Input value={addForm.nickname} onChange={(e) => setAddForm(p => ({ ...p, nickname: e.target.value }))} placeholder="e.g. Mom's account" /></div>
              <div className="space-y-1"><Label>Full name</Label><Input value={addForm.beneficiary_name} onChange={(e) => setAddForm(p => ({ ...p, beneficiary_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Account number</Label><Input value={addForm.account_number} onChange={(e) => setAddForm(p => ({ ...p, account_number: e.target.value }))} inputMode="numeric" maxLength={18} /></div>
              <div className="space-y-1"><Label>IFSC code</Label><Input value={addForm.ifsc} onChange={(e) => setAddForm(p => ({ ...p, ifsc: e.target.value.toUpperCase() }))} maxLength={11} placeholder="e.g. SBIN0001234" /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addBusy}>{addBusy ? "Adding…" : "Add beneficiary"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* OTP verification dialog */}
      <Dialog open={!!otpStep} onOpenChange={(open) => { if (!open) setOtpStep(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify OTP</DialogTitle>
            <DialogDescription>Enter the 6-digit OTP from your notifications to activate this beneficiary.</DialogDescription>
          </DialogHeader>
          {otpError && <Alert variant="destructive"><AlertDescription>{otpError}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label>OTP Code</Label>
            <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} inputMode="numeric" placeholder="123456" className="text-center text-2xl tracking-[0.5em]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOtpStep(null)}>Cancel</Button>
            <Button onClick={handleVerifyAndActivate} disabled={otpBusy || otpCode.length !== 6}>{otpBusy ? "Verifying…" : "Verify & activate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {data.beneficiaries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No beneficiaries added yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data.beneficiaries.map((b) => {
            const s = getStatus(b);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{b.nickname}</p>
                    <p className="text-sm text-muted-foreground">{b.beneficiary_name}</p>
                    <p className="figure mt-1 text-xs text-muted-foreground">
                      A/C: {b.account_number} · IFSC: {b.ifsc}
                    </p>
                    {b.cooling_off_until && new Date(b.cooling_off_until) > new Date() && (
                      <p className="mt-1 text-xs text-amber-600">
                        Cooling off until {formatDateTime(b.cooling_off_until)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.variant}>
                      <s.icon className="mr-1 h-3 w-3" /> {s.label}
                    </Badge>
                    {!b.is_active && (
                      <Button size="sm" variant="outline" onClick={() => startActivation(b.id)}>
                        Activate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        SIMULATED SERVICES — OTP is delivered via in-app notification.
      </p>
    </div>
  );
}
