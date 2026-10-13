import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Landmark,
  LayoutDashboard,
  LogOut,
  CreditCard,
  FileText,
  User,
  Users,
  ArrowLeftRight,
  ShieldAlert,
  Settings,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const customerNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: CreditCard },
  { to: "/statements", label: "Statements", icon: FileText },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users },
  { to: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const staffNav = [
  { to: "/fraud-cases", label: "Fraud Cases", icon: ShieldAlert, roles: ["fraud_analyst", "bank_admin"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["bank_admin"] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user roles for conditional nav
  const { data: rolesData } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (roles ?? []).map(r => r.role);
    },
    staleTime: 60000,
  });
  const userRoles = rolesData ?? [];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Landmark className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-lg">OBS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {customerNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}

          {/* Staff nav — role-gated */}
          {staffNav.filter(n => n.roles.some(r => userRoles.includes(r))).length > 0 && (
            <>
              <div className="my-2 border-t border-sidebar-accent" />
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                Staff
              </p>
              {staffNav
                .filter(n => n.roles.some(r => userRoles.includes(r)))
                .map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                  >
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                ))}
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-accent px-3 py-2">
          <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            Simulated Services
          </p>
        </div>
        <div className="p-3">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <span className="font-display">OBS</span>
          <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
