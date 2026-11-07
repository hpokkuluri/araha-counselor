import { h, toast } from "./dom.js";
import { isGenerating } from "./ai.js";
import { OCR_DISCLOSURE, readImageText } from "./ocr.js";
import { LOCAL_SPEECH, recordingSupported, transcribeBlob } from "./speech.js";

export function captureControls(textarea) {
  const status = h("p", { class: "hint", "data-testid": "capture-status" }, OCR_DISCLOSURE);
  const file = h("input", {
    type: "file",
    accept: "image/*",
    hidden: true,
    "data-testid": "capture-file",
  });
  const photo = h("button", {
    type: "button",
    class: "btn ghost",
    "data-testid": "capture-photo",
    onClick: () => file.click(),
  }, "Photo");
  const canRecord = recordingSupported();
  let recorder = null;
  let stream = null;
  let chunks = [];
  let timer = 0;
  const mic = h("button", {
    type: "button",
    class: "btn ghost",
    disabled: !canRecord,
    title: canRecord ? LOCAL_SPEECH.disclosure : "This browser has no microphone recorder. Voice input cannot run here, and audio is not sent anywhere.",
    "data-testid": "capture-mic",
  }, canRecord ? "Mic" : "No mic in this browser");
  if (!canRecord) status.textContent = `${OCR_DISCLOSURE} ${mic.title}`;

  const stopRecording = () => {
    window.clearTimeout(timer);
    try { recorder?.stop(); } catch { /* already stopped */ }
  };

  mic.addEventListener("click", async () => {
    if (!canRecord) return;
    if (recorder) {
      stopRecording();
      return;
    }
    if (isGenerating()) {
      status.textContent = "Wait until the reply finishes. Speech is not loaded while the counselor model is generating.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder?.mimeType || mime || "audio/webm" });
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        recorder = null;
        mic.textContent = "Mic";
        mic.disabled = true;
        try {
          const text = await transcribeBlob(blob, {
            busy: isGenerating(),
            onStatus: (message) => { status.textContent = message; },
          });
          if (!text) {
            status.textContent = "No words were recognized. Try again. The recording was not uploaded.";
            return;
          }
          const current = textarea.value.trim();
          textarea.value = current ? `${current} ${text}` : text;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          status.textContent = "Edit the text before you send it. The recording was not uploaded. Speech was not tested on iPhone hardware.";
        } catch (error) {
          status.textContent = error?.message || "Transcription failed on this device. Nothing was uploaded.";
          toast(status.textContent);
        } finally {
          mic.disabled = false;
        }
      };
      recorder.start();
      mic.textContent = "Stop and transcribe";
      status.textContent = "Recording here. Tap again within 30 seconds. The audio stays on this device.";
      timer = window.setTimeout(stopRecording, 30000);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      recorder = null;
      status.textContent = error?.name === "NotAllowedError"
        ? "Microphone permission was denied. Nothing was recorded or uploaded."
        : (error?.message || "The microphone could not start. Nothing was uploaded.");
      toast(status.textContent);
    }
  });

  file.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    photo.disabled = true;
    status.textContent = "Reading the photo on this device…";
    try {
      const text = await readImageText(chosen, { busy: isGenerating() });
      if (!text) {
        status.textContent = "No text was found. Type the question. Handwriting often fails. The photo was not uploaded.";
        return;
      }
      const current = textarea.value.trim();
      textarea.value = current ? `${current}\n${text}` : text;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "Edit the recognized text before you send it. The photo was not uploaded.";
    } catch (error) {
      status.textContent = error?.message || "The photo could not be read. Type the question instead.";
      toast(status.textContent);
    } finally {
      photo.disabled = false;
    }
  });
  return h("div", { class: "capture" }, [
    h("div", { class: "composer-tools" }, [photo, mic, file]),
    status,
  ]);
}
