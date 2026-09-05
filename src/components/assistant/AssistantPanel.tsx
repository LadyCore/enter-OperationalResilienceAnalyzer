import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bot, Loader2, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOra } from "@/store/OraContext";
import { useAssistantChat, type AssistantMessage } from "@/hooks/useAssistantChat";
import { buildAssistantScreenContext } from "@/lib/assistant/context";
import { parseAssistantNavigation } from "@/lib/assistant/navigation";
import { normalizeLanguage } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const { t, i18n } = useTranslation();
  const { db, activeOrganizationId } = useOra();
  const location = useLocation();
  const navigate = useNavigate();
  const { messages, isLoading, error, sendMessage, resetChat } = useAssistantChat();

  const [draft, setDraft] = useState("");
  const lastUserContent = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refresh the screen context right before sending so it reflects the current
  // route and the active organization data at send time.
  const currentContext = useMemo(
    () => (db ? buildAssistantScreenContext(db, location.pathname) : ""),
    [db, location.pathname],
  );

  useEffect(() => {
    if (open) {
      // Move focus to the composer when the panel opens.
      const timer = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, error]);

  if (!open) return null;

  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ?? "en";

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    setDraft("");
    lastUserContent.current = trimmed;
    await sendMessage({
      content: trimmed,
      language,
      screen: location.pathname,
      screenContext: currentContext,
      organizationId: activeOrganizationId,
    });
  };

  const handleRetry = () => {
    const content = lastUserContent.current;
    if (content) void handleSend(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(draft);
    }
  };

  const renderMessage = (message: AssistantMessage, index: number) => {
    const parsed = parseAssistantNavigation(message.content);
    const isLast = index === messages.length - 1;
    const waiting = message.isStreaming || (isLast && isLoading);

    return (
      <div key={`${message.role}-${index}`} className="flex flex-col gap-1.5">
        {parsed.targets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-2">
            {parsed.targets.map((target) => (
              <button
                key={target.path}
                type="button"
                onClick={() => navigate(target.path)}
                className="flex items-center gap-1 rounded-full border bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t("assistant.goTo", { label: target.label })}
              </button>
            ))}
          </div>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed",
            message.role === "user"
              ? "ml-8 rounded-br-sm bg-primary text-primary-foreground"
              : "mr-8 rounded-bl-sm border bg-muted/40",
          )}
        >
          {parsed.cleanContent || (waiting ? t("assistant.thinking") : "")}
          {waiting && <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label={t("assistant.title")}
      className="fixed bottom-24 left-2 right-2 z-50 flex h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:left-auto sm:right-4 sm:w-[26rem]"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b bg-muted/40 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{t("assistant.title")}</p>
          <p className="truncate text-xs text-muted-foreground">{t("assistant.subtitle")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={resetChat}
          aria-label={t("assistant.new")}
          title={t("assistant.new")}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label={t("assistant.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-semibold">{t("assistant.welcomeTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("assistant.welcomeBody")}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "assistant.suggest.excel",
                "assistant.suggest.navigate",
                "assistant.suggest.analysis",
              ].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleSend(t(key))}
                  className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(renderMessage)}
        {error && (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                {t("common.retry")}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetChat}>
                {t("assistant.new")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("assistant.placeholder")}
            rows={1}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => void handleSend(draft)}
            disabled={isLoading || !draft.trim()}
            aria-label={t("assistant.send")}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{t("assistant.contextNote")}</p>
      </div>
    </div>
  );
}
