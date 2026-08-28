import {
  bootstrapEnterAnalytics,
  replaceEventDefinitions,
  type EventDefinition,
} from '@enter-pro/analytics-sdk';

type EventDefinitionsPayload =
  | EventDefinition[]
  | {
      definitions?: EventDefinition[];
      events?: EventDefinition[];
      data?: {
        definitions?: EventDefinition[];
        events?: EventDefinition[];
      };
    };

declare global {
  interface Window {
    __ENTER_ANALYTICS_DEFINITIONS__?: EventDefinition[];
  }
}

function normalizeEventDefinitions(payload: EventDefinitionsPayload): EventDefinition[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.definitions ?? payload.events ?? payload.data?.definitions ?? payload.data?.events ?? [];
}

async function loadEventDefinitions(): Promise<EventDefinition[]> {
  if (typeof window !== 'undefined' && Array.isArray(window.__ENTER_ANALYTICS_DEFINITIONS__)) {
    return window.__ENTER_ANALYTICS_DEFINITIONS__;
  }

  const endpoint = import.meta.env.VITE_ENTER_ANALYTICS_DEFINITIONS_ENDPOINT;
  if (!endpoint) {
    return [];
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return [];
    }

    return normalizeEventDefinitions((await response.json()) as EventDefinitionsPayload);
  } catch {
    return [];
  }
}

export function bootstrapGeneratedSiteAnalytics(): void {
  // Telemetry bootstrap is non-essential: if it ever fails it must never throw
  // into main.tsx and prevent the app from mounting (blank preview, empty #root).
  try {
    bootstrapEnterAnalytics();
  } catch (err) {
    console.error("Failed to bootstrap analytics:", err);
    return;
  }

  void loadEventDefinitions().then((definitions) => {
    if (definitions.length > 0) {
      replaceEventDefinitions(definitions);
    }
  });
}
