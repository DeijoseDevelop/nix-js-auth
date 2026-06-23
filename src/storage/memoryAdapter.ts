import type { AuthStorage } from "../core/types";

export function memoryAdapter<Session>(): AuthStorage<Session> {
  let value: Session | null = null;

  return {
    get() {
      return value;
    },
    set(session) {
      value = session;
    },
    remove() {
      value = null;
    },
  };
}
