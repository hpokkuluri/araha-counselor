import { h, field, txt, toast } from "../dom.js";
import { logo } from "../logo.js";
import { createFromBackup, listAccounts, normName, signIn, signUp } from "../session.js";
import { parseBackup } from "../data.js";
import { navigate } from "../nav.js";
import { themeButton } from "../theme.js";
import { icon } from "../icons.js";

export async function mountAuth(root, { next = "/home" } = {}) {
  const accounts = await listAccounts().catch(() => []);
  let mode = accounts.length ? "in" : "up";
  const page = h("div", { class: "auth" });
  root.append(page);

  const paint = () => {
    const user = txt({
      autocomplete: "username",
      placeholder: "e.g. alex",
      "data-testid": "auth-user",
      required: true,
    });
    const pass = txt({
      type: "password",
      autocomplete: mode === "up" ? "new-password" : "current-password",
      placeholder: "At least 8 characters",
      "data-testid": "auth-pass",
      required: true,
    });
    const confirm = txt({
      type: "password",
      autocomplete: "new-password",
      placeholder: "Repeat the password",
      "data-testid": "auth-confirm",
    });
    const error = h("p", { class: "form-error", hidden: true });
    const form = h("form", { class: "card auth-card", "data-testid": mode === "up" ? "signup-form" : "login-form" }, [
      h("div", { class: "seg", role: "tablist" }, [
        h("button", { type: "button", class: mode === "in" ? "on" : "", onClick: () => { mode = "in"; paint(); } }, "Sign in"),
        h("button", { type: "button", class: mode === "up" ? "on" : "", onClick: () => { mode = "up"; paint(); } }, "Create account"),
      ]),
      field("Profile name", user, "Only on this device. It is not sent anywhere."),
      field("Password", pass, mode === "up" ? "Locks your data on this device. It cannot be recovered if you forget it." : "The password unlocks the copy stored on this device."),
      mode === "up" ? field("Confirm password", confirm) : null,
      error,
      h("button", { class: "btn gold wide", type: "submit", "data-testid": "auth-submit" }, [
        mode === "up" ? "Create account" : "Sign in",
        icon("chevron"),
      ]),
    ]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        if (mode === "up") {
          if (pass.value !== confirm.value) throw new Error("Those passwords don't match.");
          await signUp(user.value, pass.value);
        } else {
          await signIn(user.value, pass.value);
        }
        navigate(next);
      } catch (err) {
        error.hidden = false;
        error.textContent = err.message || "Couldn't open that profile.";
        button.disabled = false;
      }
    });

    const accountList = accounts.length ? h("div", { class: "stack" }, [
      h("h2", { class: "sec-h" }, "On this device"),
      ...accounts.map((account) => h("button", {
        type: "button",
        class: "card account-btn",
        onClick: () => { user.value = account.username; pass.focus(); },
      }, [
        h("b", {}, account.username),
        h("small", {}, "Tap, then enter the password"),
      ])),
    ]) : null;

    page.replaceChildren(
      h("div", { class: "auth-tools" }, themeButton()),
      h("section", { class: "auth-hero" }, [
        h("div", { class: "brand-mark" }, logo()),
        h("div", { class: "wordmark" }, ["ARAHASOFT", h("sup", {}, "™")]),
        h("h1", { class: "display" }, ["ARAHA ", h("em", {}, "Counselor")]),
        h("p", { class: "tag" }, "A private counselor for high school. Your profile, plans, and chats stay on this device."),
      ]),
      h("div", { class: "auth-body" }, [
        form,
        accountList,
        restoreCard(),
      ]),
    );
  };

  const restoreCard = () => {
    const file = h("input", { type: "file", accept: "application/json,.json", "data-testid": "restore-file" });
    const name = txt({ placeholder: "Profile name", "data-testid": "restore-name" });
    const pass = txt({ type: "password", placeholder: "New password for this device", "data-testid": "restore-pass" });
    const box = h("div", { hidden: true });
    let backup = null;
    file.addEventListener("change", async () => {
      const chosen = file.files?.[0];
      if (!chosen) return;
      try {
        if (chosen.size > 15_000_000) throw new Error("That backup is too large.");
        backup = parseBackup(await chosen.text());
        name.value = backup.username;
        box.hidden = false;
      } catch (error) {
        toast(error.message);
        box.hidden = true;
      }
    });
    const form = h("form", {}, [
      field("Profile name", name),
      field("Password for this device", pass),
      h("button", { class: "btn primary wide", type: "submit" }, "Restore backup"),
    ]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!backup) return;
      try {
        await createFromBackup(name.value, pass.value, backup.data);
        navigate("/home");
      } catch (error) {
        toast(error.message);
      }
    });
    box.append(form);
    return h("section", { class: "card" }, [
      h("h2", {}, "Restore a backup"),
      h("p", { class: "hint" }, "Choose a JSON backup from another phone. You'll set a new password for this device."),
      file,
      box,
    ]);
  };

  paint();
  return { unmount() {} };
}

export function prefillName(name) {
  return normName(name);
}
