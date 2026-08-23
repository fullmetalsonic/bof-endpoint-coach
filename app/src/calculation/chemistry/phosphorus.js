import { available, finite, unavailable } from "./common.js";

export function predictPhosphorus(charge, massBalance, slag, temperature) {
  if (!massBalance?.available || !slag?.available || !temperature?.available) return unavailable("phosphorus_required_model_unavailable");
  const totalKg = charge.elements.P?.totalKg;
  const { CaO, SiO2, MgO } = slag.composition;
  const totalFe = slag.totalFePercent;
  const temperatureK = Number(temperature.temperatureC ?? temperature.value) + 273.15;
  if (![totalKg, CaO, SiO2, MgO, totalFe, temperatureK].every(finite) || !(SiO2 > 0 && MgO > 0 && totalFe > 0 && temperatureK > 0)) return unavailable("phosphorus_partition_input_invalid");
  const logPartition = 0.431 * (CaO / SiO2) - 0.361 * Math.log10(MgO) + 13590 / temperatureK - 5.71 + 0.384 * Math.log10(totalFe);
  const partition = 10 ** logPartition;
  const denominator = massBalance.estimatedSteelMassKg + slag.slagMassKg * partition;
  if (!(partition > 0) || !(denominator > 0)) return unavailable("phosphorus_partition_invalid");
  return available(100 * totalKg / denominator, {
    confidence: "medium",
    partition,
    logPartition,
    sourceIds: ["S12", "S46"],
    assumptions: ["m1_phosphorus_partition", "slag_metal_mass_balance"],
  });
}
