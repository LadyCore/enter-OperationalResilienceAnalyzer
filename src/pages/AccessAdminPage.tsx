import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Ban,
  CalendarX2,
  Crown,
  FileKey,
  KeyRound,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOra } from "@/store/OraContext";
import { daysLeft, formatDateDDMMYYYY, isExpiring } from "@/lib/access/status";
import {
  getAdminOverview,
  revokeLicense,
  type AdminOverview,
} from "@/lib/access/api";
import { GrantLicenseDialog } from "@/components/access/admin/GrantLicenseDialog";
import { ReissueDemoDialog } from "@/components/access/admin/ReissueDemoDialog";

type ActionTarget = { email: string; id: string } | null;

function StatusBadge({ label, tone }: { label: string; tone: "owner" | "ok" | "warn" | "bad" | "neutral" }) {
  const toneClass = {
    owner: "border-transparent bg-primary/15 text-primary",
    ok: "border-transparent bg-emerald-500/10 text-emerald-600",
    warn: "border-transparent bg-amber-500/10 text-amber-600",
    bad: "border-transparent bg-destructive/10 text-destructive",
    neutral: "border bg-muted text-muted-foreground",
  }[tone];
  return <Badge variant="outline" className={toneClass}>{label}</Badge>;
}

/** Access admin page — only the ORA owner can reach it (route guard). */
export function AccessAdminPage() {
  const { isOwner, refreshAccess } = useOra();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [grantTarget, setGrantTarget] = useState<ActionTarget>(null);
  const [demoTarget, setDemoTarget] = useState<ActionTarget>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getAdminOverview());
    } catch (err) {
      console.error(err);
      toast.error("Could not load access overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const users = overview?.users ?? [];
    const activeDemos = users.filter((u) => {
      const d = u.latestDemo;
      return d && !u.activeLicense && !u.profile.is_owner && d.expires_at > new Date().toISOString();
    }).length;
    const activeLicenses = (overview?.licenses ?? []).filter((l) => l.status === "active").length;
    return {
      users: users.length,
      activeDemos,
      activeLicenses,
      expiredDemos: users.filter((u) => u.latestDemo && u.latestDemo.expires_at <= new Date().toISOString() && !u.activeLicense).length,
    };
  }, [overview]);

  const userStatus = (id: string) => {
    const view = overview?.users.find((u) => u.profile.id === id);
    if (!view) return null;
    if (view.profile.is_owner) return { label: "Owner", tone: "owner" as const };
    if (view.activeLicense) {
      return {
        label: view.activeLicense.modality === "subscription" ? "Subscription active" : "Perpetual license",
        tone: "ok" as const,
      };
    }
    if (view.latestDemo) {
      const remaining = daysLeft(view.latestDemo.expires_at);
      if (remaining === 0) return { label: "DEMO expired", tone: "bad" as const };
      if (isExpiring(remaining)) return { label: `DEMO ${remaining}d left`, tone: "warn" as const };
      return { label: `DEMO ${remaining}d left`, tone: "neutral" as const };
    }
    return { label: "No access", tone: "neutral" as const };
  };

  const handleRevoke = async (licenseId: string) => {
    const result = await revokeLicense(licenseId);
    if (result.ok) {
      toast.success("License revoked.");
      await Promise.all([load(), refreshAccess()]);
    } else {
      toast.error("Could not revoke the license.");
    }
  };

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">You do not have permission to manage access.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileKey className="h-6 w-6 text-primary" /> Access &amp; licensing
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Users, DEMOs and licenses. Subscription is prepared but not enabled yet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.users}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.activeLicenses}</p>
              <p className="text-xs text-muted-foreground">Active licenses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.activeDemos}</p>
              <p className="text-xs text-muted-foreground">Active DEMOs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CalendarX2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.expiredDemos}</p>
              <p className="text-xs text-muted-foreground">Expired DEMOs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && !overview ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Loading access overview…</span>
        </div>
      ) : (
        <>
          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Users</CardTitle>
              <CardDescription>Access state per account. Users without access stay listed for review.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>DEMO / expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.users ?? []).map((view) => {
                    const status = userStatus(view.profile.id);
                    const demo = view.latestDemo;
                    const license = view.activeLicense;
                    return (
                      <TableRow key={view.profile.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {view.profile.is_owner && <Crown className="h-3.5 w-3.5 text-primary" />}
                            {view.profile.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          {status && <StatusBadge label={status.label} tone={status.tone} />}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {demo ? (
                            <>
                              Started {formatDateDDMMYYYY(demo.started_at)} ·{" "}
                              {daysLeft(demo.expires_at) === 0
                                ? `expired ${formatDateDDMMYYYY(demo.expires_at)}`
                                : `expires ${formatDateDDMMYYYY(demo.expires_at)}`}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            {!view.profile.is_owner && !license && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setGrantTarget({ email: view.profile.email ?? "", id: view.profile.id })}
                                >
                                  <KeyRound className="h-3.5 w-3.5" /> License
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDemoTarget({ email: view.profile.email ?? "", id: view.profile.id })}
                                >
                                  DEMO
                                </Button>
                              </>
                            )}
                            {license && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => void handleRevoke(license.id)}
                              >
                                <Ban className="h-3.5 w-3.5" /> Revoke
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Licenses</CardTitle>
              <CardDescription>Licenses belong to a client and can cover multiple users.</CardDescription>
            </CardHeader>
            <CardContent>
              {(overview?.licenses ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses registered yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Modality</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Issued</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.licenses ?? []).map((l) => {
                      const client = overview?.clients.find((c) => c.id === l.client_id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{client?.name ?? "Unknown client"}</TableCell>
                          <TableCell className="capitalize">{l.modality}</TableCell>
                          <TableCell>
                            <StatusBadge
                              label={l.status}
                              tone={l.status === "active" ? "ok" : "bad"}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{l.version}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateDDMMYYYY(l.issued_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* DEMO usage history — 12-month eligibility ledger */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">DEMO usage history</CardTitle>
              <CardDescription>
                DNI/CUIT usage drives the 12-month reuse rule, independent of user accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(overview?.usageHistory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No DEMO usage recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Eligible again</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.usageHistory ?? []).map((u) => {
                      const client = overview?.clients.find((c) => c.id === u.client_id);
                      const eligible = new Date(u.used_at);
                      eligible.setFullYear(eligible.getFullYear() + 1);
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono">{u.tax_id}</TableCell>
                          <TableCell className="uppercase">{u.tax_type}</TableCell>
                          <TableCell className="font-medium">{client?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateDDMMYYYY(u.used_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateDDMMYYYY(eligible)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <GrantLicenseDialog
        open={Boolean(grantTarget)}
        onOpenChange={(open) => !open && setGrantTarget(null)}
        presetEmail={grantTarget?.email ?? ""}
        onDone={() => {
          setGrantTarget(null);
          void load();
          void refreshAccess();
        }}
      />
      <ReissueDemoDialog
        open={Boolean(demoTarget)}
        onOpenChange={(open) => !open && setDemoTarget(null)}
        presetEmail={demoTarget?.email ?? ""}
        onDone={() => {
          setDemoTarget(null);
          void load();
          void refreshAccess();
        }}
      />
    </div>
  );
}
