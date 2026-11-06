import { h, toast, confirmBox } from "../dom.js";
import { shell } from "../shell.js";
import { session, update } from "../session.js";
import { MODELS, connectionInfo, crashNote, currentModelId, deviceHints, forgetModel, formatBytes, loadModel, modelCached, offeredModels, prefersSmallModel, storagePersisted, unloadModel, webgpuStatus } from "../ai.js";

export function mountModel(root) {
  const view = shell(root, { title: "On-device AI", tab: "more", back: "/settings" });
  const host = h("div", { class: "stack", "data-testid": "model-screen" });
  view.content.append(host);
  paint(host);
  return { unmount: view.destroy };
}

async function paint(host) {
  host.replaceChildren(
    h("h1", { class: "display small" }, ["Private ", h("em", {}, "AI")]),
    h("p", { class: "lede" }, "The counselor and tutors run an open-source model on this device. Your questions are not sent to Arahasoft or to a chat service. After the download, it works offline."),
  );
  const note = crashNote();
  if (note) host.append(h("section", { class: "card notice", "data-testid": "model-crash" }, [h("p", {}, note)]));
  if (prefersSmallModel(deviceHints())) {
    host.append(h("p", { class: "hint" }, "This phone starts on the smallest model. A 7B or 8B model is not offered here. These figures come from the WebLLM config, not from a test on this phone."));
  }
  host.append(h("p", { class: "hint" }, storagePersisted === false
    ? "This browser refused persistent storage. It may delete the saved model later. Your profile is separate and is not deleted with the model."
    : "Downloading is different from opening a saved copy. The browser can still drop the model file. Your profile stays in the encrypted account."));
  const gpu = await webgpuStatus();
  if (!gpu.ok) {
    host.append(h("section", { class: "card notice", "data-testid": "webgpu-missing" }, [
      h("h2", {}, "This device can't run the model"),
      h("p", {}, gpu.reason),
      h("p", {}, "Everything else still works: your profile, four-year plan, colleges, careers, scholarships, deadlines, essay drafts, subject notes, parent view, email, PDF, and backup."),
      h("p", {}, "For the counselor chat and subject tutor, open ARAHA Counselor in Chrome or Edge on a recent computer, or in current Chrome on a phone, then come back to this screen."),
    ]));
    return;
  }

  const wifi = h("label", { class: "checkline" }, [
    h("input", {
      type: "checkbox",
      checked: session.data.settings.wifiOnly !== false,
      "data-testid": "wifi-only",
      onChange: (event) => update((data) => { data.settings.wifiOnly = event.target.checked; }),
    }),
    "Only download on Wi-Fi",
  ]);
  const net = connectionInfo();
  const netNote = h("p", { class: "hint" }, net.known
    ? (net.cellular ? "This connection looks like cellular data." : `This connection looks like ${net.label}.`)
    : "This browser doesn't say whether you are on Wi-Fi. Leave the box checked to wait, or uncheck it to download now.");
  host.append(h("section", { class: "card stack" }, [
    h("h2", {}, "Why download it"),
    h("ul", { class: "plain" }, [
      h("li", {}, "It stays private. Answers are computed here."),
      h("li", {}, "It works offline after this one download."),
      h("li", {}, "It is free. There is no API key and no AI account."),
    ]),
    h("p", { class: "hint" }, "The app itself is saved for offline use after the first visit. The model is a separate download from the public model host, then cached on this device."),
    wifi,
    netNote,
  ]));

  const list = h("div", { class: "stack" });
  host.append(list);
  const progress = h("div", { class: "card stack", hidden: true, "data-testid": "model-progress" }, [
    h("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, h("span")),
    h("p", { class: "hint", "data-testid": "model-status" }, ""),
  ]);
  host.append(progress);

  for (const model of offeredModels()) {
    const cached = await modelCached(model.id).catch(() => false);
    const selected = session.data.settings.modelId === model.id;
    const card = h("article", { class: "card stack model-card" }, [
      h("h2", {}, model.name),
      model.recommended ? h("span", { class: "chip", style: { "--accent": "#F2B33D" } }, "Recommended") : null,
      selected ? h("span", { class: "chip", style: { "--accent": "#1B5CEB" } }, "Selected") : null,
      h("p", {}, model.blurb),
      h("p", { class: "hint" }, `${formatBytes(model.bytes) ? `${formatBytes(model.bytes)} download · ` : "Download size is shown while it loads. "}WebLLM lists about ${(model.vramMB / 1000).toFixed(1)} GB GPU memory${model.recommended ? "" : ""}${cached ? " · saved on this device" : ""}`),
      h("button", {
        type: "button",
        class: "btn gold",
        "data-testid": `download-${model.id}`,
        onClick: () => begin(model, progress, () => paint(host)),
      }, cached ? "Load saved model" : "Download"),
      cached ? h("button", {
        type: "button",
        class: "btn ghost danger-text",
        onClick: async () => {
          const ok = await confirmBox({ title: "Remove this download?", message: "You can download it again later. Other profiles on this device share the saved model.", confirmText: "Remove", danger: true });
          if (!ok) return;
          await forgetModel(model.id);
          toast("Download removed from this device.");
          paint(host);
        },
      }, "Remove download") : null,
    ]);
    list.append(card);
  }
  if (currentModelId()) {
    host.append(h("p", { class: "hint" }, `Ready now: ${MODELS.find((model) => model.id === currentModelId())?.name || currentModelId()}. You can turn the internet off and keep chatting.`));
  }
}

async function begin(model, progress, redraw) {
  const wifiOnly = session.data.settings.wifiOnly !== false;
  const net = connectionInfo();
  if (wifiOnly && net.known && net.cellular) {
    const cached = await modelCached(model.id).catch(() => false);
    if (!cached) {
      toast("You're on cellular data. Connect to Wi-Fi, or turn off “Only download on Wi-Fi”.");
      return;
    }
  }
  const previous = session.data.settings.modelId;
  update((data) => {
    data.settings.modelId = model.id;
    data.settings.modelPick = "user";
  });
  if (previous && previous !== model.id) {
    try { await forgetModel(previous); } catch { /* cache may already be gone */ }
  }
  progress.hidden = false;
  const bar = progress.querySelector(".meter");
  const label = progress.querySelector("[data-testid=model-status]");
  const set = (value, text) => {
    const pct = Math.round(value * 100);
    bar.setAttribute("aria-valuenow", String(pct));
    bar.firstElementChild.style.width = `${pct}%`;
    label.textContent = text;
  };
  set(0, "Starting…");
  try {
    await loadModel(model.id, (report) => set(report.progress, report.text));
    set(1, "Saved on this device. Counselor and tutors can work offline.");
    toast("Model is ready.");
    redraw();
  } catch (error) {
    set(0, error?.message || "The download stopped.");
    toast("The model didn't finish. You can try again, or use the smaller model.");
    await unloadModel().catch(() => {});
  }
}
