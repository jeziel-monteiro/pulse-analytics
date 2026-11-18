import {
  analyze, availableSegments, createBrief, exportProblems, formatChange, formatInteger, formatPoints, formatRate,
  monthName, normalize, shortMonth, sortProblems, unpackMonths, unresolvedRate,
} from "./analysis.mjs";
import { createBriefPayload, requestBrief } from "./ai.mjs";

const element = (id) => document.getElementById(id);

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function icon(name) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const use = document.createElementNS(namespace, "use");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#icon-" + name);
  svg.append(use);
  return svg;
}

const state = {
  months: new Map(),
  mode: "",
  current: "",
  baseline: "",
  segment: "",
  analysis: null,
  brief: null,
  busy: false,
  page: 0,
  aiBrief: null,
  aiRequest: null,
};
const perPage = 8;
const fileInput = element("file-input");
const demoButton = element("demo-button");
const pickFiles = element("pick-files");
const dropZone = element("drop-zone");
const monthPicker = element("current-month");
const baselinePicker = element("baseline-month");
const segmentPicker = element("segment-picker");
const sortPicker = element("sort-order");
const search = element("search");
const aiButton = element("ai-button");

function setImportBusy(busy, message = "") {
  state.busy = busy;
  pickFiles.disabled = busy;
  demoButton.disabled = busy;
  fileInput.disabled = busy;
  const status = element("import-status");
  status.textContent = message;
  status.hidden = !message;
}

function showImportMessages(messages = []) {
  const output = element("import-errors");
  output.replaceChildren(...messages.map(({ message, notice }) => node("li", notice ? "import-notice" : "", message)));
  output.hidden = !messages.length;
}

function importInWorker(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv-worker.mjs", import.meta.url), { type: "module" });
    const expired = setTimeout(() => {
      worker.terminate();
      reject(new Error("O processamento excedeu o tempo disponível. Tente um arquivo menor."));
    }, 120000);
    function finish(error, data) {
      clearTimeout(expired);
      worker.terminate();
      if (error) reject(error);
      else resolve(data);
    }
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data);
    worker.onerror = () => finish(new Error("O navegador não conseguiu processar este arquivo."));
    worker.onmessageerror = () => finish(new Error("O navegador não conseguiu carregar os resultados."));
    worker.postMessage(file);
  });
}

function addMonthRecords(months, source, target = state.months) {
  const replaced = [];
  for (const [month, segments] of months) {
    if (target.has(month)) replaced.push(month);
    target.set(month, { month, segments, source });
  }
  return replaced;
}

function sortMonths() {
  return [...state.months.keys()].sort().reverse();
}

function useLatest() {
  const [current = "", baseline = ""] = sortMonths();
  state.current = current;
  state.baseline = baseline;
  state.page = 0;
}

async function importFiles(items) {
  if (state.busy || !items.length) return;
  const files = [...items];
  const messages = [];
  const loaded = state.mode === "upload" ? new Map(state.months) : new Map();
  let imported = false;
  showImportMessages();
  setImportBusy(true, "Lendo arquivos…");
  try {
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      setImportBusy(true, `Processando ${index + 1} de ${files.length} · ${file.name}`);
      try {
        const result = await importInWorker(file);
        const replaced = addMonthRecords(unpackMonths(result.months), {
          name: file.name, rows: result.rowCount, quality: result.quality,
        }, loaded);
        if (replaced.length) messages.push({
          notice: true,
          message: `${file.name} substituiu a base anterior de ${replaced.map(monthName).join(", ")}.`,
        });
        imported = true;
      } catch (error) {
        messages.push({ message: `${file.name} · ${error.message}` });
      }
    }
    if (imported) {
      if (state.mode !== "upload") {
        state.segment = "";
        search.value = "";
        sortPicker.value = "volume";
      }
      state.mode = "upload";
      state.months = loaded;
      useLatest();
      render();
    }
    showImportMessages(messages);
    if (imported) toast("Análise atualizada");
  } finally {
    setImportBusy(false);
    fileInput.value = "";
  }
}

