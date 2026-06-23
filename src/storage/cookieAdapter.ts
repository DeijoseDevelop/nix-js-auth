import type { AuthStorage } from "../core/types";

export interface CookieAdapterOptions {
  key: string;
  days?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

function parseCookies(): Record<string, string> {
  const hasDocument = typeof globalThis !== "undefined" && "document" in globalThis;
  if (!hasDocument) return {};
  return Object.fromEntries(
    globalThis.document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return [entry.slice(0, index), entry.slice(index + 1)];
      }),
  );
}

export function cookieAdapter<Session>(options: CookieAdapterOptions): AuthStorage<Session> {
  const { key, days = 7, path = "/", secure, sameSite = "lax" } = options;
  const hasDocument = typeof globalThis !== "undefined" && "document" in globalThis;

  return {
    get() {
      if (!hasDocument) return null;
      try {
        const raw = parseCookies()[key];
        if (!raw) return null;
        return JSON.parse(decodeURIComponent(raw)) as Session;
      } catch {
        return null;
      }
    },
    set(session) {
      if (!hasDocument) return;
      const flags = [
        `path=${path}`,
        `max-age=${session === null ? 0 : days * 24 * 60 * 60}`,
        `samesite=${sameSite}`,
        secure ? "secure" : "",
      ]
        .filter(Boolean)
        .join("; ");
      if (session === null) {
        globalThis.document.cookie = `${key}=; ${flags}`;
      } else {
        const value = encodeURIComponent(JSON.stringify(session));
        globalThis.document.cookie = `${key}=${value}; ${flags}`;
      }
    },
    remove() {
      if (!hasDocument) return;
      const flags = [`path=${path}`, "max-age=0", `samesite=${sameSite}`, secure ? "secure" : ""]
        .filter(Boolean)
        .join("; ");
      globalThis.document.cookie = `${key}=; ${flags}`;
    },
  };
}
