const R = 8.314462618;
const OXYGEN_MOLAR_MASS_KG_PER_MOL = 0.0319988;

const STOICHIOMETRIC_OXYGEN = Object.freeze({
  carbonToCO: 0.5 * 31.9988 / 12.011,
  carbonToCO2: 31.9988 / 12.011,
  siliconToSiO2: 31.9988 / 28.085,
  manganeseToMnO: 15.9994 / 54.938,
  phosphorusToP2O5: 1.25 * 31.9988 / 30.974,
  ironToFeO: 15.9994 / 55.845,
});

const OXIDE_MASS_RATIOS = Object.freeze({
  siliconToSiO2: 60.0838 / 28.085,
  manganeseToMnO: 70.9374 / 54.938,
  phosphorusToP2O5: 141.9445 / (2 * 30.974),
  ironToFeO: 71.8444 / 55.845,
});

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function oxygenDensityKgPerNm3(values) {
  const temperatureK = Number(values.normalTemperatureC) + 273.15;
  const pressurePa = Number(values.normalPressureKPa) * 1000;
  if (!(temperatureK > 0) || !(pressurePa > 0)) return NaN;
  return pressurePa * OXYGEN_MOLAR_MASS_KG_PER_MOL / (R * temperatureK);
}

export function scenarioParameters(values, scenario) {
  const suffix = scenario === "low" ? "Low" : scenario === "high" ? "High" : "Base";
  return {
    name: scenario,
    postCombustionRatio: Number(values[`postCombustionRatio${suffix}`]),
    endpointSlagFeOFraction: Number(values[`endpointSlagFeOFraction${suffix}`]),
    heatLossFraction: Number(values[`heatLossFraction${suffix}`]),
  };
}