async function loadExample() {
  if (state.busy) return;
  showImportMessages();
  setImportBusy(true, "Carregando dados de exemplo…");
  try {
    const response = await fetch(new URL("./demo.json", import.meta.url));
    if (!response.ok) throw new Error("Não foi possível carregar o exemplo.");
    const { months } = await response.json();
    const loaded = new Map();
    for (const record of months) addMonthRecords(unpackMonths([record.data]), record.source, loaded);
    if (!loaded.size) throw new Error("O exemplo está vazio.");
    state.months = loaded;
    state.mode = "demo";
    state.segment = availableSegments(loaded.values()).find(([key]) => key.startsWith("operadoras de telecomunicações"))?.[0] ?? "";
    search.value = "";
    sortPicker.value = "volume";
    useLatest();
    render();
  } catch {
    render();
    showImportMessages([{ message: "O exemplo está indisponível. Você pode importar seus próprios arquivos." }]);
  } finally {
    setImportBusy(false);
  }
}

function removeMonth(month) {
  if (state.busy) return;
  state.months.delete(month);
  if (state.current === month) useLatest();
  if (state.baseline === month) state.baseline = sortMonths().find((item) => item < state.current) ?? "";
  showImportMessages();
  render();
  const next = element("file-list").querySelector("button") ?? pickFiles;
  next.focus();
}

function setOptions(select, values, selected) {
  select.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
  select.value = selected;
}

function renderInputs() {
  element("import-footer").hidden = !state.months.size;
  element("dataset-origin").textContent = state.mode === "demo" ? "Dados públicos de exemplo" : "Arquivos processados no navegador";
  const list = element("file-list");
  list.replaceChildren();
  for (const month of sortMonths()) {
    const dataset = state.months.get(month);
    const item = node("li", "file-pill");
    const displayName = monthName(month);
    const button = node("button", "remove-file");
    button.type = "button";
    button.title = `Remover ${displayName}`;
    button.setAttribute("aria-label", button.title);
    button.append(icon("close"));
    button.addEventListener("click", () => removeMonth(month));
    item.title = dataset.source.name;
    item.append(icon("file"), node("span", "", displayName), button);
    list.append(item);
  }

  const months = sortMonths();
  setOptions(monthPicker, months.map((month) => [month, monthName(month)]), state.current);
  const comparisons = months.filter((month) => month < state.current);
  if (!comparisons.includes(state.baseline)) state.baseline = "";
  setOptions(baselinePicker, [["", "Sem comparação"], ...comparisons.map((month) => [month, monthName(month)])], state.baseline);
  baselinePicker.disabled = !comparisons.length;
  const segments = availableSegments([state.months.get(state.current), state.months.get(state.baseline)]);
  if (!segments.some(([key]) => key === state.segment)) state.segment = "";
  setOptions(segmentPicker, [["", "Todos os segmentos"], ...segments], state.segment);
}

function qualityReport() {
  const report = element("quality-report");
  report.replaceChildren();
  if (!state.months.size) return;
  const list = node("ul");
  const seen = new Set();
  for (const { source } of state.months.values()) {
    if (seen.has(source)) continue;
    seen.add(source);
    const { quality } = source;
    const details = [
      `${formatInteger(source.rows)} registros lidos`,
      quality.ignoredStatus ? `${formatInteger(quality.ignoredStatus)} fora dos estados finalizados` : "",
      quality.invalidDate ? `${formatInteger(quality.invalidDate)} com data inválida` : "",
      quality.malformed ? `${formatInteger(quality.malformed)} com número incorreto de colunas` : "",
      quality.unknownEvaluation ? `${formatInteger(quality.unknownEvaluation)} com avaliação desconhecida` : "",
      quality.unclassified ? `${formatInteger(quality.unclassified)} sem problema informado` : "",
    ].filter(Boolean);
    const line = node("li");
    line.append(node("strong", "", source.name), document.createTextNode(" · " + details.join(" · ")));
    list.append(line);
  }
  report.append(list);
}

