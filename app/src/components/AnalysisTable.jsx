function format(value, decimals = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : "–";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AnalysisTable({ heat, t }) {
  const samples = [...heat.samples].sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt)).slice(0, 4);
  return (
    <section className="analysis-table panel">
      <div className="panel-title"><h2>{t("recentResults")}</h2></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>{t("sampledAt")}</th><th>{t("stage")}</th><th>{t("sampleId")}</th><th>C (%)</th><th>Si (%)</th><th>Mn (%)</th><th>P (%)</th><th>S (%)</th><th>{t("currentActual")} T (°C)</th><th>{t("method")}</th></tr></thead>
          <tbody>{samples.map((sample) => <tr key={sample.id}><td>{formatTime(sample.sampledAt)}</td><td>{sample.stage}</td><td>{sample.id}</td><td>{format(sample.values.C)}</td><td>{format(sample.values.Si, 2)}</td><td>{format(sample.values.Mn, 2)}</td><td>{format(sample.values.P)}</td><td>{format(sample.values.S)}</td><td>{format(sample.values.temperature, 0)}</td><td>{sample.method}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
