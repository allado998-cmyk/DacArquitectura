// Checks how many digits a phone has; spaces, dots, dashes and brackets don't
// count. With no prefix, or with +34 / 0034, it's a Spanish number: 9 digits.
// Any other + or 00 is international: 8 to 15 digits after the prefix, 15 being
// the international maximum. It's a warning, not a rule: the user can still save.

const xifres = (n: number) => (n === 1 ? "1 xifra" : `${n} xifres`);

// What's wrong with a phone, or null if it looks right (or is blank).
export function telefonAvis(telefon: string | null | undefined): string | null {
  const t = (telefon ?? "").trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  const international = /^(\+|00)/.test(t);
  const afterPrefix = t.startsWith("00") ? digits.slice(2) : digits;
  if (international && !afterPrefix.startsWith("34")) {
    const n = afterPrefix.length;
    return n >= 8 && n <= 15 ? null : `Té ${xifres(n)}; un número internacional en té entre 8 i 15.`;
  }
  const n = international ? afterPrefix.length - 2 : digits.length;
  return n === 9 ? null : `Té ${xifres(n)}; n'hi hauria d'haver 9.`;
}

// One "number: what's wrong" line per phone that looks wrong.
export function telefonsAmbAvis(telefons: (string | null | undefined)[]): string[] {
  return telefons.flatMap((t) => {
    const avis = telefonAvis(t);
    return avis ? [`${(t ?? "").trim()}: ${avis}`] : [];
  });
}

// Browser only: asks before saving phones that look wrong.
export function confirmaTelefons(telefons: (string | null | undefined)[]): boolean {
  const avisos = telefonsAmbAvis(telefons);
  return avisos.length === 0 || confirm(`${avisos.join("\n")}\n\nDesar igualment?`);
}
