import { AUTH_TOKEN_KEY } from "./httpClient";

const LOCATION_KEY = "ghl_location_id";

const AUTH_REQUEST_TYPE = "GHL_OBS_AUTH_REQUEST";
const AUTH_RESPONSE_TYPE = "GHL_OBS_AUTH_RESPONSE";
const AUTH_PUSH_TYPE = "GHL_OBS_AUTH_PUSH";

interface ParentAuthMessage {
  type: string;
  token?: string;
  locationId?: string;
}

function isInIframe(): boolean {
  return window.self !== window.top;
}

function parentOriginFromReferrer(): string | null {
  if (!document.referrer) return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

function isValidAuthMessage(data: unknown): data is ParentAuthMessage {
  if (!data || typeof data !== "object") return false;
  const candidate = data as ParentAuthMessage;

  const isExpectedType =
    candidate.type === AUTH_RESPONSE_TYPE || candidate.type === AUTH_PUSH_TYPE;
  const hasToken = typeof candidate.token === "string" && candidate.token.length > 0;
  return isExpectedType && hasToken;
}

function persistAuthPayload(payload: ParentAuthMessage): void {
  if (payload.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  }
  if (payload.locationId && typeof payload.locationId === "string") {
    localStorage.setItem(LOCATION_KEY, payload.locationId);
  }
}

function isTrustedParentMessage(event: MessageEvent): boolean {
  if (!isInIframe()) return false;
  if (event.source !== window.parent) return false;

  const expectedOrigin = parentOriginFromReferrer();
  if (expectedOrigin && event.origin !== expectedOrigin) return false;

  return true;
}

let bridgeListenerInstalled = false;

export function installIframeAuthBridge(): void {
  if (bridgeListenerInstalled) return;
  bridgeListenerInstalled = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (!isTrustedParentMessage(event)) return;
    if (!isValidAuthMessage(event.data)) return;
    persistAuthPayload(event.data);
  });
}

export async function requestAuthFromParent(timeoutMs: number = 1500): Promise<boolean> {
  if (!isInIframe()) return false;

  const existing = localStorage.getItem(AUTH_TOKEN_KEY);
  if (existing) return true;

  return new Promise<boolean>((resolve) => {
    const expectedOrigin = parentOriginFromReferrer();
    const targetOrigin = expectedOrigin || "*";

    let resolved = false;
    const finish = (success: boolean): void => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(success);
    };

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedParentMessage(event)) return;
      if (!isValidAuthMessage(event.data)) return;
      persistAuthPayload(event.data);
      finish(true);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener("message", onMessage);

    window.parent.postMessage({ type: AUTH_REQUEST_TYPE }, targetOrigin);
  });
}

export const iframeAuthMessageTypes = {
  AUTH_REQUEST_TYPE,
  AUTH_RESPONSE_TYPE,
  AUTH_PUSH_TYPE
};

