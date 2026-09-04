import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";
import { isDemoSession } from "@/lib/auth";

// Neon (and pg generally) returns BIGINT (int8) as a JS string by default to
// avoid precision loss. We never have ids ≥ 2^53, so parse them as numbers —
// otherwise client-side comparisons like `concept.id === pickedId` silently
// fail because they compare "1" to 1.
types.setTypeParser(types.builtins.INT8 as unknown as number, (val: string) => parseInt(val, 10));

const clients = new Map<string, NeonQueryFunction<false, false>>();

function clientFor(url: string): NeonQueryFunction<false, false> {
  let client = clients.get(url);
  if (!client) {
    client = neon(url);
    clients.set(url, client);
  }
  return client;
}

// Which database this request talks to depends on who is logged in: the "demo"
// account gets DEMO_DATABASE_URL (fake data, safe to click around in front of a
// client), everyone else gets the real one.
async function currentClient(): Promise<NeonQueryFunction<false, false>> {
  if (await isDemoSession()) {
    const demoUrl = process.env.DEMO_DATABASE_URL;
    if (!demoUrl) {
      throw new Error("DEMO_DATABASE_URL is not set");
    }
    return clientFor(demoUrl);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return clientFor(url);
}

// Tagged-template proxy: forwards both the tag call and the `.query` method to
// the client for the current session. Keeps the ergonomic `sql\`...\`` API.
export const sql: NeonQueryFunction<false, false> = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_t, _thisArg, args) {
      return (async () => {
        const client = await currentClient();
        return (client as unknown as (...a: unknown[]) => unknown)(...args);
      })();
    },
    get(_t, prop) {
      if (prop === "query" || prop === "transaction") {
        return async (...args: unknown[]) => {
          const client = (await currentClient()) as unknown as Record<
            string,
            (...a: unknown[]) => unknown
          >;
          return client[prop as string](...args);
        };
      }
      return undefined;
    },
  },
);
