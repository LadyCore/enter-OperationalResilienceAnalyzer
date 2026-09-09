import { useCallback, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabase,
} from "@/integrations/supabase/client";

const EDGE_FUNCTION_NAME = "ora-assistant";
const HISTORY_LIMIT = 10;

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  /** Language the assistant reply was generated in (detected question language). */
  language?: "en" | "es";
  /** Platform language at the moment the reply was generated. */
  createdUnderLanguage?: "en" | "es";
}

export interface AssistantSendInput {
  content: string;
  /** Language the reply should be generated in (detected question language, platform fallback). */
  language: string;
  /** Platform language at send time (used to re-localize history on switch). */
  createdUnderLanguage: "en" | "es";
  /** Current route path. */
  screen: string;
  /** Real screen/organization context (aggregates) built by the caller. */
  screenContext: string;
  /** Active organization id (server-side ownership check). */
  organizationId: string | null;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  RESOURCE_EXHAUSTED: "This website's AI credits have been exhausted. Please contact the website administrator.",
  UNAUTHENTICATED: "Authentication failed. Please refresh the page and try again.",
  PERMISSION_DENIED: "You do not have permission to use the assistant here.",
  INVALID_ARGUMENT: "Invalid request. Please try again.",
  UNAVAILABLE: "Service temporarily unavailable. Please try later.",
  INTERNAL: "The assistant is temporarily unavailable. Please try again.",
};

function getUserErrorMessage(statusOrCode: string, backendMessage: string): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[statusOrCode] ?? "Could not reach the assistant. Please retry.";
}

/**
 * SSE chat with the `ora-assistant` backend function (Gemini streaming).
 * Errors are detected at four levels:
 *  0 connection (onopen)  · 1 stream (onmessage)  · 2 network (onerror)  · 3 exception
 * `X-Session-ID` is sticky per conversation and resets on "new conversation".
 */
export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: AssistantSendInput) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError(getUserErrorMessage("UNAUTHENTICATED", ""));
      return;
    }

    abortRef.current = new AbortController();
    const userMessage: AssistantMessage = { role: "user", content: input.content };
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
      language: (input.language === "es" ? "es" : "en"),
      createdUnderLanguage: input.createdUnderLanguage,
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);
    setError(null);

    const history: { role: "user" | "assistant"; content: string }[] = [
      ...messages.filter((m) => !m.isStreaming && m.content.length > 0),
      userMessage,
    ]
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await fetchEventSource(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          "X-Session-ID": sessionIdRef.current,
        },
        body: JSON.stringify({
          messages: history,
          language: input.language,
          screen: input.screen,
          screenContext: input.screenContext,
          organizationId: input.organizationId,
        }),
        signal: abortRef.current.signal,

        async onopen(response) {
          const contentType = response.headers.get("content-type");
          if (!response.ok) {
            // Level 0: non-2xx. Backend errors are SSE (and gateway errors JSON).
            if (contentType?.includes("text/event-stream")) {
              const text = await response.text();
              const dataMatch = text.match(/data: (.+)/);
              if (dataMatch) {
                try {
                  const errorData = JSON.parse(dataMatch[1]);
                  const message = errorData.error?.message;
                  if (message) throw new Error(message);
                } catch (err) {
                  if (err instanceof Error && err.message !== "Unexpected token") throw err;
                }
              }
            }
            if (contentType?.includes("application/json")) {
              const errorData = await response.json();
              throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
            }
            throw new Error(`Request failed: ${response.status}`);
          }
          if (!contentType?.includes("text/event-stream")) {
            throw new Error(`Expected text/event-stream, got: ${contentType}`);
          }
        },

        onmessage(event) {
          if (!event.data || event.data === "[DONE]") return;
          const data = JSON.parse(event.data);

          if (data.error) {
            const msg = getUserErrorMessage(
              data.error.status || "api_error",
              data.error.message || "",
            );
            setError(msg);
            setMessages((prev) => prev.slice(0, -1));
            setIsLoading(false);
            return;
          }

          const text = data.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text || "")
            .join("");
          if (text) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + text };
              }
              return next;
            });
          }

          if (data.candidates?.[0]?.finishReason) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, isStreaming: false };
              }
              return next;
            });
            setIsLoading(false);
          }
        },

        // Level 2: network errors propagate to the catch below.
        onerror(err) {
          throw err;
        },
      });
    } catch (err) {
      // Level 3: exceptions (AbortError = user cancellation).
      if ((err as Error)?.name !== "AbortError") {
        setError(getUserErrorMessage("api_error", (err as Error)?.message ?? ""));
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, cancel, resetChat };
}