export function calculateMassBalance(initial, values, scenario, oxygenNm3, charge = null) {
  const required = [initial.hotMetalKg, initial.hotMetalC, initial.scrapKg, initial.scrapC, oxygenNm3];
  if (!required.every(finite)) return { available: false, reason: "carbon_required_inputs_missing", scenario: scenario.name };

  const hotMetalKg = Number(initial.hotMetalKg);
  const scrapKg = Number(initial.scrapKg);
  const fluxKg = finite(initial.fluxKg) ? Number(initial.fluxKg) : 0;
  const assumedInputs = [];
  const chemistry = {};
  for (const [item, field, fallbackKey] of [
    ["Si", "hotMetalSi", "defaultHotMetalSiPercent"],
    ["Mn", "hotMetalMn", "defaultHotMetalMnPercent"],
    ["P", "hotMetalP", "defaultHotMetalPPercent"],
  ]) {
    if (finite(initial[field])) chemistry[item] = Number(initial[field]);
    else {
      chemistry[item] = Number(values[fallbackKey]);
      assumedInputs.push({ field, value: chemistry[item], source: "literature_profile" });
    }
  }

  const initialCarbonKg = finite(charge?.elements?.C?.totalKg) ? Number(charge.elements.C.totalKg) : hotMetalKg * Number(initial.hotMetalC) / 100 + scrapKg * Number(initial.scrapC) / 100;
  const initialSiliconKg = finite(charge?.elements?.Si?.totalKg) ? Number(charge.elements.Si.totalKg) : hotMetalKg * chemistry.Si / 100;
  const initialManganeseKg = finite(charge?.elements?.Mn?.totalKg) ? Number(charge.elements.Mn.totalKg) : hotMetalKg * chemistry.Mn / 100;
  const initialPhosphorusKg = finite(charge?.elements?.P?.totalKg) ? Number(charge.elements.P.totalKg) : hotMetalKg * chemistry.P / 100;
  const suffix = scenario.name === "low" ? "Low" : scenario.name === "high" ? "High" : "Base";
  const siliconRemovedKg = Math.max(0, initialSiliconKg * Number(values[`siliconOxidationFraction${suffix}`]));
  const manganeseRemovedKg = Math.max(0, initialManganeseKg * Number(values.manganeseOxidationFraction));
  const phosphorusRemovedKg = Math.max(0, initialPhosphorusKg * Number(values.phosphorusOxidationFraction));

  const oxideMasses = {
    SiO2: siliconRemovedKg * OXIDE_MASS_RATIOS.siliconToSiO2,
    MnO: manganeseRemovedKg * OXIDE_MASS_RATIOS.manganeseToMnO,
    P2O5: phosphorusRemovedKg * OXIDE_MASS_RATIOS.phosphorusToP2O5,
  };
  const nonFeOSlagKg = fluxKg * Number(values.fluxToSlagFraction) + Object.values(oxideMasses).reduce((sum, value) => sum + value, 0);
  const feoFraction = scenario.endpointSlagFeOFraction;
  const feoKg = feoFraction > 0 && feoFraction < 1 ? nonFeOSlagKg * feoFraction / (1 - feoFraction) : NaN;
  const ironRemovedKg = feoKg / OXIDE_MASS_RATIOS.ironToFeO;
  oxideMasses.FeO = feoKg;
  oxideMasses.CaOEquivalent = fluxKg * Number(values.fluxToSlagFraction);

  const oxygenDensity = oxygenDensityKgPerNm3(values);
  const oxygenInputKg = Number(oxygenNm3) * oxygenDensity * Number(values.oxygenPurityFraction);
  const oxygenForOtherElementsKg = siliconRemovedKg * STOICHIOMETRIC_OXYGEN.siliconToSiO2
    + manganeseRemovedKg * STOICHIOMETRIC_OXYGEN.manganeseToMnO
    + phosphorusRemovedKg * STOICHIOMETRIC_OXYGEN.phosphorusToP2O5
    + ironRemovedKg * STOICHIOMETRIC_OXYGEN.ironToFeO;
  const oxygenForCarbonKg = Math.max(0, oxygenInputKg - oxygenForOtherElementsKg);
  const pcr = Math.min(1, Math.max(0, scenario.postCombustionRatio));
  const oxygenPerCarbonKg = (1 - pcr) * STOICHIOMETRIC_OXYGEN.carbonToCO + pcr * STOICHIOMETRIC_OXYGEN.carbonToCO2;
  const potentialCarbonRemovedKg = oxygenPerCarbonKg > 0 ? oxygenForCarbonKg / oxygenPerCarbonKg : 0;
  const carbonRemovedKg = Math.min(initialCarbonKg, potentialCarbonRemovedKg);
  const excessOxygenKg = Math.max(0, oxygenForCarbonKg - carbonRemovedKg * oxygenPerCarbonKg);
  const remainingCarbonKg = Math.max(0, initialCarbonKg - carbonRemovedKg);
  const initialMetalChargeKg = finite(charge?.metalChargeKg) ? Number(charge.metalChargeKg) : hotMetalKg + scrapKg;
  const estimatedSteelMassKg = initialMetalChargeKg - carbonRemovedKg - siliconRemovedKg - manganeseRemovedKg - phosphorusRemovedKg - ironRemovedKg;
  const carbonPercent = estimatedSteelMassKg > 0 ? 100 * remainingCarbonKg / estimatedSteelMassKg : NaN;

  return {
    available: Number.isFinite(carbonPercent) && Number.isFinite(feoKg),
    scenario: scenario.name,
    carbonPercent,
    estimatedSteelMassKg,
    oxygenDensityKgPerNm3: oxygenDensity,
    oxygenInputKg,
    initialMetalChargeKg,
    oxygenForOtherElementsKg,
    oxygenForCarbonKg,
    excessOxygenKg,
    initialCarbonKg,
    carbonRemovedKg,
    siliconRemovedKg,
    manganeseRemovedKg,
    phosphorusRemovedKg,
    ironRemovedKg,
    oxideMasses,
    offGas: {
      carbonToCOKg: carbonRemovedKg * (1 - pcr),
      carbonToCO2Kg: carbonRemovedKg * pcr,
    },
    assumedInputs,
  };
}

export { STOICHIOMETRIC_OXYGEN };
