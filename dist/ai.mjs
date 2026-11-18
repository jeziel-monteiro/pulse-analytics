export function createBriefPayload(analysis, segment) {
  const changes = [...analysis.rises, ...analysis.falls];
  changes.sort((left, right) =>
    Math.abs(right.change) - Math.abs(left.change) || right.current.total - left.current.total,
  );
  const problems = (changes.length ? changes : analysis.top).slice(0, 5);
  return {
    mes: analysis.month,
    ...(analysis.previous && { mes_comparacao: analysis.previous }),
    segmento: segment,
    problemas: problems.map(({ label, current, baseline, change }) => ({
      nome: label,
      atual: current.total,
      ...(baseline && { anterior: baseline.total, variacao: change }),
    })),
  };
}

export async function requestBrief(payload, signal) {
  const response = await fetch("/api/boletim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (response.status === 429) throw new Error("A cota da IA foi atingida. Tente mais tarde.");
  if (!response.ok) throw new Error("Confira se o n8n está rodando e se o workflow está publicado.");

  const result = await response.json();
  if (typeof result?.text !== "string" || !result.text.trim()) {
    throw new Error("O n8n devolveu um boletim vazio ou em um formato inesperado.");
  }
  return result.text.trim().replace(/\*\*([^*\n]+)\*\*/g, "$1");
}
