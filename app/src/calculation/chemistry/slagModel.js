import { finite, unavailable } from "./common.js";

const FE_IN_FEO = 55.845 / 71.8444;
const FE_IN_FE2O3 = (2 * 55.845) / 159.688;

export function calculateSlagScenario(massBalance, chargeContext) {
  if (!massBalance?.available) return unavailable("mass_balance_unavailable");
  const oxidesKg = {
    CaO: Number(chargeContext.fluxOxidesKg.CaO ?? 0),
    MgO: Number(chargeContext.fluxOxidesKg.MgO ?? 0),
    Al2O3: Number(chargeContext.fluxOxidesKg.Al2O3 ?? 0),
    SiO2: Number(massBalance.oxideMasses?.SiO2 ?? 0) + Number(chargeContext.fluxOxidesKg.SiO2 ?? 0),
    MnO: Number(massBalance.oxideMasses?.MnO ?? 0) + Number(chargeContext.fluxOxidesKg.MnO ?? 0),
    P2O5: Number(massBalance.oxideMasses?.P2O5 ?? 0) + Number(chargeContext.fluxOxidesKg.P2O5 ?? 0),
    FeO: Number(massBalance.oxideMasses?.FeO ?? 0) + Number(chargeContext.fluxOxidesKg.FeO ?? 0),
    Fe2O3: Number(chargeContext.fluxOxidesKg.Fe2O3 ?? 0),
  };
  const slagMassKg = Object.values(oxidesKg).reduce((sum, value) => sum + (finite(value) ? Number(value) : 0), 0);
  if (!(slagMassKg > 0)) return unavailable("slag_mass_unavailable");
  const composition = Object.fromEntries(Object.entries(oxidesKg).map(([key, value]) => [key, 100 * value / slagMassKg]));
  const totalFePercent = composition.FeO * FE_IN_FEO + composition.Fe2O3 * FE_IN_FE2O3;
  const basicity = composition.SiO2 > 0 ? composition.CaO / composition.SiO2 : NaN;
  if (![composition.CaO, composition.SiO2, composition.MgO, composition.FeO, totalFePercent].every(finite)) return unavailable("slag_composition_unavailable");
  return {
    available: true,
    slagMassKg,
    oxidesKg,
    composition,
    totalFePercent,
    basicity,
    sourceIds: ["S12", "S45", "S46", "S47"],
  };
}
