import { h, toast } from "./dom.js";
import { isGenerating } from "./ai.js";
import { OCR_DISCLOSURE, readImageText } from "./ocr.js";
import { LOCAL_SPEECH } from "./speech.js";

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
  const mic = h("button", {
    type: "button",
    class: "btn ghost",
    disabled: true,
    title: LOCAL_SPEECH.reason,
    "data-testid": "capture-mic",
  }, "Mic off");
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
