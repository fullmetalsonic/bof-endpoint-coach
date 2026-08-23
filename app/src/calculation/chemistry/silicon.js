import { available, scenarioSuffix, unavailable } from "./common.js";

export function predictSilicon(charge, massBalance, values, scenario) {
  if (!massBalance?.available || !(massBalance.estimatedSteelMassKg > 0)) return unavailable("steel_mass_unavailable");
  const totalKg = charge.elements.Si?.totalKg;
  if (!Number.isFinite(totalKg)) return unavailable("silicon_input_unavailable");
  const fraction = Number(values[`siliconOxidationFraction${scenarioSuffix(scenario.name)}`]);
  if (!(fraction >= 0 && fraction <= 1)) return unavailable("silicon_oxidation_fraction_invalid");
  return available(100 * Math.max(0, totalKg * (1 - fraction)) / massBalance.estimatedSteelMassKg, {
    confidence: "medium",
    sourceIds: ["S12"],
    assumptions: ["silicon_oxidation_mass_balance"],
  });
}
