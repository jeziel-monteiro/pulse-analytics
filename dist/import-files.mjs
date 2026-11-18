import { decodeCsv, MAX_CSV_BYTES, parseComplaints } from "./analysis.mjs";
import { unzipSync } from "./fflate.mjs";

export async function importComplaintFile(file) {
  if (!file.size) throw new Error("O arquivo está vazio.");
  if (file.size > MAX_CSV_BYTES) throw new Error("O arquivo excede o limite de 250 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zipSignature = bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
  const zipped = /\.zip$/i.test(file.name) || zipSignature;
  if (!zipped && !/\.csv$/i.test(file.name)) throw new Error("Selecione um CSV ou um ZIP com um CSV oficial.");
  const csv = zipped ? extractCsv(bytes) : bytes;
  return parseComplaints(decodeCsv(csv));
}

function extractCsv(bytes) {
  let found = false;
  let issue;
  let result;
  try {
    result = unzipSync(bytes, {
      filter({ name, size, originalSize, compression }) {
        if (!/\.csv$/i.test(name) || name.startsWith("__MACOSX/")) return false;
        if (found) issue = "O ZIP deve conter um único CSV. Extraia os arquivos e selecione-os separadamente.";
        found = true;
        if (originalSize > MAX_CSV_BYTES || (!compression && size > MAX_CSV_BYTES)) {
          issue = "O CSV dentro do ZIP ultrapassa 250 MB.";
        }
        if (issue) throw new Error(issue);
        return true;
      },
    });
  } catch {
    throw new Error(issue ?? "Não foi possível abrir o ZIP. Baixe novamente ou extraia o CSV e envie-o separado.");
  }
  const csv = Object.values(result)[0];
  if (!csv?.length) throw new Error("Nenhum CSV com dados foi encontrado dentro do ZIP.");
  return csv;
}
