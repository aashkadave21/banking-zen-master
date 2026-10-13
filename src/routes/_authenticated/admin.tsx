import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSystemLimits } from "@/lib/admin.functions";
import { getPendingSettlements, reconcileSettlement } from "@/lib/admin.functions";
import { formatINR, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const limitsQuery = queryOptions({ queryKey: ["admin-limits"], queryFn: () => getSystemLimits() });
const settlementsQuery = queryOptions({ queryKey: ["admin-settlements"], queryFn: () => getPendingSettlements() });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — OBS" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(limitsQuery),
      context.queryClient.ensureQueryData(settlementsQuery),
    ]);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: limitsData } = useSuspenseQuery(limitsQuery);
  const { data: settData } = useSuspenseQuery(settlementsQuery);
  const queryClient = useQueryClient();
  const doReconcile = useServerFn(reconcileSettlement);
  const [reconcileBusy, setReconcileBusy] = useState<string | null>(null);

  if (limitsData.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert variant="destructive"><AlertDescription>{limitsData.error}</AlertDescription></Alert>
      </div>
    );
  }

  async function handleReconcile(settlementId: string, outcome: "Settled" | "Failed") {
    setReconcileBusy(settlementId);
    try {
      const res = await doReconcile({ data: { settlement_id: settlementId, outcome } });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
    } catch { toast.error("Reconciliation failed."); }
    finally { setReconcileBusy(null); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Admin Panel</h1>
        <p className="mt-1 text-muted-foreground">System configuration and settlement management.</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">System Config</TabsTrigger>
          <TabsTrigger value="settlements">
            Pending Settlements
            {settData.settlements.length > 0 && (
              <Badge variant="destructive" className="ml-2">{settData.settlements.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          {(limitsData.configs ?? []).map((config) => (
            <Card key={config.key}>
              <CardHeader><CardTitle className="font-display capitalize">{config.key.replace(/_/g, " ")}</CardTitle></CardHeader>
              <CardContent>
                <pre className="rounded-md bg-muted p-4 text-sm overflow-auto">
                  {JSON.stringify(config.value, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Pending Settlements</CardTitle>
            </CardHeader>
            <CardContent>
              {settData.settlements.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No pending settlements.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settData.settlements.map((s) => {
                        const txn = s.transactions as { reference: string; amount: number; created_at: string } | null;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="figure text-xs">{txn?.reference ?? "—"}</TableCell>
                            <TableCell className="figure">{txn ? formatINR(txn.amount) : "—"}</TableCell>
                            <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                            <TableCell className="text-xs">{formatDateTime(s.submitted_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => handleReconcile(s.id, "Settled")}
                                  disabled={reconcileBusy === s.id}
                                >
                                  Settle
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReconcile(s.id, "Failed")}
                                  disabled={reconcileBusy === s.id}
                                >
                                  Reverse
                                </Button>
                              </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
