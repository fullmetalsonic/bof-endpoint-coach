import { Factory, CalendarBlank, UserCircle, Translate } from "@phosphor-icons/react";

function formatClock(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(value).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function Header({ t, locale, screen, setScreen, setLocale, now }) {
  const navigation = [
    ["dashboard", "dashboard"],
    ["history", "heatHistory"],
    ["today", "today"],
    ["settings", "settings"],
    ["reports", "reports"],
    ["alerts", "alerts"],
  ];
  return (
    <>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => setScreen("dashboard")} aria-label={t("dashboard")}>
          <span className="brand-mark"><Factory weight="fill" /></span>
          <span><strong>{t("appName")}</strong><small>{t("appSubtitle")}</small></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(([id, key]) => (
            <button key={id} type="button" className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>{t(key)}</button>
          ))}
        </nav>
        <div className="header-tools">
          <span className="header-clock"><CalendarBlank /> {formatClock(now)}</span>
          <button className="language-button" type="button" onClick={() => setLocale(locale === "ko" ? "en" : "ko")}><Translate /> {t("language")}</button>
          <span className="team-label"><UserCircle /> {locale === "ko" ? "설비기술팀" : "Process team"}</span>
        </div>
      </header>
      <div className="demo-banner">{t("demoBanner")}</div>
    </>
  );
}
