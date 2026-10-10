// Registers every domain's actions (import side effects) and the router.
import type { McpServer } from "@modelcontextprotocol/server";
import "./tools/expedients";
import "./tools/dedicacio";
import "./tools/planificacio";
import "./tools/clients";
import "./tools/facturacio";
import "./tools/propostes";
import "./tools/honoraris";
import "./tools/actes";
import "./tools/notes";
import { registerRouter } from "./router";

export const SERVER_NAME = "dacarquitectura";
export const SERVER_VERSION = "1.0.0";

export const SERVER_INSTRUCTIONS = `DacArquitectura is the internal management app of an architecture office (data and UI in Catalan). Domains: expedients (projects, numbered YY-NNNN), planificacio (dates, fites/milestones, site visits), dedicacio (hours logged per expedient or internal activity), actes (site-visit and meeting minutes), honoraris (fee calculations, "càlculs"), propostes (fee proposal documents PH-YY-NNN), facturacio (invoices YY-NNN), clients and contactes, notes.

How to work:
1. Find things first: use \`cerca\` (free text) or \`dac_read\` with a list_* action. Never guess an id or a number; resolve it from a read. Wherever an action takes expedient_num (or num for get_expedient), it accepts the full number ("26-0120"), a short form ("26-120", "120") or words from the project, client or city name; if several match, the error lists them: ask the user which one. Searches ignore accents. If nothing is found, try fewer or different words before telling the user it does not exist.
2. \`dac_actions\` without arguments lists every action; with action=<name> it returns the exact JSON Schema of its args. Check it before calling an action you have not used in this conversation.
3. Reads go through \`dac_read\` {action, args}. Changes go through \`dac_change\` {action, args, confirm, idempotency_key}.
4. Every change is two steps. First call with confirm=false: you get a preview (summary, details, warnings) and nothing is saved. Show the summary to the user in their language. Only after the user explicitly agrees, call again with the same action and args, confirm=true and the idempotency_key the preview suggested. If a confirmed call fails with a network error, retry with the same key: it will never write twice.
5. If the preview reports errors, fix the arguments and preview again; do not confirm.
6. Dates are YYYY-MM-DD; money is a plain number in euros; hours are decimal (1.5 = 1 h 30 min). The current year prefix is used for new numbers.
7. Answer in the user's language (usually Catalan). Be concise: quote numbers, names and dates from the tool results rather than paraphrasing them.
8. Actes (minutes): create_acta, update_acta and duplicate_acta can fill in every part of an acta in one call — motiu, expedient or dedicació, general data, attendees, temes (categoria pendent/executat/tractat, title, text, responsables), next visit and signatures. Read it first with get_acta: list items carry an index used by modificar_*/treure_*. Responsables may be given as initials ("DL") or first names; they are matched to the attendees. When the user dictates or pastes notes, turn them into temes rather than one long text.
9. Photos, PDFs and audio for an acta: when the user wants to add photos, call dac_read acta_enllac_fotos and give them the returned link as is. It opens a private page (no login, valid 24 h, only for that acta) where they take or pick photos on their phone or computer; they are compressed and added to the acta. Then check with get_acta. This is the way in Claude and in the ChatGPT phone apps, which do not pass chat images to tools. In ChatGPT on the web or desktop a file attached to the chat can also go straight in with the acta_afegir_fitxer tool ("fitxer"); a public https link can go in as "url".
10. Deleting expedients, clients, invoices, proposals or actes is not available here.`;

export function registerAll(server: McpServer): void {
  registerRouter(server);
}
