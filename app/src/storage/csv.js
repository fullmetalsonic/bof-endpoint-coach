function protectFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function unprotectFormula(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

export function encodeCsv(rows, columns) {
  const escape = (value) => {
    const text = protectFormula(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(unprotectFormula(field));
      field = "";
    } else if (char === "\n") {
      row.push(unprotectFormula(field.replace(/\r$/, "")));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(unprotectFormula(field.replace(/\r$/, "")));
    rows.push(row);
  }
  const [header = [], ...body] = rows;
  return body.filter((cells) => cells.some((cell) => cell !== "")).map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""])));
}
