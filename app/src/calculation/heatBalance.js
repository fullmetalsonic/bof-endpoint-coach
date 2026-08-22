const REACTION_HEAT_KJ_PER_KG_ELEMENT = Object.freeze({
  carbonToCO: 9191.82,
  carbonToCO2: 32729.4,
  siliconToSiO2: 32157.1,
  manganeseToMnO: 6999.61,
  phosphorusToP2O5: 26332.5,
  ironToFeO: 4775.023,
});

const sensibleKjPerKg = {
  Fe: (temperatureK) => -193.53 + 0.823 * temperatureK,
  CaO: (temperatureK) => -434.72 + 1.3376 * temperatureK,
  SiO2: (temperatureK) => -99.9 + 1.3376 * temperatureK,
  FeO: (temperatureK) => -72.732 + 0.9889 * temperatureK,
  P2O5: (temperatureK) => -451.44 + 1.337 * temperatureK,
  MnO: (temperatureK) => -700.56 + 1.3376 * temperatureK,
  CO: (temperatureK) => -522.082 + 1.2719 * temperatureK,
  CO2: (temperatureK) => -616.132 + 1.3447 * temperatureK,
};

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function outputHeatKj(temperatureC, balance, values) {
  const steelK = temperatureC + 273.15;
  const slagK = temperatureC + Number(values.slagTemperatureOffsetC) + 273.15;
  const gasK = Number(values.offGasTemperatureC) + 273.15;
  const oxides = balance.oxideMasses;
  const steel = balance.estimatedSteelMassKg * sensibleKjPerKg.Fe(steelK);
  const slag = oxides.CaOEquivalent * sensibleKjPerKg.CaO(slagK)
    + oxides.SiO2 * sensibleKjPerKg.SiO2(slagK)
    + oxides.MnO * sensibleKjPerKg.MnO(slagK)
    + oxides.P2O5 * sensibleKjPerKg.P2O5(slagK)
    + oxides.FeO * sensibleKjPerKg.FeO(slagK);
  const coKg = balance.offGas.carbonToCOKg * 28.0101 / 12.011;
  const co2Kg = balance.offGas.carbonToCO2Kg * 44.0095 / 12.011;
  const gas = coKg * sensibleKjPerKg.CO(gasK) + co2Kg * sensibleKjPerKg.CO2(gasK);
  return { total: steel + slag + gas, steel, slag, gas, coKg, co2Kg };
}

export function calculateHeatBalance(initial, balance, values, scenario) {
  if (!balance?.available || !finite(initial.hotMetalTemperatureC) || !finite(initial.hotMetalKg)) {
    return { available: false, reason: "temperature_required_inputs_missing", scenario: scenario.name };
  }
  const hotMetalSensibleKj = Number(initial.hotMetalKg) * sensibleKjPerKg.Fe(Number(initial.hotMetalTemperatureC) + 273.15);
  const reactionHeatKj = balance.offGas.carbonToCOKg * REACTION_HEAT_KJ_PER_KG_ELEMENT.carbonToCO
    + balance.offGas.carbonToCO2Kg * REACTION_HEAT_KJ_PER_KG_ELEMENT.carbonToCO2
    + balance.siliconRemovedKg * REACTION_HEAT_KJ_PER_KG_ELEMENT.siliconToSiO2
    + balance.manganeseRemovedKg * REACTION_HEAT_KJ_PER_KG_ELEMENT.manganeseToMnO
    + balance.phosphorusRemovedKg * REACTION_HEAT_KJ_PER_KG_ELEMENT.phosphorusToP2O5
    + balance.ironRemovedKg * REACTION_HEAT_KJ_PER_KG_ELEMENT.ironToFeO;
  const grossInputKj = hotMetalSensibleKj + reactionHeatKj;
  const heatLossKj = grossInputKj * scenario.heatLossFraction;
  const netInputKj = grossInputKj - heatLossKj;
  const residual = (temperatureC) => netInputKj - outputHeatKj(temperatureC, balance, values).total;
  let lowC = 1200;
  let highC = 2100;
  let lowResidual = residual(lowC);
  const highResidual = residual(highC);
  if (!Number.isFinite(lowResidual) || !Number.isFinite(highResidual) || lowResidual * highResidual > 0) {
    return {
      available: false,
      reason: "heat_balance_out_of_supported_range",
      scenario: scenario.name,
      boundsC: [lowC, highC],
      residualsKj: [lowResidual, highResidual],
    };
  }
  for (let iteration = 0; iteration < 70; iteration += 1) {
    const midC = (lowC + highC) / 2;
    const midResidual = residual(midC);
    if (Math.abs(midResidual) < 0.1) {
      lowC = midC;
      highC = midC;
      break;
    }
    if (lowResidual * midResidual <= 0) {
      highC = midC;
    } else {
      lowC = midC;
      lowResidual = midResidual;
    }
  }
  const temperatureC = (lowC + highC) / 2;
  return {
    available: true,
    scenario: scenario.name,
    temperatureC,
    hotMetalSensibleKj,
    reactionHeatKj,
    heatLossKj,
    netInputKj,
    output: outputHeatKj(temperatureC, balance, values),
  };
}

export { REACTION_HEAT_KJ_PER_KG_ELEMENT };
