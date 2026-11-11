// Inventory of a page of the ITE portal's form (ite.agenciahabitatge.cat), run
// in the browser on that page: every field with its label, type, options (all
// of them, with the portal's own values), required flag, max length and group,
// the validation messages on the page and the fields flagged in error (after
// «Validar informe»), plus the buttons and the section menu. Downloads it as
// JSON. Pure read: it changes nothing on the page, and typed text (names,
// NIF…) is not saved, only whether each field is filled.
//
// How: at the portal, open a section → F12 → Console → paste this file → Enter.
// Or make a bookmarklet with `node scripts/ite-inventari-bookmarklet.mjs` and
// click it on each section. Fields that only appear after a yes/no (central
// heating, ACS, cooling…) are not in the page until that box is ticked: tick
// it on a test report, run again; the merge keeps both.
(function () {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const text = (el) => clean(el ? el.textContent : "");
  const slug = (s) =>
    clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "pagina";
  const WIDGET = ".ui-selectonemenu, .ui-selectoneradio, .ui-selectmanycheckbox, .ui-chkbox, .ui-radiobutton, .ui-autocomplete, .ui-calendar";
  const hasControls = (el) => !!el.querySelector("input, select, textarea");
  const visible = (el) => {
    const w = el.closest(WIDGET) || el;
    return !!(w.offsetWidth || w.offsetHeight || w.getClientRects().length);
  };
  const byFor = (id) => {
    if (!id) return "";
    const l = document.querySelector('label[for="' + CSS.escape(id) + '"]');
    return l ? text(l) : "";
  };

  // The label of a control or of its widget: <label for>, aria, the previous
  // cell of a table row (JSF forms are tables), or the previous sibling.
  const labelOf = (node) => {
    const f = byFor(node.id);
    if (f) return f;
    const al = node.getAttribute("aria-label");
    if (al) return clean(al);
    const lb = node.getAttribute("aria-labelledby");
    if (lb) {
      const t = lb.split(/\s+/).map((id) => text(document.getElementById(id))).filter(Boolean).join(" ");
      if (t) return t;
    }
    const cell = node.closest("td, th");
    if (cell) {
      let prev = cell.previousElementSibling;
      while (prev && !text(prev)) prev = prev.previousElementSibling;
      if (prev && !hasControls(prev) && text(prev).length < 300) return text(prev);
      const first = cell.parentElement && cell.parentElement.firstElementChild;
      if (first && first !== cell && text(first) && !hasControls(first) && text(first).length < 300) return text(first);
    }
    let p = node.previousElementSibling;
    while (p && !text(p)) p = p.previousElementSibling;
    if (p && !hasControls(p) && text(p).length < 300) return text(p);
    return "";
  };
  const labelFor = (el) => {
    const own = labelOf(el);
    if (own) return own;
    const wrap = el.closest("label");
    if (wrap) {
      const c = wrap.cloneNode(true);
      c.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
      if (text(c)) return text(c);
    }
    const widget = el.closest(WIDGET);
    if (widget && widget !== el) {
      const w = labelOf(widget);
      if (w) return w;
    }
    return clean(el.getAttribute("title") || el.getAttribute("placeholder") || "");
  };

  // The nearest heading, legend or panel title before the control.
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, legend, .ui-panel-title, .ui-fieldset-legend, .ui-accordion-header, .ui-tabs-header, .ui-dialog-title"),
  ).filter((h) => text(h));
  const groupOf = (el) => {
    let g = "";
    for (const h of headings) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) g = text(h);
      else break;
    }
    return g;
  };

  const controls = [];
  const radios = new Map();
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    const type = el.tagName === "SELECT" ? (el.multiple ? "select-multiple" : "select") : el.tagName === "TEXTAREA" ? "textarea" : (el.getAttribute("type") || "text").toLowerCase();
    if (["hidden", "submit", "button", "image", "reset"].includes(type)) return;
    if (/javax\.faces|ViewState/i.test(el.name || "")) return;
    const base = {
      tipus: type,
      id: el.id || "",
      name: el.name || "",
      etiqueta: "",
      grup: groupOf(el),
      visible: visible(el),
      desactivat: !!el.disabled,
      obligatori: !!(el.required || el.getAttribute("aria-required") === "true"),
    };
    if (type === "radio") {
      const key = el.name || el.id;
      let g = radios.get(key);
      if (!g) {
        const table = el.closest(".ui-selectoneradio, table[id]");
        g = { ...base, tipus: "radio", id: (table && table.id) || "", etiqueta: (table && labelOf(table)) || "", opcions: [], valor: null };
        radios.set(key, g);
        controls.push(g);
      }
      const own = byFor(el.id) || (el.nextElementSibling && !hasControls(el.nextElementSibling) ? text(el.nextElementSibling) : "") || clean(el.value);
      g.opcions.push({ valor: el.value, text: own });
      if (el.checked) g.valor = el.value;
      if (!g.etiqueta) g.etiqueta = groupOf(el);
      return;
    }
    base.etiqueta = labelFor(el);
    if (type === "select" || type === "select-multiple") {
      base.opcions = Array.from(el.options).map((o) => ({ valor: o.value, text: text(o) }));
      base.n_opcions = base.opcions.length;
      base.valor = el.multiple ? Array.from(el.selectedOptions).map((o) => o.value) : el.value;
    } else if (type === "checkbox") {
      base.valor = !!el.checked;
      if (el.value && el.value !== "on") base.valor_html = el.value;
    } else if (type === "file") {
      base.accept = el.getAttribute("accept") || "";
      base.multiple = !!el.multiple;
    } else {
      // Typed text stays on the page: only whether it is filled and, for short
      // values with digits (dates, numbers), their shape: 21/10/2022 → 99/99/9999.
      const v = (el.value || "").trim();
      base.ple = !!v;
      if (v && v.length <= 20 && /\d/.test(v)) base.forma = v.replace(/\d/g, "9").replace(/[A-ZÀ-Ý]/g, "A").replace(/[a-zß-ÿ]/g, "a");
      const ml = el.getAttribute("maxlength");
      if (ml) base.maxlength = Number(ml);
      if (el.classList.contains("ui-autocomplete-input") || el.closest(".ui-autocomplete")) base.autocomplete = true;
      if (el.classList.contains("hasDatepicker") || el.closest(".ui-calendar")) base.calendari = true;
    }
    controls.push(base);
  });

  const unique = (xs) => Array.from(new Set(xs.filter(Boolean)));
  const botons = unique(
    Array.from(document.querySelectorAll("button, input[type=submit], input[type=button], a.ui-commandlink, a.ui-button, .ui-button")).map((b) =>
      clean(b.value || b.textContent || b.getAttribute("title") || ""),
    ),
  );
  const menu = unique(Array.from(document.querySelectorAll("nav a, [class*=menu] a, [id*=menu] a")).map(text)).filter((t) => t.length < 80);
  const titol = text(document.querySelector("h1, h2, .ui-panel-title")) || document.title;

  // Validation messages on the page (after «Validar informe» or a refused
  // save) and the fields the portal flags: what the portal makes mandatory.
  const MSG = ".ui-messages li, .ui-message, .ui-growl-item, [role=alert], [class*=error], [class*=Error], [class*=missatge], [class*=mensaje], [class*=warn]";
  // Not the controls themselves (a select in error would give its options),
  // and only the innermost element of a message (not the list around it).
  const cands = Array.from(document.querySelectorAll(MSG)).filter(
    (e) => !e.matches("input, select, textarea, option, button") && !e.closest("select") && !hasControls(e) && visible(e) && text(e) && text(e).length < 400,
  );
  const missatges = unique(cands.filter((e) => !cands.some((o) => o !== e && e.contains(o))).map(text));
  controls.forEach((c) => {
    const el = c.id && document.getElementById(c.id);
    if (!el) return;
    const w = el.closest(WIDGET) || el;
    if (w.classList.contains("ui-state-error") || el.classList.contains("ui-state-error") || el.getAttribute("aria-invalid") === "true") c.error = true;
  });

  const out = {
    url: location.href,
    titol,
    data: new Date().toISOString(),
    menu,
    botons,
    missatges,
    n_controls: controls.length,
    n_errors: controls.filter((c) => c.error).length,
    controls,
  };
  const name = "ite-portal-" + slug(titol) + ".json";
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  const withOptions = controls.filter((c) => c.opcions);
  console.log("[inventari] " + controls.length + " camps, " + withOptions.length + " amb opcions (" + withOptions.map((c) => (c.etiqueta || c.name) + ": " + c.opcions.length).join(", ") + ") → " + name);
  return out;
})();