function render() {
  renderInputs();
  qualityReport();
  const current = state.months.get(state.current);
  const dashboard = element("dashboard");
  const empty = element("empty-state");
  dashboard.hidden = !current;
  empty.hidden = Boolean(current);
  element("export-button").disabled = !current;

  resetAI();
  if (!current) {
    state.analysis = null;
    state.brief = null;
    empty.querySelector("h2").textContent = "Sua análise começa com um arquivo";
    empty.querySelector("p").textContent = "Importe um CSV ou ZIP do Consumidor.gov.br.";
    return;
  }
  state.analysis = analyze(current, state.months.get(state.baseline), state.segment);
  state.brief = createBrief(state.analysis, segmentPicker.selectedOptions[0].textContent);
  aiButton.disabled = !state.analysis.top.length && !state.analysis.falls.length;
  if (aiButton.disabled) {
    element("ai-status").textContent = "Sem problemas classificados neste recorte.";
  }
  if (!state.baseline && ["increase", "decrease"].includes(sortPicker.value)) sortPicker.value = "volume";
  sortPicker.querySelector('option[value="increase"]').disabled = !state.baseline;
  sortPicker.querySelector('option[value="decrease"]').disabled = !state.baseline;
  renderMetrics(state.analysis);
  renderChart(state.analysis);
  renderBrief();
  renderTable();
}

function metricDetail(id, parts) {
  element(id).replaceChildren(...parts.map((part) => typeof part === "string" ? document.createTextNode(part) : part));
}

function renderMetrics(analysis) {
  const { current, baseline, previous } = analysis;
  const currentRate = unresolvedRate(current);
  const previousRate = baseline && unresolvedRate(baseline);
  element("total-value").textContent = formatInteger(current.total);
  element("evaluated-value").textContent = formatInteger(current.evaluated);
  element("unresolved-value").textContent = formatRate(currentRate);
  const comparable = baseline && previous;
  metricDetail("total-detail", comparable ? [
    node("span", "change-tag", formatChange(current.total - baseline.total)),
    `vs. ${shortMonth(previous)}`,
  ] : ["No mês analisado"]);
  metricDetail("evaluated-detail", current.total ? [`${formatRate(current.evaluated / current.total)} das finalizadas`] : ["Recorte sem registros no mês"]);
  const unresolvedDetails = [];
  if (currentRate != null && previousRate != null) unresolvedDetails.push(node("span", "change-tag", formatPoints(currentRate - previousRate)));
  unresolvedDetails.push(current.evaluated ? `${formatInteger(current.unresolved)} de ${formatInteger(current.evaluated)} casos` : "Sem avaliação de desfecho");
  metricDetail("unresolved-detail", unresolvedDetails);
}

function renderChart(analysis) {
  const chart = element("chart");
  const legend = element("chart-legend");
  const { rises, falls, top, month, previous } = analysis;
  const featured = (rises.length ? rises : falls.length ? falls : top).slice(0, 4);
  element("chart-subtitle").textContent = rises.length
    ? "Maiores aumentos em número de reclamações"
    : falls.length ? "Maiores quedas em número de reclamações" : "Problemas com mais reclamações no mês";
  chart.replaceChildren();
  legend.replaceChildren();
  legend.hidden = !featured.length;
  if (!featured.length) {
    chart.append(node("p", "chart-empty", "Nenhum problema classificado neste recorte."));
    return;
  }
  for (const [period, className] of [[month, ""], [previous, "previous"]]) {
    if (!period) continue;
    const item = node("span", "legend-item");
    item.append(node("span", `legend-dot ${className}`), document.createTextNode(shortMonth(period)));
    legend.append(item);
  }
  const max = Math.max(...featured.flatMap(({ current, baseline }) => [current.total, baseline?.total ?? 0]));
  for (const { label, current, baseline } of featured) {
    const item = node("div", "chart-row");
    const title = node("div", "chart-label");
    const name = node("span", "chart-label-name", label);
    name.title = label;
    const amounts = node("span", "chart-numbers", formatInteger(current.total));
    const accessible = [`${monthName(month)}: ${formatInteger(current.total)}`];
    if (previous) {
      const before = formatInteger(baseline.total);
      amounts.append(node("span", "", " / " + before));
      accessible.push(`${monthName(previous)}: ${before}`);
    }
    amounts.setAttribute("aria-hidden", "true");
    title.append(name, amounts, node("span", "visually-hidden", accessible.join(" · ")));
    const bars = node("div", "bars");
    bars.setAttribute("aria-hidden", "true");
    for (const [count, className] of [[current.total, ""], [baseline?.total, "previous"]]) {
      if (count == null) continue;
      const track = node("div", "bar-track");
      const bar = node("span", `bar ${className}`);
      bar.style.width = (count / max) * 100 + "%";
      track.append(bar);
      bars.append(track);
    }
    item.append(title, bars);
    chart.append(item);
  }
}

