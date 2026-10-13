import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getMyAccounts } from "@/lib/accounts.functions";
import { getStatement } from "@/lib/statement.functions";
import { formatINR, maskAccount, formatDateTime } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/statements")({
  head: () => ({
    meta: [
      { title: "Statements — OBS" },
      { name: "description", content: "View and export account statements." },
    ],
  }),
  component: StatementsPage,
});

type StatementData = {
  ok: true;
  account: { id: string; account_number: string; account_type: string; balance: number; status: string };
  opening_balance: number;
  closing_balance: number;
  entries: Array<{
    id: number;
    transaction_id: string;
    entry_type: string;
    amount: number;
    balance_after: number | null;
    narration: string | null;
    created_at: string;
    running_balance: number;
  }>;
  from: string;
  to: string;
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
}

function StatementsPage() {
  const doAccounts = useServerFn(getMyAccounts);
  const doStatement = useServerFn(getStatement);

  const [accounts, setAccounts] = useState<Array<{ id: string; account_number: string; account_type: string }>>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [fromDate, setFromDate] = useState(monthAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  async function loadAccounts() {
    if (accountsLoaded) return;
    const res = await doAccounts();
    setAccounts(res.accounts);
    if (res.accounts.length > 0) {
      setSelectedAccount(res.accounts[0].id);
    }
    setAccountsLoaded(true);
  }

  // Load accounts on mount
  if (!accountsLoaded) {
    loadAccounts();
  }

  async function fetchStatement() {
    if (!selectedAccount) return;
    setError(null);
    setStatement(null);
    setLoading(true);
    try {
      const res = await doStatement({ data: { account_id: selectedAccount, from: fromDate, to: toDate } });
      if (!res.ok) {
        setError(res.error);
      } else {
        setStatement(res as StatementData);
      }
    } catch {
      setError("Failed to fetch statement.");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!statement) return;
    const header = "Date,Type,Amount,Running Balance,Narration\n";
    const rows = statement.entries.map((e) =>
      `${e.created_at},${e.entry_type},${e.amount},${e.running_balance},"${e.narration ?? ""}"`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${statement.account.account_number}_${statement.from}_${statement.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Statements</h1>
        <p className="mt-1 text-muted-foreground">View transaction history with running balance.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Select account & date range</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <select
                className="h-9 w-full min-w-[200px] rounded-md border border-input bg-card px-3 text-sm"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} — {maskAccount(a.account_number)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button onClick={fetchStatement} disabled={loading || !selectedAccount}>
              {loading ? "Loading…" : "Generate statement"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {statement && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">
                Statement: {statement.account.account_type} — {maskAccount(statement.account.account_number)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {statement.from} to {statement.to}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-md bg-muted p-4 text-sm">
              <div>
                <p className="text-muted-foreground">Opening balance</p>
                <p className="figure text-lg font-semibold">{formatINR(statement.opening_balance)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Closing balance</p>
                <p className="figure text-lg font-semibold">{formatINR(statement.closing_balance)}</p>
              </div>
            </div>

            {statement.entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No transactions in this period.</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Narration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="figure text-xs">{formatDateTime(e.created_at)}</TableCell>
                        <TableCell>
                          <span className={e.entry_type === "DEBIT" ? "text-destructive" : "text-green-600"}>
                            {e.entry_type}
                          </span>
                        </TableCell>
                        <TableCell className="figure text-right">{formatINR(e.amount)}</TableCell>
                        <TableCell className="figure text-right">{formatINR(e.running_balance)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {e.narration ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
