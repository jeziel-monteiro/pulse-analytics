export const MAX_CSV_BYTES = 250 * 1024 * 1024;
const UNKNOWN_PROBLEM = "Sem classificação";
const UNKNOWN_SEGMENT = "Sem segmento informado";
const labels = new Intl.Collator("pt-BR", { sensitivity: "base" });
const integer = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const formatInteger = (value) => integer.format(value);
export const formatRate = (value) => value == null ? "—" : `${decimal.format(value * 100)}%`;
export function formatPoints(value) {
  if (value == null) return "—";
  const points = Math.round(value * 1000) / 10 || 0;
  return `${points > 0 ? "+" : ""}${decimal.format(points)} p.p.`;
}
export const formatChange = (value) => `${value > 0 ? "+" : ""}${formatInteger(value)}`;
export const monthName = (month) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  const display = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return display.charAt(0).toUpperCase() + display.slice(1);
};
export const shortMonth = (month) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
};

export function normalize(value) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dateMonth(value) {
  const input = value.trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(input);
  const br = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T ].*)?$/.exec(input);
  if (!iso && !br) return null;
  const [, year, month, day] = iso ?? [null, br[3], br[2], br[1]];
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (numericYear < 1900 || numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) return null;
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
  if (date.getUTCMonth() !== numericMonth - 1) return null;
  return `${year}-${month.padStart(2, "0")}`;
}

export function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function detectDelimiter(text) {
  const preamble = /^sep=([;,\t])\r?\n/i.exec(text);
  if (preamble) return { delimiter: preamble[1], start: preamble[0].length };
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    if (quoted) continue;
    if ((character === "\n" || character === "\r") && Object.values(counts).some(Boolean)) break;
    if (character in counts) counts[character]++;
  }
  const [delimiter, count] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
  if (!count) throw new Error("O cabeçalho do CSV não tem colunas separadas por ponto e vírgula, vírgula ou tabulação.");
  return { delimiter, start: 0 };
}

function readRows(text, onRow) {
  const { delimiter, start } = detectDelimiter(text);
  let row = [];
  let position = start;
  while (position < text.length) {
    let value;
    if (text[position] === '"') {
      value = "";
      position++;
      let close = text.indexOf('"', position);
      while (close !== -1 && text[close + 1] === '"') {
        value += text.slice(position, close + 1);
        position = close + 2;
        close = text.indexOf('"', position);
      }
      if (close === -1) throw new Error("O CSV termina com um campo entre aspas aberto. Baixe ou exporte o arquivo novamente.");
      value += text.slice(position, close);
      position = close + 1;
      while (text[position] === " " || (text[position] === "\t" && delimiter !== "\t")) position++;
      if (position < text.length && ![delimiter, "\r", "\n"].includes(text[position])) {
        throw new Error("Há um campo entre aspas com separador inválido no CSV. Confira a exportação.");
      }
    } else {
      const begin = position;
      while (position < text.length && text[position] !== delimiter && text[position] !== "\r" && text[position] !== "\n") position++;
      value = text.slice(begin, position);
    }
    row.push(value);
    if (text[position] === delimiter) {
      position++;
      if (position === text.length) {
        row.push("");
        onRow(row);
      }
      continue;
    }
    if (text[position] === "\r") position++;
    if (text[position] === "\n") position++;
    if (row.length > 1 || row[0].trim()) onRow(row);
    row = [];
  }
}

const columns = {
  date: ["Data de finalização", ["data finalizacao", "data de finalizacao", "datafinalizacao", "data finalizacao reclamacao"]],
  segment: ["Segmento de mercado", ["segmento de mercado", "segmento mercado", "segmento", "segmentodemercado"]],
  problem: ["Problema", ["problema", "descricao problema", "descricao do problema"]],
  status: ["Situação", ["situacao", "situacao reclamacao", "situacao da reclamacao"]],
  evaluation: ["Avaliação reclamação", ["avaliacao reclamacao", "avaliacao da reclamacao", "avaliacao", "avaliacaoreclamacao"]],
};

