import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, createBrief, decodeCsv, exportProblems, formatPoints, parseComplaints, unresolvedRate } from "../dist/analysis.mjs";
import { createBriefPayload, requestBrief } from "../dist/ai.mjs";
import { importComplaintFile } from "../dist/import-files.mjs";
import { zipSync } from "../dist/fflate.mjs";

const header = "Data Finalização;Segmento de Mercado;Problema;Situação;Avaliação Reclamação";
const sample = [
  header,
  "30/12/2024;Telefonia;Cobrança;Finalizada avaliada;Resolvida",
  "31/12/2024;Telefonia;Atendimento;Finalizada avaliada;Resolvida",
  "2025-01-01T13:20:00;Telefonia;Cobrança;Finalizada avaliada;Não Resolvida",
  "03/01/2025;Telefonia;Cobrança;Finalizada não avaliada;Não Avaliada",
  '03/01/2025;Varejo;"Entrega; com ""aspas""\ne segunda linha";Finalizada avaliada;Não Resolvida',
  "04/01/2025;Telefonia;Cobrança;Cancelada;Não Resolvida",
  "31/02/2025;Varejo;Entrega;Finalizada avaliada;Resolvida",
  "2025-01-08;Varejo;Linha de tamanho inválido",
].join("\r\n");

function dataset(parsed, month) {
  return { month, segments: parsed.months.get(month) };
}

test("identifica meses e calcula a taxa entre os casos avaliados", () => {
  const parsed = parseComplaints(sample);
  assert.deepEqual([...parsed.months.keys()], ["2024-12", "2025-01"]);
  assert.deepEqual(parsed.quality, {
    invalidDate: 1, ignoredStatus: 1, malformed: 1, unknownEvaluation: 0, unclassified: 0,
  });
  const analysis = analyze(dataset(parsed, "2025-01"), dataset(parsed, "2024-12"), "telefonia");
  assert.deepEqual(analysis.current, { total: 2, evaluated: 1, unresolved: 1 });
  assert.deepEqual(analysis.baseline, { total: 2, evaluated: 2, unresolved: 0 });
  assert.equal(unresolvedRate(analysis.current), 1);
  assert.equal(analysis.rises[0].change, 1);
  assert.equal(analysis.falls[0].change, -1);
  assert.match(createBrief(analysis, "Telefonia").facts[1].text, /passou de 1 para 2 casos/);
  const entry = analyze(dataset(parsed, "2025-01"), undefined, "varejo").top[0];
  assert.equal(entry.label, 'Entrega; com "aspas"\ne segunda linha');
});

test("analisa um mês sem inventar comparativo ou taxa sem avaliações", () => {
  const parsed = parseComplaints("sep=,\r\nData de Finalização,Segmento,Problema,Situação,Avaliação\r\n29/02/2024,Seguros,Atraso,Finalizada não avaliada,");
  const analysis = analyze(dataset(parsed, "2024-02"));
  const brief = createBrief(analysis, "Seguros");
  assert.equal(analysis.baseline, null);
  assert.equal(unresolvedRate(analysis.current), null);
  assert.match(brief.facts[0].text, /1 reclamação finalizada/);
  assert.match(brief.facts[2].text, /Sem avaliações/);
  assert.equal(formatPoints(-0.0001), "0 p.p.");
});

test("aceita exportação em Windows-1252 e detecta campos obrigatórios ausentes", () => {
  const encoded = Buffer.from(header + "\n27/10/2023;Seguros;Alteração;Finalizada avaliada;Não Resolvida", "latin1");
  const result = parseComplaints(decodeCsv(encoded));
  assert.equal(analyze(dataset(result, "2023-10")).current.unresolved, 1);
  assert.throws(() => parseComplaints("Data Abertura;Descrição\n01/01/2025;Atraso"), /Colunas obrigatórias ausentes/);
  assert.throws(() => parseComplaints(header), /apenas o cabeçalho/);
});

test("abre ZIP com um CSV e apresenta erros de importação acionáveis", async () => {
  const bytes = new TextEncoder().encode(sample);
  const zip = zipSync({ "relatorio.csv": bytes });
  const parsed = await importComplaintFile(new File([zip], "arquivo.zip"));
  assert.equal(parsed.months.size, 2);
  await assert.rejects(importComplaintFile(new File([zipSync({ "a.csv": bytes, "b.csv": bytes })], "bases.zip")), /único CSV/);
  await assert.rejects(importComplaintFile(new File([new Uint8Array([0x50, 0x4b])], "invalido.zip")), /Não foi possível abrir o ZIP/);
  await assert.rejects(importComplaintFile(new File([], "vazio.csv")), /vazio/);
});

test("protege valores de texto na exportação CSV", () => {
  const parsed = parseComplaints(header + '\n12/11/2025;Seguros;"=1+2";Finalizada avaliada;Resolvida');
  const analysis = analyze(dataset(parsed, "2025-11"));
  const csv = exportProblems(analysis, analysis.entries, "+Segmento");
  assert.match(csv, /"'\+Segmento";"'=1\+2";1/);
});

test("envia as contagens e variações do recorte ao Webhook", () => {
  const parsed = parseComplaints(sample);
  const analysis = analyze(dataset(parsed, "2025-01"), dataset(parsed, "2024-12"), "telefonia");
  assert.deepEqual(createBriefPayload(analysis, "Telefonia"), {
    mes: "2025-01",
    mes_comparacao: "2024-12",
    segmento: "Telefonia",
    problemas: [
      { nome: "Cobrança", atual: 2, anterior: 1, variacao: 1 },
      { nome: "Atendimento", atual: 0, anterior: 1, variacao: -1 },
    ],
  });

  const single = analyze(dataset(parsed, "2025-01"), undefined, "telefonia");
  assert.deepEqual(createBriefPayload(single, "Telefonia"), {
    mes: "2025-01",
    segmento: "Telefonia",
    problemas: [{ nome: "Cobrança", atual: 2 }],
  });
});

test("lê o texto devolvido pelo Webhook e informa quando a cota termina", async (context) => {
  const payload = { mes: "2025-01", segmento: "Telefonia", problemas: [] };
  const signal = new AbortController().signal;
  const fetch = context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/boletim");
    assert.equal(options.method, "POST");
    assert.equal(options.signal, signal);
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ text: "**Boletim**\n\nCobrança subiu." });
  });
  assert.equal(await requestBrief(payload, signal), "Boletim\n\nCobrança subiu.");
  fetch.mock.mockImplementation(async () => new Response(null, { status: 429 }));
  await assert.rejects(requestBrief(payload, signal), /cota da IA/);
  fetch.mock.mockImplementation(async () => Response.json({ text: "" }));
  await assert.rejects(requestBrief(payload, signal), /boletim vazio/);
});
