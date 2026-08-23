import { finite } from "./common.js";

const FALLBACK_KEYS = Object.freeze({
  Si: "defaultHotMetalSiPercent",
  Mn: "defaultHotMetalMnPercent",
  P: "defaultHotMetalPPercent",
  S: "defaultHotMetalSPercent",
});

const FIELD_KEYS = Object.freeze({ C: "hotMetalC", Si: "hotMetalSi", Mn: "hotMetalMn", P: "hotMetalP", S: "hotMetalS" });
const SCRAP_FIELD_KEYS = Object.freeze({ C: "scrapC", Si: "scrapSi", Mn: "scrapMn", P: "scrapP", S: "scrapS" });
const DEFAULT_FLUX_FIELDS = Object.freeze({ CaO: "defaultFluxCaOPercent", MgO: "defaultFluxMgOPercent", SiO2: "defaultFluxSiO2Percent", Al2O3: "defaultFluxAl2O3Percent" });

function activeMaterialEvents(heat) {
  return (heat.events ?? []).filter((event) => event.type === "material" && (event.status ?? "active") === "active" && !["G7", "G8"].includes(event.stage));
}

function eventComposition(event, settings) {
  if (event.payload?.materialCompositionSnapshot) return event.payload.materialCompositionSnapshot;
  return settings.materials?.find((item) => item.code === event.payload?.materialCode)?.composition ?? {};
}

export function buildChargeContext(heat, settings, values) {
  const initial = heat.initial ?? {};
  const hotMetalKg = finite(initial.hotMetalKg) ? Number(initial.hotMetalKg) : 0;
  const scrapKg = finite(initial.scrapKg) ? Number(initial.scrapKg) : 0;
  const assumptions = [];
  const elements = {};
  const events = activeMaterialEvents(heat);
  const metalAdditionEvents = events.filter((event) => ["alloy", "scrap"].includes(event.payload?.materialCategory));
  const metalAdditionKg = metalAdditionEvents.reduce((sum, event) => sum + Number(event.payload?.amountKg ?? 0), 0);

  if (metalAdditionEvents.length) assumptions.push({
    field: "metalAdditionRecovery",
    value: 1,
    source: "nominal_100_percent_recovery",
  });

  for (const element of ["C", "Si", "Mn", "P", "S"]) {
    const hotField = FIELD_KEYS[element];
    let hotPercent = finite(initial[hotField]) ? Number(initial[hotField]) : 0;
    if (!finite(initial[hotField]) && FALLBACK_KEYS[element]) {
      hotPercent = Number(values[FALLBACK_KEYS[element]]);
      assumptions.push({ field: hotField, value: hotPercent, source: "literature_profile" });
    }
    const scrapField = SCRAP_FIELD_KEYS[element];
    const scrapPercent = finite(initial[scrapField]) ? Number(initial[scrapField]) : 0;
    const eventMassKg = events.reduce((sum, event) => {
      const amountKg = Number(event.payload?.amountKg ?? 0);
      const composition = eventComposition(event, settings);
      return sum + (finite(amountKg) && finite(composition[element]) ? amountKg * Number(composition[element]) / 100 : 0);
    }, 0);
    elements[element] = {
      totalKg: hotMetalKg * hotPercent / 100 + scrapKg * scrapPercent / 100 + eventMassKg,
      initialPercent: hotMetalKg + scrapKg > 0 ? 100 * (hotMetalKg * hotPercent / 100 + scrapKg * scrapPercent / 100 + eventMassKg) / (hotMetalKg + scrapKg) : NaN,
      hotMetalPercent: hotPercent,
      scrapPercent,
      eventMassKg,
    };
  }

  const totalFluxKg = finite(initial.fluxKg) ? Number(initial.fluxKg) : 0;
  const fluxEvents = events.filter((event) => event.payload?.materialCategory === "flux");
  const slagMaterialEvents = events.filter((event) => ["flux", "coolant"].includes(event.payload?.materialCategory));
  const eventFluxKg = fluxEvents.reduce((sum, event) => sum + Number(event.payload?.amountKg ?? 0), 0);
  const unclassifiedFluxKg = Math.max(0, totalFluxKg - eventFluxKg);
  const fluxOxidesKg = Object.fromEntries(["CaO", "MgO", "SiO2", "Al2O3", "FeO", "Fe2O3", "MnO", "P2O5"].map((oxide) => [oxide, 0]));
  for (const [oxide, field] of Object.entries(DEFAULT_FLUX_FIELDS)) fluxOxidesKg[oxide] += unclassifiedFluxKg * Number(values[field]) / 100;
  for (const event of slagMaterialEvents) {
    const amountKg = Number(event.payload?.amountKg ?? 0);
    const composition = eventComposition(event, settings);
    for (const oxide of Object.keys(fluxOxidesKg)) {
      if (finite(composition[oxide])) fluxOxidesKg[oxide] += amountKg * Number(composition[oxide]) / 100;
    }
  }
  if (unclassifiedFluxKg > 0) assumptions.push({ field: "fluxComposition", value: unclassifiedFluxKg, source: "literature_profile" });

  return {
    hotMetalKg,
    scrapKg,
    metalAdditionKg,
    metalChargeKg: hotMetalKg + scrapKg + metalAdditionKg,
    totalFluxKg,
    elements,
    fluxOxidesKg,
    assumptions,
  };
}
