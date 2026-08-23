import { available, finite, unavailable } from "./common.js";

export function predictSulfur(charge, massBalance, slag, temperature) {
  if (!massBalance?.available || !slag?.available || !temperature?.available) return unavailable("sulfur_required_model_unavailable");
  const totalKg = charge.elements.S?.totalKg;
  const { CaO, MgO, SiO2, FeO, MnO } = slag.composition;
  const temperatureK = Number(temperature.temperatureC ?? temperature.value) + 273.15;
  if (![totalKg, CaO, MgO, SiO2, FeO, MnO, temperatureK].every(finite) || !(FeO > 0 && temperatureK > 0)) return unavailable("sulfur_partition_input_invalid");
  const logPartition = (668 / temperatureK) * Math.log10(FeO)
    + (62.6 * CaO + 46 * FeO + 36.6 * MnO) / temperatureK
    + 0.01 * MgO + 0.00019 * SiO2 ** 2 - 0.038 * SiO2 + 0.12;
  const partition = 10 ** logPartition;
  const denominator = massBalance.estimatedSteelMassKg + slag.slagMassKg * partition;
  if (!(partition > 0) || !(denominator > 0)) return unavailable("sulfur_partition_invalid");
  return available(100 * totalKg / denominator, {
    confidence: "very_low",
    partition,
    logPartition,
    sourceIds: ["S47"],
    assumptions: ["equilibrium_sulfur_partition", "oxidizing_bof_limit_not_calibrated"],
  });
}