const emptyCounts = () => ({ total: 0, evaluated: 0, unresolved: 0 });
const emptyQuality = () => ({ ignoredStatus: 0, invalidDate: 0, malformed: 0, unknownEvaluation: 0, unclassified: 0 });
const asKey = (label) => label.normalize("NFC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

function indexColumns(header) {
  const normalized = header.map((value) => normalize(value.replace(/[*]+/g, "")));
  const indexes = {};
  const missing = [];
  for (const [key, [label, aliases]] of Object.entries(columns)) {
    const index = normalized.findIndex((value) => aliases.includes(value));
    if (index < 0) missing.push(label);
    indexes[key] = index;
  }
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}. Use um CSV do Consumidor.gov.br.`);
  return indexes;
}

function addCounts(destination, source) {
  destination.total += source.total;
  destination.evaluated += source.evaluated;
  destination.unresolved += source.unresolved;
}

export function parseComplaints(text) {
  const months = new Map();
  const quality = emptyQuality();
  let rowCount = 0;
  let headerLength = 0;
  let indexes;
  const dates = new Map();
  const categories = new Map();
  const statuses = new Map();
  const evaluations = new Map();

  function cached(map, raw, transform) {
    let value = map.get(raw);
    if (value === undefined) {
      value = transform(raw);
      if (map.size < 30000) map.set(raw, value);
    }
    return value;
  }

  readRows(text, (row) => {
    if (!indexes) {
      indexes = indexColumns(row);
      headerLength = row.length;
      return;
    }
    rowCount++;
    if (row.length !== headerLength) {
      quality.malformed++;
      return;
    }
    const status = cached(statuses, row[indexes.status], normalize);
    if (!/^finalizad[ao]( |$)/.test(status)) {
      quality.ignoredStatus++;
      return;
    }
    const month = cached(dates, row[indexes.date], dateMonth);
    if (!month) {
      quality.invalidDate++;
      return;
    }
    const evaluation = cached(evaluations, row[indexes.evaluation], normalize);
    const evaluated = evaluation === "resolvida" || evaluation === "nao resolvida";
    if (!evaluated && !["", "nao avaliada", "nao avaliado", "sem avaliacao"].includes(evaluation)) quality.unknownEvaluation++;
    const segment = row[indexes.segment].trim() || UNKNOWN_SEGMENT;
    const problem = row[indexes.problem].trim() || UNKNOWN_PROBLEM;
    if (problem === UNKNOWN_PROBLEM) quality.unclassified++;
    const segmentKey = cached(categories, segment, asKey);
    const problemKey = cached(categories, problem, asKey);
    if (!months.has(month)) months.set(month, new Map());
    const segments = months.get(month);
    if (!segments.has(segmentKey)) segments.set(segmentKey, { label: segment, problems: new Map() });
    const problems = segments.get(segmentKey).problems;
    if (!problems.has(problemKey)) problems.set(problemKey, { label: problem, ...emptyCounts() });
    const counts = problems.get(problemKey);
    counts.total++;
    if (evaluated) counts.evaluated++;
    if (evaluation === "nao resolvida") counts.unresolved++;
  });

  if (!indexes || !rowCount) throw new Error("O CSV contém apenas o cabeçalho. Escolha um arquivo com registros.");
  if (!months.size) throw new Error("Nenhuma reclamação finalizada tem uma data válida neste arquivo.");
  return { months, quality, rowCount };
}

export function packageMonths(months) {
  return [...months].map(([month, segments]) => [month, [...segments].map(([key, segment]) => [
    key, { label: segment.label, problems: [...segment.problems] },
  ])]);
}

export function unpackMonths(entries) {
  return new Map(entries.map(([month, segments]) => [month, new Map(segments.map(([key, segment]) => [
    key, { label: segment.label, problems: new Map(segment.problems) },
  ]))]));
}

export function availableSegments(months) {
  const options = new Map();
  for (const month of months) {
    for (const [key, segment] of month?.segments ?? []) options.set(key, segment.label);
  }
  return [...options].sort((left, right) => labels.compare(left[1], right[1]));
}

function aggregate(month, segmentKey) {
  const problems = new Map();
  const totals = emptyCounts();
  if (!month) return { problems, totals };
  for (const [key, segment] of month.segments) {
    if (segmentKey && key !== segmentKey) continue;
    for (const [problemKey, counts] of segment.problems) {
      if (!problems.has(problemKey)) problems.set(problemKey, { label: counts.label, ...emptyCounts() });
      addCounts(problems.get(problemKey), counts);
      addCounts(totals, counts);
    }
  }
  return { problems, totals };
}

export const unresolvedRate = (counts) => counts.evaluated ? counts.unresolved / counts.evaluated : null;

export function analyze(month, previous, segmentKey = "") {
  const current = aggregate(month, segmentKey);
  const baseline = previous ? aggregate(previous, segmentKey) : null;
  const problemKeys = new Set([...current.problems.keys(), ...(baseline?.problems.keys() ?? [])]);
  const entries = [...problemKeys].map((key) => {
    const first = current.problems.get(key);
    const second = baseline?.problems.get(key);
    return {
      key, label: first?.label ?? second.label, current: first ?? emptyCounts(),
      baseline: baseline ? second ?? emptyCounts() : null,
      change: baseline ? (first?.total ?? 0) - (second?.total ?? 0) : null,
    };
  });
  const classified = entries.filter((entry) => entry.key !== asKey(UNKNOWN_PROBLEM));
  const byCurrent = (left, right) => right.current.total - left.current.total || labels.compare(left.label, right.label);
  const rises = classified.filter((entry) => entry.change > 0).sort((left, right) => right.change - left.change || byCurrent(left, right));
  const falls = classified.filter((entry) => entry.change < 0).sort((left, right) => left.change - right.change || byCurrent(left, right));
  const top = classified.filter((entry) => entry.current.total).sort(byCurrent);
  return {
    month: month.month, previous: previous?.month ?? null, current: current.totals, baseline: baseline?.totals ?? null,
    entries: entries.sort(byCurrent), rises, falls, top,
  };
}

export function createBrief(analysis, segmentLabel) {
  const { current, baseline, month, previous, rises, falls, top } = analysis;
  const complaints = current.total === 1 ? "reclamação finalizada" : "reclamações finalizadas";
  let volume = `${monthName(month)} teve ${formatInteger(current.total)} ${complaints}.`;
  if (baseline) {
    const difference = current.total - baseline.total;
    volume += difference
      ? ` Diferença de ${formatInteger(Math.abs(difference))} a ${difference > 0 ? "mais" : "menos"} em relação a ${monthName(previous).toLowerCase()} (${formatInteger(baseline.total)}).`
      : ` Foi o mesmo volume de ${monthName(previous).toLowerCase()}.`;
  }
  const priority = rises[0] ?? falls[0] ?? top[0];
  let problem = "O recorte não tem problemas classificados.";
  if (priority) {
    const name = `“${priority.label}”`;
    const cases = priority.current.total === 1 ? "caso" : "casos";
    if (priority.change > 0) {
      problem = `${name} teve o maior aumento em volume e passou de ${formatInteger(priority.baseline.total)} para ${formatInteger(priority.current.total)} ${cases}.`;
    } else if (priority.change < 0) {
      problem = `${name} teve a maior queda em volume e passou de ${formatInteger(priority.baseline.total)} para ${formatInteger(priority.current.total)} ${cases}.`;
    } else {
      problem = `${name} foi o problema mais frequente, com ${formatInteger(priority.current.total)} ${cases}.`;
    }
  }
  const resolution = current.evaluated
    ? `${formatInteger(current.unresolved)} de ${formatInteger(current.evaluated)} reclamações avaliadas foram marcadas como não resolvidas (${formatRate(unresolvedRate(current))}).`
    : "Sem avaliações de desfecho suficientes para calcular a proporção de casos não resolvidos.";
  const question = priority
    ? `Em quais canais e etapas da jornada aparecem os casos de “${priority.label}”?`
    : "Quais registros precisam ser revisados para identificar os principais problemas?";
  return {
    title: `Boletim de atendimento · ${monthName(month)}`,
    context: `${segmentLabel}${previous ? ` · Comparação com ${monthName(previous)}` : ""}`,
    facts: [
      { title: "Volume", text: volume },
      { title: "Problema em destaque", text: problem },
      { title: "Resolução", text: resolution },
    ],
    question,
  };
}

export function sortProblems(entries, sort) {
  if (sort === "increase") return [...entries].sort((left, right) => (right.change ?? 0) - (left.change ?? 0) || right.current.total - left.current.total || labels.compare(left.label, right.label));
  if (sort === "decrease") return [...entries].sort((left, right) => (left.change ?? 0) - (right.change ?? 0) || right.current.total - left.current.total || labels.compare(left.label, right.label));
  if (sort === "alphabetical") return [...entries].sort((left, right) => labels.compare(left.label, right.label));
  return entries;
}

function csvText(value) {
  // Prevent labels controlled by uploaded files from becoming spreadsheet formulas.
  const safe = /^[\s\uFEFF]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportProblems(analysis, entries, segmentLabel) {
  const columns = ["Mês", "Mês de comparação", "Segmento", "Problema", "Finalizadas", "Finalizadas na comparação", "Variação em casos", "Avaliadas", "Não resolvidas", "% não resolvidas entre avaliadas"];
  const records = entries.map(({ label, current, baseline, change }) => [
    analysis.month, analysis.previous ?? "", csvText(segmentLabel), csvText(label),
    current.total, baseline?.total ?? "", change ?? "", current.evaluated, current.unresolved,
    current.evaluated ? decimal.format(unresolvedRate(current) * 100) : "",
  ].join(";"));
  return "\uFEFF" + [columns.join(";"), ...records].join("\r\n");
}
