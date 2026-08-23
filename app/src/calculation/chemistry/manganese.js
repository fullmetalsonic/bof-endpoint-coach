import { available, finite, unavailable } from "./common.js";

const MN_IN_MNO = 54.938044 / 70.937444;

export function predictManganese(charge, massBalance, slag, temperature) {
  if (!massBalance?.available || !slag?.available || !temperature?.available) return unavailable("manganese_required_model_unavailable");
  const totalKg = charge.elements.Mn?.totalKg;
  const temperatureK = Number(temperature.temperatureC ?? temperature.value) + 273.15;
  if (![totalKg, temperatureK].every(finite) || !(temperatureK > 0)) return unavailable("manganese_partition_input_invalid");
  const logPartition = 14270 / temperatureK - 6.55;
  const partitionMnOToMn = 10 ** logPartition;
  const denominator = massBalance.estimatedSteelMassKg + slag.slagMassKg * partitionMnOToMn * MN_IN_MNO;
  if (!(partitionMnOToMn > 0) || !(denominator > 0)) return unavailable("manganese_partition_invalid");
  return available(100 * totalKg / denominator, {
    confidence: "low",
    partition: partitionMnOToMn,
    logPartition,
    sourceIds: ["S45"],
    assumptions: ["equilibrium_mno_mn_partition", "slag_metal_mass_balance"],
  });
}
