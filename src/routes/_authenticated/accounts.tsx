import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getMyAccounts, deactivateAccount } from "@/lib/accounts.functions";
import { formatINR, maskAccount, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const accountsQuery = queryOptions({ queryKey: ["my-accounts"], queryFn: () => getMyAccounts() });

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — OBS" },
      { name: "description", content: "View and manage your bank accounts." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery),
  component: AccountsPage,
});

function statusVariant(s: string) {
  return s === "Active" ? "default" : s === "Frozen" || s === "Deactivated" ? "destructive" : "secondary";
}

function AccountsPage() {
  const { data } = useSuspenseQuery(accountsQuery);
  const queryClient = useQueryClient();
  const doDeactivate = useServerFn(deactivateAccount);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    if (!deactivating || reason.length < 5) return;
    setBusy(true);
    try {
      const res = await doDeactivate({ data: { account_id: deactivating, reason } });
      if (res.ok) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["my-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["me"] });
        setDeactivating(null);
        setReason("");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to deactivate account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Accounts</h1>
        <p className="mt-1 text-muted-foreground">View your bank accounts and manage them.</p>
      </div>

      {data.accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No accounts found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">{a.account_type} Account</CardTitle>
                <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Account number</p>
                    <p className="figure text-sm font-medium">{maskAccount(a.account_number)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="figure text-lg font-semibold">{formatINR(a.balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Minimum balance</p>
                    <p className="figure text-sm">{formatINR(a.min_balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opened on</p>
                    <p className="text-sm">{formatDateTime(a.created_at)}</p>
                  </div>
                </div>

                {a.status === "Active" && Number(a.balance) === 0 && (
                  <div className="mt-4 border-t pt-4">
                    <Dialog open={deactivating === a.id} onOpenChange={(open) => { if (!open) setDeactivating(null); }}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => setDeactivating(a.id)}>
                          Deactivate account
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deactivate account</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. The account {maskAccount(a.account_number)} will be permanently deactivated.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Label>Reason for deactivation</Label>
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Provide a reason (min 5 characters)"
                            rows={2}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setDeactivating(null)}>Cancel</Button>
                          <Button variant="destructive" onClick={handleDeactivate} disabled={busy || reason.length < 5}>
                            {busy ? "Deactivating…" : "Confirm deactivation"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