function renderBrief() {
  const { context, facts, question } = state.brief;
  element("brief-context").textContent = context;
  const items = facts.map(({ title, text }) => {
    const item = node("li");
    item.append(node("strong", "", title + ". "), document.createTextNode(text));
    return item;
  });
  element("brief-list").replaceChildren(...items);
  element("brief-question").textContent = question;
  element("ai-summary").hidden = !state.aiBrief;
  element("ai-brief-text").textContent = state.aiBrief ?? "";
}

function filteredEntries() {
  if (!state.analysis) return [];
  const query = normalize(search.value);
  const entries = query ? state.analysis.entries.filter(({ label }) => normalize(label).includes(query)) : state.analysis.entries;
  return sortProblems(entries, sortPicker.value);
}

function renderTable() {
  const { month, previous } = state.analysis;
  const entries = filteredEntries();
  const total = entries.length;
  const lastPage = Math.max(0, Math.ceil(total / perPage) - 1);
  state.page = Math.min(state.page, lastPage);
  const first = state.page * perPage;
  const last = Math.min(total, first + perPage);
  const hasComparison = Boolean(previous);
  element("current-column").textContent = shortMonth(month);
  const columns = document.querySelectorAll("th.comparison-column");
  columns[0].textContent = previous ? shortMonth(previous) : "";
  for (const column of columns) column.hidden = !hasComparison;
  element("table-subtitle").textContent = state.brief.context;
  const body = element("table-body");
  body.replaceChildren();
  if (!total) {
    const row = node("tr");
    const cell = node("td", "no-data", search.value ? "Nenhum problema corresponde à busca." : "Nenhuma reclamação neste recorte.");
    cell.colSpan = hasComparison ? 7 : 5;
    row.append(cell);
    body.append(row);
  }
  for (const { label, current, baseline, change } of entries.slice(first, last)) {
    const row = node("tr");
    const labelCell = node("th", "", label);
    labelCell.scope = "row";
    row.append(labelCell, node("td", "", formatInteger(current.total)));
    if (hasComparison) {
      const deltaClass = change > 0 ? "delta-rise" : change < 0 ? "delta-fall" : "";
      row.append(node("td", "", formatInteger(baseline.total)), node("td", deltaClass, formatChange(change)));
    }
    row.append(
      node("td", "", formatInteger(current.evaluated)),
      node("td", "", formatInteger(current.unresolved)),
      node("td", "", formatRate(unresolvedRate(current))),
    );
    body.append(row);
  }
  const range = total ? `${formatInteger(first + 1)}–${formatInteger(last)} de ${formatInteger(total)} problemas` : "0 problemas";
  element("table-range").textContent = range;
  element("page-prev").disabled = !state.page;
  element("page-next").disabled = state.page >= lastPage;
  element("export-button").disabled = !total;
}

function copyContents() {
  const { title, context, facts, question } = state.brief;
  return [
    title, context, "", ...facts.map(({ title, text }) => title + ". " + text), "",
    "Próxima investigação. " + question, "", "Fonte: Consumidor.gov.br.",
  ].join("\n");
}

