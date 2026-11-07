export const SPEECH_MODEL = "Xenova/whisper-tiny.en";

export const LOCAL_SPEECH = {
  model: SPEECH_MODEL,
  disclosure: "Speech turns into text on this device with Whisper Tiny English. The first use downloads public model files from Hugging Face. The recording is not uploaded. This path was not run on iPhone hardware.",
};

export function speechSendsAudio() {
  return false;
}

export function recordingSupported(nav = globalThis.navigator) {
  return Boolean(nav?.mediaDevices?.getUserMedia && typeof globalThis.MediaRecorder === "function");
}

export function toMono16k(audioBuffer) {
  const rate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  if (!data?.length) return new Float32Array();
  if (rate === 16000) return data;
  const length = Math.max(1, Math.round(data.length * 16000 / rate));
  const out = new Float32Array(length);
  const last = data.length - 1;
  for (let i = 0; i < length; i += 1) {
    const pos = i * rate / 16000;
    const left = Math.min(last, Math.floor(pos));
    const right = Math.min(last, left + 1);
    const mix = pos - left;
    out[i] = data[left] * (1 - mix) + data[right] * mix;
  }
  return out;
}

let active = null;

export async function transcribeSamples(samples, { busy = false, onStatus } = {}) {
  if (busy) {
    throw new Error("Wait until the reply finishes. The speech model is not loaded while the counselor model is generating.");
  }
  if (!samples?.length) throw new Error("The recording was empty. Nothing was uploaded.");
  if (samples.length > 16000 * 30) samples = samples.subarray(0, 16000 * 30);
  if (active) throw new Error("A transcription is already running on this device.");
  onStatus?.("Loading the on-device speech model. Public files may download the first time.");
  let transcriber = null;
  active = true;
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    transcriber = await pipeline("automatic-speech-recognition", SPEECH_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (report) => {
        if (report?.status === "progress" && report.file) {
          onStatus?.(`Downloading public speech file ${report.file}…`);
        }
      },
    });
    onStatus?.("Transcribing on this device…");
    const result = await transcriber(samples, { language: "english", task: "transcribe" });
    return String(result?.text || "").trim();
  } finally {
    active = null;
    try { await transcriber?.dispose?.(); } catch { /* the speech model is released either way */ }
  }
}

export async function transcribeBlob(blob, options = {}) {
  if (!blob || !blob.size) throw new Error("The recording was empty. Nothing was uploaded.");
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = toMono16k(decoded);
    return await transcribeSamples(samples, options);
  } finally {
    try { await context.close(); } catch { /* recorder context released */ }
  }
}
