import { Factory, Plus } from "@phosphor-icons/react";

export function EmptyDashboard({ locale, onNewHeat, onLoadDemo }) {
  const ko = locale === "ko";
  return (
    <main className="workspace-screen empty-dashboard" data-testid="empty-dashboard">
      <section className="panel empty-card"><Factory /><span>G0 START</span><h1>{ko ? "진행 중인 차지가 없습니다" : "No active heat"}</h1><p>{ko ? "신규 차지를 만들면 G0 장입부터 실제 시각과 입력값을 기록하며 진행할 수 있습니다." : "Create a heat to record actual times and inputs from G0 charge onward."}</p><div><button type="button" className="primary-button" onClick={onNewHeat}><Plus />{ko ? "신규 차지 시작" : "Start new heat"}</button><button type="button" className="secondary-button" onClick={onLoadDemo}>{ko ? "DEMO 데이터 불러오기" : "Load DEMO data"}</button></div></section>
    </main>
  );
}
