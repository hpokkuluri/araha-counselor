export const LARGE_ID = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
export const SMALL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const PHONE_STEP_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
export const DESKTOP_7B_ID = "Qwen2.5-7B-Instruct-q4f16_1-MLC";
export const DESKTOP_8B_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";
export const GEMMA_ID = "gemma-2-2b-it-q4f16_1-MLC-1k";
const LOAD_FLAG = "ac-model-load";
const TOO_BIG_KEY = "ac-model-too-big";

// vramMB is vram_required_MB from @mlc-ai/web-llm 0.2.87 prebuiltAppConfig.
// Download bytes are filled only where this app already recorded the MLC package size.
export const MODELS = [
  {
    id: SMALL_ID,
    name: "Llama 3.2 1B Instruct",
    tier: "phone",
    bytes: 695_242_752,
    vramMB: 879.04,
    context: 2048,
    blurb: "Automatic phone model. WebLLM lists about 879 MB of GPU memory for the 4096-token build. ARAHA loads it with a 2048-token cap. About 700 MB to download.",
  },
  {
    id: PHONE_STEP_ID,
    name: "Qwen 2.5 1.5B Instruct",
    tier: "phone-extra",
    bytes: null,
    vramMB: 1629.75,
    context: 2048,
    blurb: "Optional phone step up. WebLLM lists about 1.6 GB of GPU memory and marks it low-resource. Not selected automatically.",
  },
  {
    id: GEMMA_ID,
    name: "Gemma 2 2B Instruct (experimental, 1k)",
    tier: "experimental",
    bytes: null,
    vramMB: 1583.3,
    context: 1024,
    blurb: "Experimental choice, not the automatic model. WebLLM 0.2.87 id gemma-2-2b-it-q4f16_1-MLC-1k lists 1583 MB GPU memory, a 1024-token window, low-resource required, and shader-f16. The 4096-token Gemma 2 2B build is listed at 1895 MB and is not low-resource, so it is not offered. Download size is shown while it loads. Another app on this iPhone has run Gemma; that app's exact build is not known here, and this option was not tested on iPhone hardware. If it fails, switch back to Llama 3.2 1B.",
  },
  {
    id: LARGE_ID,
    name: "Qwen 2.5 3B Instruct",
    tier: "desktop",
    bytes: 1_736_187_904,
    vramMB: 2504.76,
    context: 4096,
    blurb: "Automatic computer model. WebLLM lists about 2.5 GB of GPU memory. About 1.7 GB to download. A phone does not get this unless you explicitly choose it.",
  },
  {
    id: DESKTOP_7B_ID,
    name: "Qwen 2.5 7B Instruct",
    tier: "large",
    bytes: null,
    vramMB: 5106.67,
    context: 4096,
    blurb: "Explicit computer choice only. WebLLM lists about 5.1 GB of GPU memory and does not mark it low-resource. It is never downloaded automatically.",
  },
  {
    id: DESKTOP_8B_ID,
    name: "Llama 3.1 8B Instruct",
    tier: "large",
    bytes: null,
    vramMB: 5001,
    context: 4096,
    blurb: "Explicit computer choice only. WebLLM lists about 5.0 GB of GPU memory and does not mark it low-resource. It is never downloaded automatically.",
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

export function modelTier(id) {
  return MODELS.find((model) => model.id === id)?.tier || "";
}

export function contextBudget(smallDevice) {
  return smallDevice
    ? { messages: 4, chars: 900, maxTokens: 320 }
    : { messages: 6, chars: 2000, maxTokens: 640 };
}

export function chooseModelId({ savedId = "", userPick = false, tooBig = [], smallDevice = false } = {}) {
  const blocked = new Set(tooBig);
  const tier = modelTier(savedId);
  const known = Boolean(tier) && savedId && !blocked.has(savedId);
  if (userPick && known) {
    if (smallDevice && tier === "large") return blocked.has(SMALL_ID) ? PHONE_STEP_ID : SMALL_ID;
    return savedId;
  }
  if (smallDevice) return blocked.has(SMALL_ID) ? PHONE_STEP_ID : SMALL_ID;
  if (known && tier !== "large" && tier !== "experimental") return savedId;
  return blocked.has(LARGE_ID) ? SMALL_ID : LARGE_ID;
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
    if (small && (model.tier === "desktop" || model.tier === "large")) return false;
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
let loadingId = "";
let gpuLimits = null;
let conversationKey = "";
let inflight = null;
let generationEpoch = 0;

// One WebLLM engine for the whole app. Counselor, essays, and subject
// tutors share it. Weights unload only when the selected model changes
// or a download is removed — never when a screen changes or a chat is cleared.

function lib() {
  if (!webllmPromise) webllmPromise = import("@mlc-ai/web-llm");
  return webllmPromise;
}

export function currentModelId() {
  return currentId;
}

export function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}

export let storagePersisted = null;

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
  const current = engine;
  const thread = worker;
  engine = null;
  worker = null;
  currentId = "";
  conversationKey = "";
  try { await current?.unload?.(); } catch { /* already gone */ }
  try { thread?.terminate?.(); } catch { /* already gone */ }
}

export function loadModel(modelId, onProgress) {
  if (engine && currentId === modelId) return Promise.resolve(engine);
  if (loading && loadingId === modelId) return loading;
  const earlier = loading;
  loadingId = modelId;
  const job = (async () => {
    if (earlier) {
      try { await earlier; } catch { /* a failed load leaves the engine empty */ }
    }
    if (engine && currentId === modelId) return engine;
    return startLoad(modelId, onProgress);
  })();
  const tracked = job.finally(() => {
    if (loading === tracked) {
      loading = null;
      loadingId = "";
    }
  });
  loading = tracked;
  return tracked;
}

async function startLoad(modelId, onProgress) {
  if (engine && currentId === modelId) return engine;
  const store = storage();
  store?.setItem(LOAD_FLAG, modelId);
  if (currentId && currentId !== modelId) await unloadModel();
  const chatOpts = { context_window_size: MODELS.find((model) => model.id === modelId)?.context || 2048 };
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
      try { storagePersisted = await navigator.storage.persist(); } catch { storagePersisted = false; }
    }
    worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
    engine = await CreateWebWorkerMLCEngine(worker, modelId, config, chatOpts);
  } catch (error) {
    try { worker?.terminate?.(); } catch { /* ignore */ }
    worker = null;
    try {
      engine = await CreateMLCEngine(modelId, config, chatOpts);
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

export async function useConversation(key) {
  if (!key || key === conversationKey) return;
  const previous = conversationKey;
  conversationKey = key;
  if (!engine || !previous) return;
  try { await engine.resetChat(); } catch { /* keep the weights loaded */ }
}

export function isGenerating() {
  return Boolean(inflight);
}

export async function stopGeneration() {
  generationEpoch += 1;
  try { await engine?.interruptGenerate?.(); } catch { /* ignore */ }
}

export async function resetConversation() {
  const pending = inflight;
  await stopGeneration();
  if (pending) {
    try { await pending; } catch { /* the interrupted reply is discarded */ }
  }
  if (!engine) return;
  try { await engine.resetChat(); } catch { /* keep the weights loaded */ }
}

export async function complete(opts) {
  const { usesCloud, session } = await import("./session.js");
  if (usesCloud()) {
    const mine = ++generationEpoch;
    try {
      const { geminiText } = await import("./cloud.js");
      return await geminiText({
        system: opts.system,
        messages: opts.messages,
        data: session.data,
        onDelta: (value) => { if (mine === generationEpoch) opts.onDelta?.(value); },
        shouldStop: () => mine !== generationEpoch,
      });
    } catch (error) {
      if (engine) return localComplete(opts);
      throw new Error(error?.message || "Gemini didn't answer. Your chat is still here. You can turn on the on-device model in Settings and try again.");
    }
  }
  if (!engine) {
    try {
      const { usesCloud: stillCloud } = await import("./session.js");
      if (!stillCloud()) throw new Error("Sign in to use Gemini, or turn on the on-device model in Settings.");
    } catch (error) {
      if (!engine) throw error;
    }
  }
  return localComplete(opts);
}

async function localComplete({ system, messages, onDelta, maxTokens = 700, threadKey = "" }) {
  if (!engine) throw new Error("The on-device model isn't loaded. Gemini is the default once you are signed in.");
  const prior = inflight;
  const mine = ++generationEpoch;
  if (prior) {
    try { await engine.interruptGenerate?.(); } catch { /* ignore */ }
  }
  const run = (async () => {
    if (prior) {
      try { await prior; } catch { /* the previous reply was interrupted */ }
    }
    if (mine !== generationEpoch) return "";
    return generate({ system, messages, onDelta, maxTokens, threadKey, mine });
  })();
  inflight = run;
  try {
    return await run;
  } finally {
    if (inflight === run) inflight = null;
  }
}

async function generate({ system, messages, onDelta, maxTokens, threadKey, mine }) {
  if (mine !== generationEpoch) return "";
  await useConversation(threadKey);
  if (mine !== generationEpoch) return "";
  const budget = contextBudget(prefersSmallModel(deviceHints()));
  const history = messages.slice(-budget.messages).map((message) => ({
    role: message.role,
    content: String(message.content || "").slice(0, budget.chars),
  }));
  const payload = {
    messages: [{ role: "system", content: system }, ...history],
    temperature: 0.6,
    max_tokens: Math.min(maxTokens, budget.maxTokens),
    stream: true,
  };
  let text = "";
  try {
    const stream = await engine.chat.completions.create(payload);
    for await (const chunk of stream) {
      if (mine !== generationEpoch) return text.trim();
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      text += delta;
      onDelta?.(text);
    }
  } catch (error) {
    if (mine !== generationEpoch) return text.trim();
    throw error;
  }
  if (mine !== generationEpoch) return text.trim();
  if (!text.trim()) {
    const result = await engine.chat.completions.create({ ...payload, stream: false });
    if (mine !== generationEpoch) return text.trim();
    text = result?.choices?.[0]?.message?.content || "";
    onDelta?.(text);
  }
  return text.trim();
}

export function installEngineForTest(stub) {
  engine = stub || null;
  worker = stub?.worker || null;
  currentId = stub?.modelId || "";
  conversationKey = "";
  inflight = null;
  generationEpoch = 0;
  loading = null;
  loadingId = "";
}
