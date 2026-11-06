export const OCR_DISCLOSURE = "English text recognition runs in this browser. The first photo may download a public language file from jsDelivr. Your photo is not uploaded. Handwriting and math are often wrong, so edit the text before you send it.";

export async function readImageText(file, { busy = false } = {}) {
  if (busy) {
    throw new Error("Wait until the reply finishes. The photo reader and the model should not run at the same time.");
  }
  if (!file) throw new Error("Choose a photo first.");
  let createWorker;
  try {
    ({ createWorker } = await import("tesseract.js"));
  } catch {
    throw new Error("Text recognition isn't available in this copy. Type the question instead. The photo was not uploaded.");
  }
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(file);
    return String(result?.data?.text || "").trim();
  } finally {
    try { await worker.terminate(); } catch { /* the photo reader is released either way */ }
  }
}
