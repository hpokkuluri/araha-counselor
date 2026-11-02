export const LARGE_ID = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
export const SMALL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const LOAD_FLAG = "ac-model-load";
const TOO_BIG_KEY = "ac-model-too-big";

export const MODELS = [
  {
    id: LARGE_ID,
    name: "Qwen 2.5 3B Instruct",
    bytes: 1_736_187_904,
    vramMB: 2505,
    blurb: "Best on a computer. About 1.7 GB to download and about 2.5 GB of GPU memory.",
  },
  {
    id: SMALL_ID,
    name: "Llama 3.2 1B Instruct",
    bytes: 695_242_752,
    vramMB: 879,
    blurb: "The phone model. About 700 MB to download and about 0.9 GB of GPU memory.",
  },
];

let crashNoteText = "";

export function prefersSmallModel(hints = {}) {
  if (hints.ios || hints.android || hints.phone) return true;
  if (typeof hints.deviceMemory === "number" && hints.deviceMemory > 0 && hints.deviceMemory <= 4) return true;
  if (hints.narrow) return true;
  if (typeof hints.maxBufferSize === "number" && hints.maxBufferSize < 1_500_000_000) return true;
  if (typeof hints.maxStorageBufferBindingSize === "number" && hints.maxStorageBufferBindingSize < 1_073_741_824) return true;
  return false;
}

export function chooseModelId({ savedId = "", userPick = false, tooBig = [], smallDevice = false } = {}) {
  const blocked = new Set(tooBig);
  if (userPick && savedId && !blocked.has(savedId)) return savedId;
  if (smallDevice || blocked.has(LARGE_ID)) return SMALL_ID;
  if (savedId && !blocked.has(savedId)) return savedId;
  return LARGE_ID;
}

export function deviceHints(nav = globalThis.navigator, win = globalThis) {
  const ua = nav?.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (nav?.platform === "MacIntel" && (nav?.maxTouchPoints || 0) > 1);
  const android = /Android/i.test(ua);
  const narrow = Boolean(win?.matchMedia?.("(max-width: 820px)")?.matches);
  const coarse = Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
  return {
    ios,
    android,
    phone: ios || android || (narrow && coarse),
    narrow,
    deviceMemory: Number(nav?.deviceMemory) || 0,
    maxBufferSize: gpuLimits?.maxBufferSize,
    maxStorageBufferBindingSize: gpuLimits?.maxStorageBufferBindingSize,
  };
}

function storage() {
  try { return localStorage; } catch { return null; }
}

export function readTooBig(store = storage()) {
  if (!store) return [];
  try { return JSON.parse(store.getItem(TOO_BIG_KEY) || "[]").filter((id) => typeof id === "string"); }
  catch { return []; }
}

export function noteInterruptedLoad(store = storage()) {
  if (!store) return "";
  const id = store.getItem(LOAD_FLAG);
  if (!id) return "";
  store.removeItem(LOAD_FLAG);
  const tooBig = readTooBig(store);
  if (!tooBig.includes(id)) {
    tooBig.push(id);
    store.setItem(TOO_BIG_KEY, JSON.stringify(tooBig));
  }
  const name = MODELS.find((model) => model.id === id)?.name || "That model";
  crashNoteText = `${name} was too big for this device, so the page reloaded. ARAHA switched to the smaller model.`;
  return crashNoteText;
}

export function crashNote() {
  return crashNoteText;
}

export function fitModelChoice(settings = {}) {
  return chooseModelId({
    savedId: settings.modelId || "",
    userPick: settings.modelPick === "user",
    tooBig: readTooBig(),
    smallDevice: prefersSmallModel(deviceHints()),
  });
}

export function offeredModels() {
  const small = prefersSmallModel(deviceHints());
  const blocked = new Set(readTooBig());
  return MODELS.filter((model) => {
    if (blocked.has(model.id)) return false;
    if (small && model.id === LARGE_ID) return false;
    return true;
  }).map((model) => ({
    ...model,
    recommended: model.id === (small ? SMALL_ID : LARGE_ID),
  }));
}

let webllmPromise = null;
let engine = null;
let worker = null;
let currentId = "";
let loading = null;
let gpuLimits = null;

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
    gpuLimits = adapter.limits || null;
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
  const store = storage();
  store?.setItem(LOAD_FLAG, modelId);
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
      store?.removeItem(LOAD_FLAG);
      throw fallback || error;
    }
  }
  currentId = modelId;
  store?.removeItem(LOAD_FLAG);
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
