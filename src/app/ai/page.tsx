import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { listConnections } from "@/lib/mcp/oauth-db";
import { clientKindFromUserAgent } from "@/lib/mcp/oauth-core";
import { revokeConnectionAction } from "./actions";

export const dynamic = "force-dynamic";

async function currentOrigin(): Promise<string> {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

const KIND_LABEL: Record<string, string> = { chatgpt: "ChatGPT", claude: "Claude", other: "Altre client" };

export default async function AiPage() {
  const user = await requireUser();
  const origin = await currentOrigin();
  const mcpUrl = `${origin}/api/mcp`;
  const connections = await listConnections(user);

  return (
    <>
      <AppNav current="ai" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Assistent d&apos;IA</h1>
        <p className="text-sm text-[var(--color-muted)] mb-8">
          Fes servir ChatGPT o Claude per consultar i actualitzar l&apos;aplicació: «Quantes hores he dedicat aquest mes al 26-0012?»,
          «Registra 2 h de visita d&apos;obra avui a Casa Vila», «Fes l&apos;acta de la reunió d&apos;avui amb aquests temes…». Cada canvi es
          previsualitza al xat i només es desa quan el confirmes.
        </p>

        <section className="card mb-6">
          <h2 className="text-base font-semibold mb-2">Adreça del plugin</h2>
          <code className="block rounded-md bg-[var(--color-accent-soft)] px-3 py-2 text-sm break-all select-all">{mcpUrl}</code>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            És un servidor MCP (Model Context Protocol) amb OAuth. En connectar-lo t&apos;apareixerà la pantalla d&apos;inici de sessió d&apos;aquesta
            aplicació: entra amb el teu usuari i contrasenya habituals.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <section className="card">
            <h2 className="text-base font-semibold mb-3">ChatGPT</h2>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm">
              <li>A ChatGPT (web o escriptori), obre <strong>Configuració → Aplicacions i connectors</strong> (o «Plugins»).</li>
              <li>Tria <strong>Crear / Afegir connector MCP personalitzat</strong>.</li>
              <li>Posa un nom (p. ex. «DacArquitectura»), enganxa l&apos;adreça de dalt i tria autenticació <strong>OAuth</strong>.</li>
              <li>Desa, prem <strong>Connecta</strong>, entra amb l&apos;usuari de l&apos;app i prem <strong>Autoritzar</strong>.</li>
              <li>En un xat nou, activa el connector des del menú «+» o «Eines» i escriu la petició.</li>
            </ol>
            <p className="mt-3 text-xs text-[var(--color-muted)]">Cal un pla de ChatGPT que permeti connectors personalitzats (mode desenvolupador o pla de pagament).</p>
          </section>
          <section className="card">
            <h2 className="text-base font-semibold mb-3">Claude</h2>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm">
              <li>A claude.ai o a l&apos;app d&apos;escriptori, obre <strong>Configuració → Connectors</strong>.</li>
              <li>Prem <strong>Afegir connector personalitzat</strong>.</li>
              <li>Posa un nom i enganxa l&apos;adreça de dalt. Deixa buits client ID i secret.</li>
              <li>Prem <strong>Connecta</strong>, entra amb l&apos;usuari de l&apos;app i prem <strong>Autoritzar</strong>.</li>
              <li>En un xat, comprova que el connector està actiu al menú d&apos;eines i escriu la petició.</li>
            </ol>
            <p className="mt-3 text-xs text-[var(--color-muted)]">Disponible als plans de Claude amb connectors personalitzats (Pro, Max, Team, Enterprise).</p>
          </section>
        </div>

        <section className="card mb-8">
          <h2 className="text-base font-semibold mb-2">Com funciona</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>L&apos;assistent veu cinc eines: cercar, llistar accions, llegir, canviar i afegir fitxers a una acta. Les lectures són lliures.</li>
            <li>Un canvi va en dos passos: primer una <strong>previsualització</strong> (no es desa res) i, quan dius que sí, el desat. Un reintent amb la mateixa clau no escriu dues vegades.</li>
            <li>
              Les <strong>actes</strong> es poden omplir senceres des del xat: motiu, expedient o dedicació, dades, assistents, temes per categoria amb
              responsables (n&apos;hi ha prou amb les inicials), propera visita i signatures. També es pot partir d&apos;una acta anterior.
            </li>
            <li>
              <strong>Fotos, PDF i àudios</strong> d&apos;una acta: a ChatGPT (web o escriptori) adjunta&apos;ls al xat; l&apos;app de mòbil de ChatGPT i Claude
              no passen fitxers al plugin, així que allà cal un enllaç públic. Les fotos es redueixen com a la web.
            </li>
            <li>Tot passa pel mateix codi que fa servir la web, amb el teu usuari. El compte <strong>demo</strong> treballa sobre la base de dades de demostració.</li>
            <li>No es poden esborrar expedients, clients, factures, propostes ni actes des del xat.</li>
            <li>Si l&apos;assistent no veu les eines noves després d&apos;una actualització, torna a connectar el connector.</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-base font-semibold mb-3">Connexions actives</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Encara no hi ha cap connexió per a l&apos;usuari <strong>{user}</strong>.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)]">
                  <th className="py-1 pr-3 font-medium">Client</th>
                  <th className="py-1 pr-3 font-medium">Connectat</th>
                  <th className="py-1 pr-3 font-medium">Darrer ús</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.client_id} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{c.client_name ?? KIND_LABEL[clientKindFromUserAgent(c.last_user_agent)]}</div>
                      <div className="text-xs text-[var(--color-muted)]">{KIND_LABEL[clientKindFromUserAgent(c.last_user_agent)]}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{c.created_at}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{c.last_used_at ?? "—"}</td>
                    <td className="py-2 text-right">
                      <form action={revokeConnectionAction}>
                        <input type="hidden" name="client_id" value={c.client_id} />
                        <button type="submit" className="btn-danger text-xs">
                          Revocar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-[var(--color-muted)]">Revocar talla l&apos;accés d&apos;aquell client a l&apos;instant; caldrà tornar-lo a connectar.</p>
        </section>
      </main>
    </>
  );
}
