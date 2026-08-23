import { BookOpenText, Factory, GearSix, Plus } from "@phosphor-icons/react";

export function EmptyDashboard({ locale, onNewHeat, onLoadDemo, onOpenSettings, onOpenHelp }) {
  const ko = locale === "ko";
  return (
    <main className="workspace-screen empty-dashboard" data-testid="empty-dashboard">
      <section className="panel empty-card"><Factory /><span>G0 START</span><h1>{ko ? "진행 중인 차지가 없습니다" : "No active heat"}</h1><p>{ko ? "실제 수동 입력을 시작하거나, 합성 DEMO로 먼저 화면과 단계 흐름을 연습할 수 있습니다." : "Start manual entry or practice the screens and stage flow with synthetic DEMO data."}</p><ol className="empty-steps"><li><strong>{ko ? "기준 확인" : "Review"}</strong><span>{ko ? "강종 목표·단위·설비·계수" : "Targets, units, equipment, coefficients"}</span></li><li><strong>{ko ? "차지 생성" : "Create"}</strong><span>{ko ? "계산 핵심 6개 값과 실제 시작 시각" : "Six calculation fields and actual start time"}</span></li><li><strong>{ko ? "안내 따라 기록" : "Follow"}</strong><span>{ko ? "중앙 파란 버튼과 현재 단계" : "Central blue action and current stage"}</span></li></ol><div className="empty-primary-actions"><button type="button" className="primary-button" onClick={onNewHeat}><Plus />{ko ? "실제 수동 입력 시작" : "Start manual entry"}</button><button type="button" className="secondary-button" onClick={onLoadDemo}>{ko ? "합성 DEMO로 연습" : "Practice with synthetic DEMO"}</button></div><div className="empty-support-actions"><button type="button" onClick={onOpenSettings}><GearSix />{ko ? "기준 정보 먼저 확인" : "Review settings first"}</button><button type="button" onClick={onOpenHelp}><BookOpenText />{ko ? "명칭·단위 도움말" : "Terms and units"}</button></div></section>
    </main>
  );
}
