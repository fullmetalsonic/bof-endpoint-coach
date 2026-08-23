export function TermHelp({ locale, title, items, open = true }) {
  const ko = locale === "ko";
  return (
    <details className="term-help" open={open}>
      <summary>{title ?? (ko ? "명칭·단위 바로 알기" : "Terms and units")}</summary>
      <dl>
        {items.map((item) => (
          <div key={item.term}>
            <dt>{item.term}</dt>
            <dd>{ko ? item.ko : item.en}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
