import { Factory, CalendarBlank, Database, UserCircle, Translate } from "@phosphor-icons/react";

function formatClock(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(value).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function Header({ t, locale, screen, setScreen, setLocale, now, operatorName, onEditOperator, saveStatus, storageMeta, recoveryPointCount = 0 }) {
  const navigation = [
    ["dashboard", "dashboard"],
    ["history", "heatHistory"],
    ["today", "today"],
    ["settings", "settings"],
    ["learning", "learning"],
    ["reports", "reports"],
    ["alerts", "alerts"],
    ["help", "help"],
  ];
  return (
    <>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => setScreen("dashboard")} aria-label={locale === "ko" ? "대시보드로 이동" : "Go to dashboard"}>
          <span className="brand-mark"><Factory weight="fill" /></span>
          <span><strong>{t("appName")}</strong><small>{t("appSubtitle")}</small></span>
        </button>
        <nav className="main-nav" aria-label={locale === "ko" ? "주요 메뉴" : "Main navigation"}>
          {navigation.map(([id, key]) => (
            <button key={id} type="button" className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>{t(key)}</button>
          ))}
        </nav>
        <div className="header-tools">
          <button className={`header-storage-button ${saveStatus}`} type="button" onClick={() => setScreen("reports")} title={`${locale === "ko" ? "브라우저 자동저장" : "Browser autosave"} · revision ${storageMeta?.revision ?? 0} · ${locale === "ko" ? "복구점" : "recovery points"} ${recoveryPointCount}`}><Database weight="fill" />{saveStatus === "saved" ? (locale === "ko" ? "자동저장 완료" : "Autosaved") : saveStatus === "saving" ? (locale === "ko" ? "저장 중" : "Saving") : (locale === "ko" ? "저장 확인" : "Check storage")}</button>
          <span className="header-clock"><CalendarBlank /> {formatClock(now)}</span>
          <button className="language-button" type="button" onClick={() => setLocale(locale === "ko" ? "en" : "ko")}><Translate /> {t("language")}</button>
          <button className="operator-button" type="button" onClick={onEditOperator}><UserCircle /> {operatorName || (locale === "ko" ? "작업자 설정" : "Set operator")}</button>
        </div>
      </header>
      <div className="demo-banner">{t("demoBanner")}</div>
    </>
  );
}
