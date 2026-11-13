import { h, toast, confirmBox, downloadBlob } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, signOut, deleteCurrent, replaceData, update } from "../session.js";
import { exportPayload, parseBackup } from "../data.js";
import { applyTheme, choiceLabel, getChoice } from "../theme.js";
import { brandName } from "../brand.js";
import { checkForUpdates, versionLine } from "../updates.js";
import { fitModelChoice, forgetModel, offeredModels } from "../ai.js";
import { importDeviceIntoCloud, listAccounts } from "../session.js";

export function mountSettings(root) {
  const view = shell(root, { title: "More", tab: "more" });
  const choice = getChoice();
  view.content.append(
    h("section", { class: "card stack" }, [
      h("h2", {}, "Appearance"),
      h("p", { class: "hint" }, "Saved on this device for every profile. Auto follows the phone or laptop light or dark setting."),
      h("div", { class: "seg", "data-testid": "theme-setting" }, [
        option("auto", "Auto", choice),
        option("light", "Day", choice),
        option("dark", "Dark", choice),
      ]),
      h("p", { class: "hint", "data-testid": "theme-now" }, `Using ${choiceLabel(choice)}.`),
    ]),
    link("Profile", "Name, school, classes, parents", "/profile"),
    link("Parent view", "PIN, summary, email, PDF", "/parent"),
    link("Progress report", "Email parents and share a PDF", "/progress"),
    link("On-device AI", "Download the private model", "/model"),
    modelSetting(),
    h("section", { class: "card stack", "data-testid": "migration" }, [
      h("h2", {}, "Moving to another address"),
      h("p", {}, "A future site such as counselor.arahasoft.com would be a different origin from this GitHub Pages address. The profile, PIN, and model cache stored here do not move by themselves."),
      h("p", { class: "hint" }, "Export a backup below, then use Import on the new address. This screen does not change DNS or publish a new domain."),
    ]),
    h("section", { class: "card stack" }, [
      h("h2", {}, "Backup"),
      h("p", { class: "hint" }, "The file is readable JSON. It is how your data moves to a new phone or a future address. Keep it private. The copy inside the app stays encrypted."),
      h("button", { type: "button", class: "btn primary", "data-testid": "export-json", onClick: exportNow }, "Export backup"),
      h("button", { type: "button", class: "btn ghost", onClick: importDevice }, "Import this device's old profile into the cloud"),
      h("label", { class: "btn ghost" }, [
        "Import backup",
        h("input", { type: "file", accept: "application/json,.json", hidden: true, "data-testid": "import-json", onChange: importNow }),
      ]),
    ]),
    h("button", { type: "button", class: "btn ghost", "data-testid": "sign-out", onClick: async () => { await signOut(); navigate("/login"); } }, "Sign out"),
    h("button", {
      type: "button",
      class: "btn danger",
      onClick: async () => {
        const ok = await confirmBox({ title: "Delete this profile?", message: "The encrypted copy on this device will be removed. A backup file you already exported is not deleted.", confirmText: "Delete", danger: true });
        if (!ok) return;
        await deleteCurrent();
        navigate("/login");
      },
    }, "Delete profile"),
    h("section", { class: "card stack" }, [
      h("h2", {}, "App"),
      h("button", {
        type: "button",
        class: "btn ghost",
        "data-testid": "check-updates",
        onClick: async () => {
          const result = await checkForUpdates();
          if (result.message) toast(result.message);
        },
      }, "Check for updates"),
      h("p", { class: "hint", "data-testid": "app-version" }, versionLine()),
    ]),
    h("section", { class: "card about stack" }, [
      brandName("md"),
      h("p", {}, "ARAHA Counselor 2.1 · Arahasoft LLC"),
      h("p", { class: "hint" }, "Version 2 adds on-device speech, packaged College Scorecard and public-school files, preparation sequences, and model-made quizzes. Refreshing an update replaces the app shell. It does not delete your profile or the downloaded counselor model."),
      h("p", { class: "hint" }, "Install it from the browser menu (Add to Home Screen or Install app). It then opens like an app, with your data still on this device."),
    ]),
  );
  return { unmount: view.destroy };
}

function modelSetting() {
  const models = offeredModels();
  const current = fitModelChoice(session.data.settings);
  const picker = h("select", {
    class: "txt",
    "data-testid": "model-choice",
    onChange: async (event) => {
      const next = event.target.value;
      const previous = session.data.settings.modelId;
      update((data) => {
        data.settings.modelId = next;
        data.settings.modelPick = "user";
      });
      if (previous && previous !== next) {
        try { await forgetModel(previous); } catch { /* cache may already be gone */ }
        toast("Switched model and removed the previous download.");
      }
    },
  }, models.map((model) => h("option", { value: model.id }, model.recommended ? `${model.name} (recommended)` : model.name)));
  picker.value = models.some((model) => model.id === current) ? current : (models[0]?.id || "");
  return h("section", { class: "card stack" }, [
    h("h2", {}, "Model"),
    h("p", { class: "hint" }, "Gemini is the default. The on-device model is only used when you turn it on, or if Gemini fails and a model is already loaded."),
    h("label", { class: "checkline" }, [
      h("input", {
        type: "checkbox",
        checked: session.data.settings.preferLocal === true,
        "data-testid": "prefer-local",
        onChange: (event) => update((data) => { data.settings.preferLocal = event.target.checked; }),
      }),
      "Prefer the on-device model",
    ]),
    picker,
  ]);
}

function option(value, label, current) {
  return h("button", {
    type: "button",
    class: current === value ? "on" : "",
    "data-testid": `setting-theme-${value}`,
    onClick: (event) => {
      applyTheme(value);
      const seg = event.currentTarget.parentElement;
      seg.querySelectorAll("button").forEach((button) => button.classList.toggle("on", button === event.currentTarget));
      const hint = seg.parentElement.querySelector("[data-testid=theme-now]");
      if (hint) hint.textContent = `Using ${label}.`;
    },
  }, label);
}

function link(title, hint, href) {
  return h("button", { type: "button", class: "card rowlink", onClick: () => navigate(href) }, [
    h("b", {}, title),
    h("span", {}, hint),
  ]);
}

function exportNow() {
  const payload = exportPayload(session.username, session.data);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `araha-counselor-${session.username || "backup"}.json`);
  toast("Backup downloaded. Store that file somewhere private.");
}

async function importDevice() {
  if (!session.cloud) {
    toast("Sign in with email first. Then this copies a profile that already lives on the phone.");
    return;
  }
  const accounts = await listAccounts().catch(() => []);
  if (!accounts.length) {
    toast("No on-device profile was found to import.");
    return;
  }
  const name = window.prompt("Profile name on this device", accounts[0].username);
  if (!name) return;
  const password = window.prompt("Password that unlocks that on-device profile");
  if (!password) return;
  try {
    await importDeviceIntoCloud(name, password);
    toast("Imported into your cloud account.");
  } catch (error) {
    toast(error.message || "Couldn't import that profile.");
  }
}

async function importNow(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 15_000_000) throw new Error("That backup is too large.");
    const parsed = parseBackup(await file.text());
    const ok = await confirmBox({
      title: "Replace this profile's data?",
      message: "Importing overwrites the counselor data for the profile you are signed in to. Export a backup first if you want to keep the current copy.",
      confirmText: "Import",
      danger: true,
    });
    if (!ok) return;
    await replaceData(parsed.data);
    toast("Backup imported on this device.");
    navigate("/home");
  } catch (error) {
    toast(error.message || "Couldn't import that file.");
  }
}
