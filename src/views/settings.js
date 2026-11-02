import { h, toast, confirmBox, downloadBlob } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, signOut, deleteCurrent, replaceData } from "../session.js";
import { exportPayload, parseBackup } from "../data.js";
import { applyTheme, choiceLabel, getChoice } from "../theme.js";

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
    h("section", { class: "card stack" }, [
      h("h2", {}, "Backup"),
      h("p", { class: "hint" }, "The file is readable JSON. It is how your data moves to a new phone. Keep it private. The copy inside the app stays encrypted."),
      h("button", { type: "button", class: "btn primary", "data-testid": "export-json", onClick: exportNow }, "Export backup"),
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
    h("section", { class: "card about" }, [
      h("h2", { class: "product-name" }, ["ARAHA ", h("em", {}, "Counselor")]),
      h("p", {}, "Version 1 · Arahasoft LLC"),
      h("p", { class: "hint" }, "Free to use. No account with Arahasoft is required. A sign-in or license check can be added later without moving these tools off your device. Chats are not uploaded."),
    ]),
  );
  return { unmount: view.destroy };
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
