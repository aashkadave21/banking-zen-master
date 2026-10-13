import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyOverview } from "@/lib/me.functions";
import { formatDateTime, formatINR, maskAccount } from "@/lib/format";
import { ArrowLeftRight, CreditCard, FileText, Users, User } from "lucide-react";

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

const quickActions = [
  { to: "/transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-blue-600" },
  { to: "/accounts", label: "Accounts", icon: CreditCard, color: "text-emerald-600" },
  { to: "/statements", label: "Statements", icon: FileText, color: "text-amber-600" },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users, color: "text-purple-600" },
  { to: "/profile", label: "Profile", icon: User, color: "text-pink-600" },
] as const;

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
                {customer.kyc_status === "Pending" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/profile">Verify KYC</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <Card>
            <CardHeader><CardTitle className="font-display">Quick actions</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {quickActions.map((a) => (
                  <Button key={a.to} variant="outline" asChild className="h-auto flex-col gap-1 px-6 py-4">
                    <Link to={a.to}>
                      <a.icon className={`h-5 w-5 ${a.color}`} />
                      <span className="text-xs">{a.label}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Recent transactions</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/statements">View all</Link></Button>
            </CardHeader>
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
                      <div className="text-right">
                        <p className="figure">{formatINR(t.amount)}</p>
                        <Badge variant={t.status === "Posted" || t.status === "Settled" ? "default" : t.status === "Failed" || t.status === "Blocked" ? "destructive" : "secondary"} className="text-[10px]">
                          {t.status}
                        </Badge>
                      </div>
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