async function copyBrief(text, button) {
  const month = state.current;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = node("textarea", "visually-hidden");
      textArea.value = text;
      document.body.append(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      button.focus();
      if (!copied) throw new Error("Clipboard unavailable");
    }
    toast("Boletim copiado");
  } catch {
    download(text, `boletim-${month}.txt`, "text/plain;charset=utf-8");
    toast("Boletim baixado como texto");
  }
}

function download(content, name, type) {
  const link = node("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

let toastTimeout;
function toast(message) {
  const target = element("toast");
  clearTimeout(toastTimeout);
  target.textContent = message;
  target.hidden = false;
  toastTimeout = setTimeout(() => { target.hidden = true; }, 3800);
}

function resetAI() {
  state.aiRequest?.abort();
  state.aiRequest = null;
  state.aiBrief = null;
  element("ai-status").textContent = "";
}

async function generateBrief() {
  if (!state.analysis || state.aiRequest) return;
  const payload = createBriefPayload(state.analysis, segmentPicker.selectedOptions[0].textContent);
  if (!payload.problemas.length) return;
  const controller = new AbortController();
  state.aiRequest = controller;
  aiButton.disabled = true;
  const status = element("ai-status");
  status.textContent = "Gerando rascunho…";
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    const result = await requestBrief(payload, controller.signal);
    if (state.aiRequest !== controller || controller.signal.aborted) return;
    state.aiBrief = result;
    renderBrief();
    status.textContent = "Rascunho pronto.";
  } catch (error) {
    if (state.aiRequest !== controller) return;
    status.textContent = controller.signal.aborted
      ? "A geração demorou mais que o esperado. Tente novamente."
      : "Falha ao gerar o rascunho. " + error.message;
  } finally {
    clearTimeout(timeout);
    if (state.aiRequest === controller) {
      state.aiRequest = null;
      aiButton.disabled = false;
    }
  }
}

pickFiles.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => importFiles(fileInput.files));
demoButton.addEventListener("click", loadExample);
let dragDepth = 0;
dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  if (!state.busy && event.dataTransfer.types.includes("Files")) {
    dragDepth++;
    dropZone.classList.add("dragging");
  }
});
dropZone.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove("dragging");
});
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); });
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("dragging");
  importFiles(event.dataTransfer.files);
});

monthPicker.addEventListener("change", () => {
  state.current = monthPicker.value;
  state.baseline = sortMonths().find((month) => month < state.current) ?? "";
  state.page = 0;
  render();
});
baselinePicker.addEventListener("change", () => {
  state.baseline = baselinePicker.value;
  state.page = 0;
  render();
});
segmentPicker.addEventListener("change", () => {
  state.segment = segmentPicker.value;
  state.page = 0;
  render();
});
for (const [field, event] of [[search, "input"], [sortPicker, "change"]]) {
  field.addEventListener(event, () => {
    state.page = 0;
    renderTable();
  });
}
for (const [id, difference] of [["page-prev", -1], ["page-next", 1]]) {
  element(id).addEventListener("click", () => {
    state.page += difference;
    renderTable();
  });
}

element("copy-button").addEventListener("click", ({ currentTarget }) => {
  if (state.brief) copyBrief(copyContents(), currentTarget);
});
element("copy-ai-button").addEventListener("click", ({ currentTarget }) => {
  if (state.aiBrief) copyBrief(state.aiBrief, currentTarget);
});
element("export-button").addEventListener("click", () => {
  if (!state.analysis) return;
  download(
    exportProblems(state.analysis, filteredEntries(), segmentPicker.selectedOptions[0].textContent),
    `pulse-analytics-${state.current}.csv`,
    "text/csv;charset=utf-8",
  );
});
aiButton.addEventListener("click", generateBrief);

function updateNav() {
  const section = location.hash || "#analise";
  for (const link of document.querySelectorAll(".nav a")) {
    if (link.hash === section) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  if (section === "#metodologia") document.querySelector(".methodology details").open = true;
}
window.addEventListener("hashchange", updateNav);
updateNav();
loadExample();
