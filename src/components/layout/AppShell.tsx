import { Suspense, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Activity,
  Award,
  Building2,
  CalendarClock,
  Check,
  ChevronsUpDown,
  CircleUserRound,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import { useOra } from "@/store/OraContext";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/processes", label: "Processes", icon: Workflow },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/competencies", label: "Competencies", icon: Award },
  { to: "/people", label: "People", icon: Users },
  { to: "/analysis", label: "Analysis", icon: Activity },
  { to: "/simulation", label: "Simulation", icon: CalendarClock },
  { to: "/organization", label: "Organization", icon: Building2 },
  { to: "/access", label: "Access & licensing", icon: KeyRound, ownerOnly: true },
  { to: "/feedback", label: "Feedback", icon: MessageSquareText, ownerOnly: true },
];

function SidebarNav() {
  const { isOwner } = useOra();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav
        .filter((item) => !item.ownerOnly || isOwner)
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-bold tracking-tight">ORA</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/60">
          Resilience Analyzer
        </p>
      </div>
    </div>
  );
}

function OrganizationSwitcher() {
  const { organizations, activeOrganizationId, setActiveOrganization } = useOra();
  const navigate = useNavigate();
  const active = organizations.find((o) => o.id === activeOrganizationId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
        >
          <span className="min-w-0 truncate">{active?.name ?? "Organization"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-64">
        {organizations.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => void setActiveOrganization(o.id)}>
            <span className="min-w-0 flex-1 truncate">{o.name}</span>
            {o.isDemo && (
              <Badge variant="secondary" className="ml-2 shrink-0 px-1.5 text-[10px] font-medium">
                Demo
              </Badge>
            )}
            {o.id === activeOrganizationId && <Check className="ml-1 h-4 w-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/import")}>
          <Plus className="h-4 w-4" />
          Import organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useOra();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <CircleUserRound className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{user?.email}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}

function MobileNav() {
  const { isOwner } = useOra();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground lg:hidden">
      {nav
        .filter((item) => !item.ownerOnly || isOwner)
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70"
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        ))}
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="space-y-4 px-4 py-5">
          <Brand />
          <OrganizationSwitcher />
        </div>
        <SidebarNav />
        <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
          <p className="text-[11px] leading-relaxed text-sidebar-foreground/55">
            Analyzes operational dependency and capability coverage — never individual performance.
          </p>
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <div className="min-w-0 flex-1">
            <Brand />
          </div>
          <div className="w-44 shrink-0">
            <OrganizationSwitcher />
          </div>
        </header>
        <MobileNav />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
