import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

// Neon (and pg generally) returns BIGINT (int8) as a JS string by default to
// avoid precision loss. We never have ids ≥ 2^53, so parse them as numbers —
// otherwise client-side comparisons like `concept.id === pickedId` silently
// fail because they compare "1" to 1.
types.setTypeParser(types.builtins.INT8 as unknown as number, (val: string) => parseInt(val, 10));

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  _sql = neon(url);
  return _sql;
}

// Tagged-template proxy: forwards both the tag call and the `.query` method
// to a lazily-initialised Neon client. Keeps the ergonomic `sql\`...\`` API.
export const sql: NeonQueryFunction<false, false> = new Proxy(
  function () {} as unknown as NeonQueryFunction<false, false>,
  {
    apply(_t, _thisArg, args) {
      const client = getSql();
      return (client as (...a: unknown[]) => unknown)(...args);
    },
    get(_t, prop) {
      const client = getSql() as unknown as Record<string, unknown>;
      return client[prop as string];
    },
  },
);
