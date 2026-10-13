import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyAccounts } from "@/lib/accounts.functions";
import { getMyBeneficiaries } from "@/lib/beneficiary.functions";
import { initiateTransfer, completeTransfer } from "@/lib/transfer.functions";
import { generateOtp, verifyOtp } from "@/lib/otp.functions";
import { formatINR, maskAccount } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";

const accountsQuery = queryOptions({ queryKey: ["my-accounts"], queryFn: () => getMyAccounts() });
const benQuery = queryOptions({ queryKey: ["beneficiaries"], queryFn: () => getMyBeneficiaries() });

export const Route = createFileRoute("/_authenticated/transfer")({
  head: () => ({ meta: [{ title: "Transfer — OBS" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(benQuery),
    ]);
  },
  component: TransferPage,
});

type TransferResult = {
  transaction_id: string;
  reference: string;
  status: string;
  message: string;
};

function TransferPage() {
  const { data: acctData } = useSuspenseQuery(accountsQuery);
  const { data: benData } = useSuspenseQuery(benQuery);
  const queryClient = useQueryClient();
  const doTransfer = useServerFn(initiateTransfer);
  const doComplete = useServerFn(completeTransfer);
  const doGenOtp = useServerFn(generateOtp);
  const doVerifyOtp = useServerFn(verifyOtp);

  const activeAccounts = acctData.accounts.filter(a => a.status === "Active");
  const activeBens = benData.beneficiaries.filter(b => b.is_active);

  const [tab, setTab] = useState("own");
  const [sourceId, setSourceId] = useState(activeAccounts[0]?.id ?? "");
  const [destId, setDestId] = useState("");
  const [benId, setBenId] = useState(activeBens[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);

  // OTP step for beneficiary transfers
  const [otpStep, setOtpStep] = useState<{ txnId: string; otpId: string; reference: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Enter a valid amount.");
        setBusy(false);
        return;
      }

      const idemKey = crypto.randomUUID();
      const res = await doTransfer({
        data: {
          source_account_id: sourceId,
          transfer_type: tab === "own" ? "Own" : "Beneficiary",
          dest_account_id: tab === "own" ? destId : undefined,
          beneficiary_id: tab === "beneficiary" ? benId : undefined,
          amount: parsedAmount,
          remarks: remarks || undefined,
          idempotency_key: idemKey,
        },
      });

      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }

      if (res.requires_otp) {
        // Generate OTP
        const otpRes = await doGenOtp({ data: { purpose: "Transfer", subject_id: res.transaction_id } });
        if (!otpRes.ok) {
          setError("Failed to send OTP.");
          setBusy(false);
          return;
        }
        setOtpStep({ txnId: res.transaction_id, otpId: otpRes.otp_id, reference: res.reference });
        toast.info("OTP sent! Check notifications.");
        setBusy(false);
        return;
      }

      // Own transfer completed immediately
      setResult({ transaction_id: res.transaction_id, reference: res.reference, status: res.status, message: res.message });
      queryClient.invalidateQueries({ queryKey: ["my-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      setError("Transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpVerify() {
    if (!otpStep) return;
    setOtpError(null);
    setOtpBusy(true);
    try {
      const verify = await doVerifyOtp({ data: { otp_id: otpStep.otpId, code: otpCode } });
      if (!verify.ok) {
        setOtpError(verify.error);
        setOtpBusy(false);
        return;
      }

      const complete = await doComplete({ data: { transaction_id: otpStep.txnId } });
      if (!complete.ok) {
        setOtpError(complete.error);
        setOtpBusy(false);
        return;
      }

      setResult({ transaction_id: complete.transaction_id, reference: complete.reference, status: complete.status, message: complete.message });
      setOtpStep(null);
      queryClient.invalidateQueries({ queryKey: ["my-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Transfer completed!");
    } catch {
      setOtpError("Failed to complete transfer.");
    } finally {
      setOtpBusy(false);
    }
  }

  // Success receipt
  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <CardTitle className="mt-2 text-2xl font-semibold">Transfer successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-4 text-sm">
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Reference</span><span className="figure font-medium">{result.reference}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Amount</span><span className="figure font-medium">{formatINR(parseFloat(amount))}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Status</span><Badge>{result.status}</Badge></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">{result.message}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setResult(null); setAmount(""); setRemarks(""); }}>New transfer</Button>
              <Button variant="outline" className="flex-1" asChild><Link to="/dashboard">Dashboard</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP verification step
  if (otpStep) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Verify OTP</CardTitle>
            <p className="text-sm text-muted-foreground">Enter the 6-digit OTP sent to your registered contact. (Check Notifications for the simulated code.)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p>Transfer ref: <span className="figure font-medium">{otpStep.reference}</span></p>
              <p>Amount: <span className="figure font-medium">{formatINR(parseFloat(amount))}</span></p>
            </div>
            {otpError && <Alert variant="destructive"><AlertDescription>{otpError}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label>OTP Code</Label>
              <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} inputMode="numeric" placeholder="123456" className="text-center text-2xl tracking-[0.5em]" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleOtpVerify} disabled={otpBusy || otpCode.length !== 6}>
                {otpBusy ? "Verifying…" : "Verify & complete transfer"}
              </Button>
              <Button variant="ghost" onClick={() => setOtpStep(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Transfer funds</h1>
        <p className="mt-1 text-muted-foreground">Move money between your accounts or to a beneficiary.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="own">Own account</TabsTrigger>
          <TabsTrigger value="beneficiary">Beneficiary</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-1.5">
            <Label>From account</Label>
            <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_type} — {maskAccount(a.account_number)} (Bal: {formatINR(a.balance)})
                </option>
              ))}
            </select>
          </div>

          <TabsContent value="own" className="mt-0 space-y-4">
            <div className="space-y-1.5">
              <Label>To account</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={destId} onChange={(e) => setDestId(e.target.value)}>
                <option value="">Select destination…</option>
                {activeAccounts.filter(a => a.id !== sourceId).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} — {maskAccount(a.account_number)} (Bal: {formatINR(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          </TabsContent>

          <TabsContent value="beneficiary" className="mt-0 space-y-4">
            <div className="space-y-1.5">
              <Label>Beneficiary</Label>
              {activeBens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active beneficiaries. <Link to="/beneficiaries" className="underline">Add one</Link>.</p>
              ) : (
                <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={benId} onChange={(e) => setBenId(e.target.value)}>
                  {activeBens.map((b) => (
                    <option key={b.id} value={b.id}>{b.nickname} — {b.beneficiary_name}</option>
                  ))}
                </select>
              )}
            </div>
          </TabsContent>

          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="figure text-lg" />
          </div>

          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Rent payment" rows={2} />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy || !sourceId || !amount}>
            {busy ? "Processing…" : <>Transfer <ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </form>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        Own-account transfers post immediately. Beneficiary transfers require OTP verification.<br />
        SIMULATED SERVICES — payment network and OTP delivery are simulated.
      </p>
    </div>
  );
}
