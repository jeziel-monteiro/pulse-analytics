import { packageMonths } from "./analysis.mjs";
import { importComplaintFile } from "./import-files.mjs";

self.addEventListener("message", async ({ data: file }) => {
  try {
    const result = await importComplaintFile(file);
    self.postMessage({ ...result, months: packageMonths(result.months) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
