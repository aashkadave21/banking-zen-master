import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyOverview } from "@/lib/me.functions";
import { formatDateTime, formatINR, maskAccount } from "@/lib/format";

const overviewQuery = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — OBS" },
      { name: "description", content: "Your OBS accounts, balances and recent transactions." },
      { property: "og:title", content: "Dashboard — OBS" },
      { property: "og:description", content: "Your OBS accounts and balances." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: Dashboard,
});

function statusVariant(s: string) {
  return s === "Active" || s === "Verified" ? "default" : s === "Frozen" || s === "Rejected" ? "destructive" : "secondary";
}

function Dashboard() {
  const { data } = useSuspenseQuery(overviewQuery);
  const { profile, customer, accounts, recent, roles } = data;
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-semibold">{profile?.full_name ?? "Customer"}</h1>
      </div>

      {customer ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total balance</CardTitle></CardHeader>
              <CardContent className="figure text-3xl">{formatINR(total)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Customer ID</CardTitle></CardHeader>
              <CardContent className="figure text-xl">{customer.customer_id}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">KYC status</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant={statusVariant(customer.kyc_status)}>{customer.kyc_status}</Badge>
                {customer.is_premium && <Badge variant="outline">Premium</Badge>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display">Accounts</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{a.account_type} account</p>
                    <p className="figure text-sm text-muted-foreground">{maskAccount(a.account_number)}</p>
                  </div>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  <p className="figure text-lg">{formatINR(a.balance)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display">Recent transactions</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                <div className="divide-y">
                  {recent.map((t) => (
                    <div key={t.id} className="flex justify-between py-2 text-sm">
                      <div>
                        <p>{t.remarks ?? t.type}</p>
                        <p className="figure text-xs text-muted-foreground">{t.reference} · {formatDateTime(t.created_at)}</p>
                      </div>
                      <p className="figure">{formatINR(t.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Signed in as staff ({roles.join(", ") || "no role"}). Staff workspaces arrive in later phases.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
