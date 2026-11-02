export const MODELS = [
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 3B Instruct",
    bytes: 1_736_187_904,
    vramMB: 2505,
    blurb: "Recommended. A stronger counselor and tutor. About 1.7 GB to download and about 2.5 GB of GPU memory.",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B Instruct",
    bytes: 695_242_752,
    vramMB: 879,
    blurb: "Smaller fallback for a phone with less memory. About 700 MB to download and about 0.9 GB of GPU memory. Answers are shorter and less detailed.",
  },
];

let webllmPromise = null;
let engine = null;
let worker = null;
let currentId = "";
let loading = null;

function lib() {
  if (!webllmPromise) webllmPromise = import("@mlc-ai/web-llm");
  return webllmPromise;
}

export function currentModelId() {
  return currentId;
}

export function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}

export async function webgpuStatus() {
  if (!navigator.gpu) {
    return { ok: false, reason: "This browser doesn't offer WebGPU, so the on-device model can't run here." };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: "WebGPU is turned on, but this device didn't provide a graphics adapter." };
    return { ok: true, reason: "" };
  } catch (error) {
    return { ok: false, reason: error?.message || "WebGPU couldn't start on this device." };
  }
}

export function connectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return { known: false, cellular: false, label: "" };
  if (connection.type === "cellular") return { known: true, cellular: true, label: "cellular" };
  if (connection.type === "wifi" || connection.type === "ethernet") {
    return { known: true, cellular: false, label: connection.type };
  }
  return { known: false, cellular: false, label: connection.type || connection.effectiveType || "" };
}

export async function modelCached(modelId) {
  const { hasModelInCache } = await lib();
  return hasModelInCache(modelId);
}

export async function forgetModel(modelId) {
  if (currentId === modelId) await unloadModel();
  const { deleteModelAllInfoInCache } = await lib();
  await deleteModelAllInfoInCache(modelId);
}

export async function unloadModel() {
  try { await engine?.unload?.(); } catch { /* already gone */ }
  try { worker?.terminate?.(); } catch { /* already gone */ }
  engine = null;
  worker = null;
  currentId = "";
}

export function loadModel(modelId, onProgress) {
  if (engine && currentId === modelId) return Promise.resolve(engine);
  if (loading) return loading;
  loading = startLoad(modelId, onProgress).finally(() => { loading = null; });
  return loading;
}

async function startLoad(modelId, onProgress) {
  await unloadModel();
  const { CreateWebWorkerMLCEngine, CreateMLCEngine } = await lib();
  const config = {
    initProgressCallback: (report) => {
      const progress = Number(report?.progress || 0);
      onProgress?.({
        progress: Math.max(0, Math.min(1, progress)),
        text: report?.text || "Working…",
      });
    },
  };
  try {
    if (navigator.storage?.persist) {
      try { await navigator.storage.persist(); } catch { /* optional */ }
    }
    worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
    engine = await CreateWebWorkerMLCEngine(worker, modelId, config);
  } catch (error) {
    try { worker?.terminate?.(); } catch { /* ignore */ }
    worker = null;
    try {
      engine = await CreateMLCEngine(modelId, config);
    } catch (fallback) {
      engine = null;
      throw fallback || error;
    }
  }
  currentId = modelId;
  return engine;
}

export async function complete({ system, messages, onDelta, maxTokens = 700 }) {
  if (!engine) throw new Error("The on-device model isn't loaded.");
  const history = messages.slice(-8).map((message) => ({
    role: message.role,
    content: String(message.content || "").slice(0, 4000),
  }));
  const payload = {
    messages: [{ role: "system", content: system }, ...history],
    temperature: 0.6,
    max_tokens: maxTokens,
    stream: true,
  };
  try { await engine.resetChat(); } catch { /* older builds */ }
  const stream = await engine.chat.completions.create(payload);
  let text = "";
  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content || "";
    if (!delta) continue;
    text += delta;
    onDelta?.(text);
  }
  if (!text.trim()) {
    const result = await engine.chat.completions.create({ ...payload, stream: false });
    text = result?.choices?.[0]?.message?.content || "";
    onDelta?.(text);
  }
  return text.trim();
}

export async function stopGeneration() {
  try { await engine?.interruptGenerate?.(); } catch { /* ignore */ }
}
