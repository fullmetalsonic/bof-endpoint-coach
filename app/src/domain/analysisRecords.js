function legacyAnalysisId(sample) {
  return `AN-LEGACY-${sample.id}`;
}

function hasLegacyValues(sample) {
  return Object.values(sample?.values ?? {}).some((value) => value !== "" && value !== null && value !== undefined);
}

export function getAnalysisResults(sample) {
  if (Array.isArray(sample?.analysisResults)) return sample.analysisResults;
  if (!sample || (!sample.analyzedAt && !hasLegacyValues(sample))) return [];
  return [{
    id: legacyAnalysisId(sample),
    sampleId: sample.id,
    status: "active",
    occurredAt: sample.analyzedAt ?? sample.sampledAt,
    recordedAt: sample.analyzedAt ?? sample.sampledAt,
    recordedBy: { displayName: "미입력" },
    method: sample.method || "OES",
    values: structuredClone(sample.values ?? {}),
    processSnapshot: structuredClone(sample.analysisProcessSnapshot ?? sample.processSnapshot ?? null),
  }];
}

export function getActiveAnalysisResults(sample) {
  return getAnalysisResults(sample).filter((result) => (result.status ?? "active") === "active");
}

export function getAdoptedAnalysis(sample) {
  const active = getActiveAnalysisResults(sample);
  if (!active.length) return null;
  return active.find((result) => result.id === sample.adoptedAnalysisId)
    ?? (sample.adopted ? active.at(-1) : null);
}

export function syncSampleAnalysisProjection(sample, adoptedAnalysisId = sample.adoptedAnalysisId) {
  const active = getActiveAnalysisResults(sample);
  const adopted = active.find((result) => result.id === adoptedAnalysisId) ?? null;
  return {
    ...sample,
    analysisResults: getAnalysisResults(sample),
    adoptedAnalysisId: adopted?.id ?? null,
    adopted: Boolean(adopted),
    method: adopted?.method ?? "Pending",
    values: structuredClone(adopted?.values ?? {}),
    analyzedAt: adopted?.occurredAt,
    analysisProcessSnapshot: structuredClone(adopted?.processSnapshot ?? undefined),
  };
}

export function normalizeSampleAnalyses(sample) {
  const results = getAnalysisResults(sample).map((result) => ({
    ...result,
    sampleId: sample.id,
    status: result.status ?? "active",
    recordedAt: result.recordedAt ?? result.occurredAt,
    recordedBy: result.recordedBy ?? { displayName: "미입력" },
    values: structuredClone(result.values ?? {}),
  }));
  const adoptedAnalysisId = sample.adoptedAnalysisId
    ?? (sample.adopted ? results.filter((result) => result.status === "active").at(-1)?.id : null)
    ?? null;
  return syncSampleAnalysisProjection({
    ...sample,
    status: sample.status ?? "active",
    analysisResults: results,
    adoptedAnalysisId,
  }, adoptedAnalysisId);
}

export function latestAdoptedSample(heat) {
  return [...(heat.samples ?? [])]
    .filter((sample) => (sample.status ?? "active") === "active" && sample.adopted && getAdoptedAnalysis(sample))
    .map((sample) => syncSampleAnalysisProjection(sample))
    .sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt))[0] ?? null;
}

export function findAnalysisResult(heat, analysisId) {
  for (const sample of heat.samples ?? []) {
    const analysis = getAnalysisResults(sample).find((result) => result.id === analysisId);
    if (analysis) return { sample, analysis };
  }
  return null;
}

export function activeSamples(heat) {
  return (heat.samples ?? []).filter((sample) => (sample.status ?? "active") === "active");
}
