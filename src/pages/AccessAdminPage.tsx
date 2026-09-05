import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  UserPlus,
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
import { AddLicenseUserDialog } from "@/components/access/admin/AddLicenseUserDialog";

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

/** Static i18n keys for raw license values — translate at render time with t(). */
const licenseModalityKey: Record<string, string> = {
  perpetual: "license.perpetual",
  subscription: "license.subscription",
};
const licenseStatusKey: Record<string, string> = {
  active: "accessAdmin.licenseStatus.active",
  revoked: "accessAdmin.licenseStatus.revoked",
};
const licenseTypeKey: Record<string, string> = {
  individual: "license.type.individual",
  company: "license.type.company",
};
const LICENSE_SEAT_CAP: Record<string, number> = { individual: 1, company: 4 };

/** Access admin page — only the ORA owner can reach it (route guard). */
export function AccessAdminPage() {
  const { t } = useTranslation();
  const { isOwner, refreshAccess } = useOra();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [grantTarget, setGrantTarget] = useState<ActionTarget>(null);
  const [demoTarget, setDemoTarget] = useState<ActionTarget>(null);
  const [licenseUserTarget, setLicenseUserTarget] = useState<{ licenseId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getAdminOverview());
    } catch (err) {
      console.error(err);
      toast.error(t("accessAdmin.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    if (view.profile.is_owner) return { label: t("accessAdmin.status.owner"), tone: "owner" as const };
    if (view.activeLicense) {
      return {
        label:
          view.activeLicense.modality === "subscription"
            ? t("accessAdmin.status.subscriptionActive")
            : t("accessAdmin.status.perpetual"),
        tone: "ok" as const,
      };
    }
    if (view.latestDemo) {
      const remaining = daysLeft(view.latestDemo.expires_at);
      if (remaining === 0) return { label: t("accessAdmin.status.demoExpired"), tone: "bad" as const };
      if (isExpiring(remaining)) {
        return { label: t("accessAdmin.status.demoLeft", { count: remaining }), tone: "warn" as const };
      }
      return { label: t("accessAdmin.status.demoLeft", { count: remaining }), tone: "neutral" as const };
    }
    return { label: t("accessAdmin.status.noAccess"), tone: "neutral" as const };
  };

  const handleRevoke = async (licenseId: string) => {
    const result = await revokeLicense(licenseId);
    if (result.ok) {
      toast.success(t("accessAdmin.revokedToast"));
      await Promise.all([load(), refreshAccess()]);
    } else {
      toast.error(t("accessAdmin.revokeFailed"));
    }
  };

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("accessAdmin.forbidden")}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">{t("accessAdmin.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileKey className="h-6 w-6 text-primary" /> {t("nav.accessLicensing")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("accessAdmin.subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> {t("accessAdmin.refresh")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.users}</p>
              <p className="text-xs text-muted-foreground">{t("accessAdmin.stat.users")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.activeLicenses}</p>
              <p className="text-xs text-muted-foreground">{t("accessAdmin.stat.activeLicenses")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.activeDemos}</p>
              <p className="text-xs text-muted-foreground">{t("accessAdmin.stat.activeDemos")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CalendarX2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{stats.expiredDemos}</p>
              <p className="text-xs text-muted-foreground">{t("accessAdmin.stat.expiredDemos")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && !overview ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">{t("accessAdmin.loadingOverview")}</span>
        </div>
      ) : (
        <>
          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("accessAdmin.usersTitle")}</CardTitle>
              <CardDescription>{t("accessAdmin.usersHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("accessAdmin.th.user")}</TableHead>
                    <TableHead>{t("accessAdmin.th.access")}</TableHead>
                    <TableHead>{t("accessAdmin.th.demoExpiry")}</TableHead>
                    <TableHead className="text-right">{t("accessAdmin.th.actions")}</TableHead>
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
                              {daysLeft(demo.expires_at) === 0
                                ? t("accessAdmin.demoExpiredLine", {
                                    started: formatDateDDMMYYYY(demo.started_at),
                                    expires: formatDateDDMMYYYY(demo.expires_at),
                                  })
                                : t("accessAdmin.demoActiveLine", {
                                    started: formatDateDDMMYYYY(demo.started_at),
                                    expires: formatDateDDMMYYYY(demo.expires_at),
                                  })}
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
                                  <KeyRound className="h-3.5 w-3.5" /> {t("accessAdmin.action.license")}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDemoTarget({ email: view.profile.email ?? "", id: view.profile.id })}
                                >
                                  {t("common.demo")}
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
                                <Ban className="h-3.5 w-3.5" /> {t("accessAdmin.action.revoke")}
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
              <CardTitle className="text-sm">{t("accessAdmin.licensesTitle")}</CardTitle>
              <CardDescription>{t("accessAdmin.licensesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {(overview?.licenses ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("accessAdmin.noLicenses")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("accessAdmin.th.client")}</TableHead>
                      <TableHead>{t("accessAdmin.th.modality")}</TableHead>
                      <TableHead>{t("license.type")}</TableHead>
                      <TableHead>{t("accessAdmin.th.status")}</TableHead>
                      <TableHead>{t("accessAdmin.th.users")}</TableHead>
                      <TableHead>{t("accessAdmin.th.version")}</TableHead>
                      <TableHead>{t("accessAdmin.th.issued")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.licenses ?? []).map((l) => {
                      const client = overview?.clients.find((c) => c.id === l.client_id);
                      const modalityKey = licenseModalityKey[l.modality];
                      const statusKey = licenseStatusKey[l.status];
                      const typeKey = licenseTypeKey[l.license_type];
                      const cap = LICENSE_SEAT_CAP[l.license_type] ?? 1;
                      const used = (overview?.licenseUserCounts ?? {})[l.id] ?? 0;
                      const full = used >= cap;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{client?.name ?? t("accessAdmin.unknownClient")}</TableCell>
                          <TableCell>{modalityKey ? t(modalityKey) : l.modality}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {typeKey ? t(typeKey) : l.license_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              label={statusKey ? t(statusKey) : l.status}
                              tone={l.status === "active" ? "ok" : "bad"}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={full ? "text-xs font-medium text-risk-critical" : "text-xs text-muted-foreground"}>
                                {t("license.usersCount", { used, max: cap })}
                              </span>
                              {l.modality === "perpetual" && l.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={full}
                                  onClick={() => setLicenseUserTarget({ licenseId: l.id })}
                                >
                                  <UserPlus className="h-3.5 w-3.5" /> {t("license.addUser")}
                                </Button>
                              )}
                            </div>
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
              <CardTitle className="text-sm">{t("accessAdmin.usageTitle")}</CardTitle>
              <CardDescription>
                {t("accessAdmin.usageHint")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(overview?.usageHistory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("accessAdmin.noUsage")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("accessAdmin.th.taxId")}</TableHead>
                      <TableHead>{t("accessAdmin.th.type")}</TableHead>
                      <TableHead>{t("accessAdmin.th.client")}</TableHead>
                      <TableHead>{t("accessAdmin.th.used")}</TableHead>
                      <TableHead>{t("accessAdmin.th.eligibleAgain")}</TableHead>
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
      <AddLicenseUserDialog
        open={Boolean(licenseUserTarget)}
        onOpenChange={(open) => !open && setLicenseUserTarget(null)}
        licenseId={licenseUserTarget?.licenseId ?? ""}
        onDone={() => {
          setLicenseUserTarget(null);
          void load();
        }}
      />
    </div>
  );
}
