import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useOra } from "@/store/OraContext";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";
import { FEEDBACK_MODULES } from "@/lib/feedback/context";
import {
  FEEDBACK_STATUSES,
  listFeedback,
  migrateFeedbackScreenshots,
  resolvePageAfterRefresh,
  updateFeedbackStatus,
  type FeedbackPage,
  type FeedbackStatus,
} from "@/lib/feedback/admin";
import { FeedbackDetailDialog } from "@/components/feedback/FeedbackDetailDialog";
import {
  feedbackKindLabelKeys,
  feedbackStatusLabelKeys,
} from "@/components/feedback/feedbackI18n";

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const toneClass =
    status === "new"
      ? "border-transparent bg-risk-critical/10 text-risk-critical"
      : status === "in_progress"
        ? "border-transparent bg-risk-high/10 text-risk-high"
        : "border-transparent bg-risk-low/10 text-risk-low";
  return (
    <Badge className={toneClass}>
      {status === "new" || status === "in_progress" || status === "resolved"
        ? t(feedbackStatusLabelKeys[status])
        : status}
    </Badge>
  );
}

export function FeedbackAdminPage() {
  const { t } = useTranslation();
  const { isOwner } = useOra();

  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [kind, setKind] = useState<string>("all");
  const [module, setModule] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<Awaited<ReturnType<typeof listFeedback>>["rows"]>([]);
  const [total, setTotal] = useState(0);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  const load = useCallback(async (): Promise<FeedbackPage | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await listFeedback(
        {
          status: status === "all" ? null : status,
          kind: kind === "all" ? null : kind,
          module: module === "all" ? null : module,
          search: search.trim() || null,
          from: from || null,
          to: to || null,
        },
        page,
        PAGE_SIZE,
      );
      setRows(result.rows);
      setTotal(result.total);
      setEmails(result.emails);
      return result;
    } catch (err) {
      console.error("Failed to load feedback:", err);
      setError(t("feedbackAdmin.loadFailed"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [status, kind, module, search, from, to, page, t]);

  useEffect(() => {
    if (!isOwner) return;
    void load();
  }, [load, isOwner]);

  // Any filter change resets to the first page (except the page itself).
  const applyFilter = <T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setPage(0);
  };

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const handleStatusChange = async (id: string, next: FeedbackStatus) => {
    try {
      await updateFeedbackStatus(id, next);
      toast.success(t("feedbackAdmin.statusUpdated"));
      // Refresh the list after a successful UPDATE so rows that no longer match
      // the active filters disappear immediately, while keeping the current
      // page when it remains valid (stepping back only if it became empty).
      const result = await load();
      if (result) {
        const nextPage = resolvePageAfterRefresh(page, result.rows.length, result.total, PAGE_SIZE);
        if (nextPage !== page) setPage(nextPage);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("feedbackAdmin.statusUpdateFailed"));
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const result = await migrateFeedbackScreenshots();
      toast.success(
        result.migrated > 0
          ? t("feedbackAdmin.migratedToast", { count: result.migrated })
          : t("feedbackAdmin.nothingToMigrate"),
      );
      await load();
    } catch (err) {
      console.error(err);
      toast.error(t("feedbackAdmin.migrateFailed"));
    } finally {
      setMigrating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLabel =
    total === 0
      ? t("feedbackAdmin.reportsZero")
      : t("feedbackAdmin.showingRange", {
          from: page * PAGE_SIZE + 1,
          to: Math.min((page + 1) * PAGE_SIZE, total),
          total,
        });

  const filtersActive = status !== "all" || kind !== "all" || module !== "all" || Boolean(search.trim()) || Boolean(from) || Boolean(to);

  const filterPanel = (
    <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedback.fields.status")}</label>
        <Select value={status} onValueChange={(v) => applyFilter(setStatus, v as FeedbackStatus | "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("feedbackAdmin.filter.anyStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("feedbackAdmin.filter.anyStatus")}</SelectItem>
            {FEEDBACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(feedbackStatusLabelKeys[s])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedbackAdmin.filter.type")}</label>
        <Select value={kind} onValueChange={(v) => applyFilter(setKind, v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("feedbackAdmin.filter.anyType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("feedbackAdmin.filter.anyType")}</SelectItem>
            {FEEDBACK_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {t(feedbackKindLabelKeys[k.value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedback.fields.module")}</label>
        <Select value={module} onValueChange={(v) => applyFilter(setModule, v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("feedbackAdmin.filter.anyModule")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("feedbackAdmin.filter.anyModule")}</SelectItem>
            {FEEDBACK_MODULES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedbackAdmin.filter.from")}</label>
        <Input type="date" value={from} onChange={(e) => applyFilter(setFrom, e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedbackAdmin.filter.to")}</label>
        <Input type="date" value={to} onChange={(e) => applyFilter(setTo, e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{t("feedbackAdmin.filter.searchDescription")}</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => applyFilter(setSearch, e.target.value)}
            placeholder={t("common.search")}
            className="pl-8"
          />
        </div>
      </div>
    </div>
  );

  // Non-owner route guard (the backend RLS enforces the same boundary).
  if (!isOwner) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("feedbackAdmin.forbidden")}</p>
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
            <MessageSquareText className="h-6 w-6 text-primary" /> {t("nav.feedback")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("feedbackAdmin.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleMigrate()} disabled={loading || migrating}>
            {migrating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {t("feedbackAdmin.moveScreenshots")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> {t("accessAdmin.refresh")}
          </Button>
        </div>
      </div>

      {filterPanel}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">{t("feedbackAdmin.loading")}</span>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={t("feedbackAdmin.emptyTitle")}
          description={
            filtersActive ? t("feedbackAdmin.emptyFiltered") : t("feedbackAdmin.emptyDefault")
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("feedbackAdmin.reportsTitle")}</CardTitle>
              <CardDescription>{pageLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("feedback.fields.dateTime")}</TableHead>
                    <TableHead>{t("feedback.fields.type")}</TableHead>
                    <TableHead>{t("feedback.description")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("feedbackAdmin.th.moduleScreen")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("feedback.fields.stage")}</TableHead>
                    <TableHead>{t("feedback.fields.status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("feedbackAdmin.th.user")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const kindEntry = FEEDBACK_KINDS.find((k) => k.value === r.kind);
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(r.id)}
                      >
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {kindEntry ? t(feedbackKindLabelKeys[kindEntry.value]) : r.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span className="line-clamp-2 text-sm">{r.description}</span>
                          {r.is_general && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {t("feedbackAdmin.generalTag")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {r.module ?? "—"}
                          {r.screen ? ` · ${r.screen}` : ""}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {r.stage ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {r.user_id ? (emails[r.user_id] ?? t("feedbackAdmin.signedInUser")) : t("feedbackAdmin.anonymous")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{pageLabel}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t("ui.previous")}
              </Button>
              <span className="flex items-center px-2 text-xs text-muted-foreground">
                {t("feedbackAdmin.pageOf", { page: page + 1, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                {t("ui.next")}
              </Button>
            </div>
          </div>
        </>
      )}

      <FeedbackDetailDialog
        feedback={selected}
        email={selected?.user_id ? (emails[selected.user_id] ?? undefined) : undefined}
        onClose={() => setSelectedId(null)}
        onStatusChange={(next) => {
          if (selected) void handleStatusChange(selected.id, next);
        }}
      />
    </div>
  );
}
