// Every value the portal's form offers in its dropdowns (cataleg-portal.json,
// made by scripts/ite-cataleg-portal.mjs from docs/ite-portal-formulari.txt):
// 949 municipalities, 124 street types, 103 deficiency types… Kept out of
// cataleg.ts so the browser bundle does not carry them: the server builds the
// lists and sends them with the page.
import PORTAL from "./cataleg-portal.json";
import { buildCataleg, type CatEntry, type Cataleg } from "./cataleg";

export const PORTAL_ENTRIES = PORTAL as unknown as CatEntry[];

export function buildCatalegComplet(extra: CatEntry[] = []): Cataleg {
  return buildCataleg([...PORTAL_ENTRIES, ...extra]);
}
