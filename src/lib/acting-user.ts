import { AsyncLocalStorage } from "node:async_hooks";
import type { AppUser } from "@/lib/auth";

// Who a plugin (MCP) call acts as. The website finds its user through the
// iron-session cookie; an OAuth request from ChatGPT or Claude has no such
// cookie, so the MCP guard runs each tool call inside this context and the
// auth helpers (requireUser, isDemoSession) read it first. The context only
// exists inside the tool's own async chain — browser requests never see it.
const storage = new AsyncLocalStorage<{ user: AppUser }>();

export function runAsActingUser<T>(user: AppUser, fn: () => Promise<T>): Promise<T> {
  return storage.run({ user }, fn);
}

export function getActingUser(): AppUser | undefined {
  return storage.getStore()?.user;
}
