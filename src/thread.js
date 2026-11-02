import { h, toast } from "./dom.js";
import { icon } from "./icons.js";
import { renderRich } from "./rich.js";
import { uid, pushActivity } from "./data.js";
import { session, update } from "./session.js";
import { navigate } from "./nav.js";
import { complete, currentModelId, fitModelChoice, loadModel, modelCached, stopGeneration } from "./ai.js";

export function mountThread(parent, spec) {
  const log = h("div", { class: "chat", "data-testid": "chat-log" });
  const box = h("textarea", {
    class: "txt",
    rows: 2,
    placeholder: spec.placeholder || "Ask a question",
    "data-testid": "chat-input",
  });
  const send = h("button", { type: "button", class: "round", ariaLabel: "Send" }, icon("chevron"));
  let running = false;
  let generation = 0;

  const paint = () => {
    log.replaceChildren();
    const messages = spec.messages();
    if (!messages.length) {
      log.append(h("div", { class: "msg sys" }, spec.intro));
      if (spec.starters?.length) {
        log.append(h("div", { class: "starters" }, spec.starters.map((text) => (
          h("button", { type: "button", class: "chip", onClick: () => ask(text) }, text)
        ))));
      }
    }
    for (const message of messages) log.append(bubble(message));
    log.scrollTop = log.scrollHeight;
  };

  const bubble = (message) => {
    const node = h("div", { class: message.role === "user" ? "msg me" : "msg ai" });
    if (message.role === "assistant") node.append(renderRich(message.content));
    else node.textContent = message.content;
    return node;
  };

  async function ask(text) {
    const content = String(text || "").trim();
    if (!content || running) return;
    box.value = "";
    const userMessage = { id: uid(), role: "user", content, at: new Date().toISOString() };
    update((data) => {
      spec.push(data, userMessage);
      pushActivity(data, spec.activity, spec.activityLabel);
    });
    paint();
    running = true;
    send.disabled = true;
    const mine = ++generation;
    const pending = h("div", { class: "msg ai" }, "Getting the on-device model ready…");
    log.append(pending);
    try {
      const modelId = fitModelChoice(session.data.settings);
      if (currentModelId() !== modelId) {
        const cached = await modelCached(modelId);
        if (!cached) {
          pending.className = "msg err";
          pending.textContent = "The on-device model isn't downloaded yet. You can keep writing without it.";
          pending.append(h("div", {}, h("button", {
            type: "button",
            class: "btn gold",
            onClick: () => navigate("/model"),
          }, "Set up on-device AI")));
          return;
        }
        await loadModel(modelId, (report) => {
          if (mine !== generation) return;
          pending.textContent = report.text || `Loading… ${Math.round(report.progress * 100)}%`;
        });
      }
      if (mine !== generation) return;
      pending.textContent = "";
      const reply = await complete({
        system: spec.system(),
        messages: spec.messages(),
        maxTokens: spec.maxTokens || 700,
        onDelta: (value) => {
          if (mine !== generation) return;
          pending.textContent = value;
        },
      });
      if (mine !== generation) return;
      const assistant = { id: uid(), role: "assistant", content: reply || "I couldn't produce a reply. Try again.", at: new Date().toISOString() };
      update((data) => spec.push(data, assistant));
      paint();
    } catch (error) {
      if (mine !== generation) return;
      pending.className = "msg err";
      pending.textContent = error?.message || "The on-device model stopped.";
    } finally {
      running = false;
      send.disabled = false;
    }
  }

  send.addEventListener("click", () => ask(box.value));
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask(box.value);
    }
  });

  const draft = spec.draft || "";
  if (draft) box.value = draft;

  parent.append(h("div", { class: "thread" }, [
    spec.banner || null,
    log,
    spec.footer || null,
    h("div", { class: "composer" }, [
      h("div", { class: "composer-in" }, [box, send]),
      h("div", { class: "composer-tools" }, [
        h("button", {
          type: "button",
          class: "btn ghost",
          onClick: async () => {
            generation += 1;
            await stopGeneration();
            toast("Stopped.");
            running = false;
            send.disabled = false;
          },
        }, "Stop"),
        h("button", {
          type: "button",
          class: "btn ghost",
          onClick: () => {
            update((data) => spec.clear(data));
            paint();
          },
        }, "Clear chat"),
      ]),
    ]),
  ]));
  paint();
  return { paint };
}
