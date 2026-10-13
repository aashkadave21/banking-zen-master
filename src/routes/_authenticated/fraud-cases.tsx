import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getFraudCases, reviewFraudCase, getFraudRules, updateFraudRule } from "@/lib/fraud.functions";
import { formatINR, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

const casesQuery = queryOptions({ queryKey: ["fraud-cases"], queryFn: () => getFraudCases() });
const rulesQuery = queryOptions({ queryKey: ["fraud-rules"], queryFn: () => getFraudRules() });

export const Route = createFileRoute("/_authenticated/fraud-cases")({
  head: () => ({ meta: [{ title: "Fraud Cases — OBS" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(casesQuery),
      context.queryClient.ensureQueryData(rulesQuery),
    ]);
  },
  component: FraudCasesPage,
});

function bandColor(band: string) {
  return band === "HIGH" ? "destructive" : band === "MEDIUM" ? "outline" : "secondary";
}
function statusColor(s: string) {
  return s === "ConfirmedFraud" ? "destructive" : s === "FalsePositive" || s === "Closed" ? "default" : "secondary";
}

function FraudCasesPage() {
  const { data: casesData } = useSuspenseQuery(casesQuery);
  const { data: rulesData } = useSuspenseQuery(rulesQuery);
  const queryClient = useQueryClient();
  const doReview = useServerFn(reviewFraudCase);
  const doUpdateRule = useServerFn(updateFraudRule);

  const [reviewCase, setReviewCase] = useState<string | null>(null);
  const [decision, setDecision] = useState<"ConfirmedFraud" | "FalsePositive" | "Closed">("FalsePositive");
  const [remarks, setRemarks] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const selectedCase = casesData.cases.find(c => c.id === reviewCase);

  async function handleReview() {
    if (!reviewCase) return;
    setReviewError(null);
    setReviewBusy(true);
    try {
      const res = await doReview({ data: { case_id: reviewCase, decision, remarks } });
      if (!res.ok) { setReviewError(res.error); return; }
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["fraud-cases"] });
      setReviewCase(null);
      setRemarks("");
    } catch { setReviewError("Review failed."); }
    finally { setReviewBusy(false); }
  }

  if (casesData.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert variant="destructive"><AlertDescription>{casesData.error}</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Fraud Cases</h1>
        <p className="mt-1 text-muted-foreground">Review and resolve flagged transactions.</p>
      </div>

      {/* Cases table */}
      <Card>
        <CardHeader><CardTitle className="font-display">All Cases</CardTitle></CardHeader>
        <CardContent>
          {casesData.cases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No fraud cases.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case ID</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casesData.cases.map((c) => {
                    const txn = c.transactions as { reference: string; amount: number; created_at: string } | null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="figure text-xs">{c.case_id}</TableCell>
                        <TableCell className="figure font-medium">{c.risk_score}</TableCell>
                        <TableCell><Badge variant={bandColor(c.risk_band)}>{c.risk_band}</Badge></TableCell>
                        <TableCell><Badge variant={statusColor(c.status)}>{c.status}</Badge></TableCell>
                        <TableCell className="figure">{txn ? formatINR(txn.amount) : "—"}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(c.created_at)}</TableCell>
                        <TableCell>
                          {(c.status === "Open" || c.status === "Escalated" || c.status === "UnderReview") && (
                            <Button size="sm" variant="outline" onClick={() => setReviewCase(c.id)}>
                              Review
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fraud rules (admin only) */}
      {rulesData.rules.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display">Fraud Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesData.rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="figure text-xs">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="figure">{r.weight}</TableCell>
                      <TableCell>
                        <Badge variant={r.enabled ? "default" : "secondary"}>
                          {r.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewCase} onOpenChange={(open) => { if (!open) setReviewCase(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review fraud case</DialogTitle>
            <DialogDescription>{selectedCase?.case_id}</DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between"><span>Score</span><span className="figure font-bold">{selectedCase.risk_score}</span></div>
                <div className="flex justify-between"><span>Band</span><Badge variant={bandColor(selectedCase.risk_band)}>{selectedCase.risk_band}</Badge></div>
              </div>

              {/* Triggered rules */}
              <div>
                <p className="mb-1 text-sm font-medium">Triggered rules:</p>
                <div className="space-y-1">
                  {(selectedCase.triggered_rules as Array<{ code: string; name: string; weight: number; detail: string }>).map((r, i) => (
                    <div key={i} className="flex justify-between rounded border p-2 text-xs">
                      <span>{r.name}</span>
                      <span className="figure font-medium">+{r.weight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {reviewError && <Alert variant="destructive"><AlertDescription>{reviewError}</AlertDescription></Alert>}

              <div className="space-y-1.5">
                <Label>Decision</Label>
                <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                  <option value="FalsePositive">False Positive — Unfreeze account</option>
                  <option value="ConfirmedFraud">Confirmed Fraud — Keep frozen</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Remarks (min 20 chars)</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Provide detailed remarks..." />
                <p className="text-xs text-muted-foreground">{remarks.length}/20 minimum</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewCase(null)}>Cancel</Button>
            <Button onClick={handleReview} disabled={reviewBusy || remarks.length < 20}>
              {reviewBusy ? "Submitting…" : "Submit review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
