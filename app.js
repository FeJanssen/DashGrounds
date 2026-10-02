// ---- Supabase Konfiguration ----
const SUPABASE_URL = "https://jobalnmworofphavtxuv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvYmFsbm13b3JvZnBoYXZ0eHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NDg3MzQsImV4cCI6MjA2MzUyNDczNH0.re736AoUTZZSNoX-oKpwM-YPuTeozXDDmz6utpOqSdQ";

// Kleiner REST-Helfer (kein SDK nötig)
async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase Fehler (${res.status}): ${await res.text()}`);
  return res.json();
}

// ---- DOM-Elemente ----
const viewVereine = document.getElementById("view-vereine");
const viewBuchungen = document.getElementById("view-buchungen");
const vereineList = document.getElementById("vereine-list");
const vereineStatus = document.getElementById("vereine-status");
const buchungenStatus = document.getElementById("buchungen-status");
const buchungenTable = document.getElementById("buchungen-table");
const buchungenBody = document.getElementById("buchungen-body");
const vereinTitle = document.getElementById("verein-title");

document.getElementById("btn-back").addEventListener("click", () => {
  viewBuchungen.hidden = true;
  viewVereine.hidden = false;
});

// ---- Ansicht 1: Vereine laden ----
async function ladeVereine() {
  try {
    const vereine = await sb("verein?select=id,name,email&order=name.asc");
    vereineStatus.textContent = vereine.length
      ? ""
      : "Keine Vereine gefunden (prüfe ggf. die RLS-Policies in Supabase).";
    vereineList.innerHTML = "";
    for (const v of vereine) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<h3>${esc(v.name ?? "Unbenannt")}</h3><p>${esc(v.email ?? "")}</p>`;
      card.addEventListener("click", () => zeigeBuchungen(v));
      vereineList.appendChild(card);
    }
  } catch (err) {
    vereineStatus.textContent = err.message;
    vereineStatus.classList.add("error");
  }
}

// ---- Ansicht 2: Buchungen eines Vereins ----
async function zeigeBuchungen(verein) {
  viewVereine.hidden = true;
  viewBuchungen.hidden = false;
  vereinTitle.textContent = `Buchungen – ${verein.name ?? ""}`;
  buchungenTable.hidden = true;
  buchungenBody.innerHTML = "";
  buchungenStatus.textContent = "Lade Buchungen…";
  buchungenStatus.classList.remove("error");

  try {
    // Plätze & Nutzer des Vereins laden, danach deren Buchungen
    const [plaetze, nutzer] = await Promise.all([
      sb(`platz?select=id,name&verein_id=eq.${verein.id}`),
      sb(`nutzer?select=id,name,email&verein_id=eq.${verein.id}`),
    ]);

    const platzMap = Object.fromEntries(plaetze.map((p) => [p.id, p]));
    const nutzerMap = Object.fromEntries(nutzer.map((n) => [n.id, n]));

    if (!plaetze.length) {
      buchungenStatus.textContent = "Keine Plätze / Buchungen für diesen Verein gefunden.";
      return;
    }

    const platzIds = plaetze.map((p) => p.id).join(",");
    const buchungen = await sb(
      `buchung?select=id,nutzer_id,platz_id,datum,status,preis&platz_id=in.(${platzIds})&order=datum.desc`
    );

    if (!buchungen.length) {
      buchungenStatus.textContent = "Keine Buchungen vorhanden.";
      return;
    }

    buchungenStatus.textContent = "";
    buchungenTable.hidden = false;

    for (const b of buchungen) {
      const person = nutzerMap[b.nutzer_id];
      const platz = platzMap[b.platz_id];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDatum(b.datum)}</td>
        <td>${esc(person?.name ?? "Unbekannt")}</td>
        <td>${esc(platz?.name ?? "–")}</td>
        <td><span class="badge ${esc((b.status ?? "").toLowerCase())}">${esc(b.status ?? "–")}</span></td>
        <td>${b.preis != null ? Number(b.preis).toFixed(2) + " €" : "–"}</td>`;
      buchungenBody.appendChild(tr);
    }
  } catch (err) {
    buchungenStatus.textContent = err.message;
    buchungenStatus.classList.add("error");
  }
}

// ---- Hilfsfunktionen ----
function formatDatum(d) {
  if (!d) return "–";
  const date = new Date(d);
  if (isNaN(date)) return esc(String(d));
  return date.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: d.includes("T") || d.includes(":") ? "short" : undefined,
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

ladeVereine();
