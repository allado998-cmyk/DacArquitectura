// Help images: extracts of the CTE that David consults while filling in a
// calculation. The editor shows a button beside the row (or the floor name)
// that opens them; they are not printed in the report.

export interface AuxImage {
  src: string;
  short: string; // button text
  title: string; // viewer caption and button tooltip
}

export const AJUDA = {
  annexC: { src: "/calculs/ajuda/cte-se-f-annex-c.jpg", short: "Annex C", title: "CTE DB SE-F annex C · Valors de resistència característica a compressió" },
  taula44: { src: "/calculs/ajuda/cte-se-f-taula-4-4.jpg", short: "Taula 4.4", title: "CTE DB SE-F taula 4.4 · Resistència característica a la compressió de fàbriques usuals" },
  taula48: { src: "/calculs/ajuda/cte-se-f-taula-4-8.jpg", short: "Taula 4.8", title: "CTE DB SE-F taula 4.8 · Coeficients parcials de seguretat (γM)" },
  figura57: { src: "/calculs/ajuda/cte-se-f-figura-5-7.jpg", short: "Figura 5.7", title: "CTE DB SE-F figura 5.7 · Repartiment de càrregues concentrades a 60°" },
  sobrecarregues: { src: "/calculs/ajuda/cte-se-ae-taula-3-1.jpg", short: "SE-AE taula 3.1", title: "CTE DB SE-AE taula 3.1 · Valors característics de les sobrecàrregues d'ús" },
  sobrecarreguesNotes: { src: "/calculs/ajuda/cte-se-ae-taula-3-1-notes.jpg", short: "Notes taula 3.1", title: "CTE DB SE-AE taula 3.1 · Notes i apartats 3 a 8" },
  // From the sheets of 15 Nov 2026 (trencallums, baixada de càrregues, vent).
  pesFabriques: { src: "/calculs/ajuda/cte-se-ae-pes-fabriques.jpg", short: "Pes fàbriques", title: "CTE DB SE-AE annex C taula C.1 · Pes específic de les fàbriques (kN/m³)" },
  vent: { src: "/calculs/ajuda/cte-se-ae-annex-d-vent.jpg", short: "SE-AE annex D", title: "CTE DB SE-AE annex D · Pressió dinàmica del vent i mapa de la velocitat bàsica (zones A, B i C)" },
  carregaUniforme: { src: "/calculs/ajuda/reforc-carrega-uniforme.jpg", short: "Càrrega uniforme", title: "Biga biarticulada amb càrrega uniforme q: reaccions qL/2, tallant i moment màxim qL²/8" },
  carregaPuntual: { src: "/calculs/ajuda/reforc-carrega-puntual.jpg", short: "Càrrega puntual", title: "Biga biarticulada amb càrrega puntual P al centre: reaccions P/2, tallant i moment màxim PL/4" },
} satisfies Record<string, AuxImage>;
