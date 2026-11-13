import { h, field, txt, toast } from "../dom.js";
import { createFromBackup, normName, signInEmail, signUpEmail } from "../session.js";
import { resetPassword } from "../cloud.js";
import { parseBackup } from "../data.js";
import { navigate } from "../nav.js";
import { themeButton } from "../theme.js";
import { icon } from "../icons.js";
import { brandName, companyRow } from "../brand.js";

export async function mountAuth(root, { next = "/home" } = {}) {
  let mode = "in";
  const page = h("div", { class: "auth" });
  root.append(page);

  const paint = () => {
    const user = txt({
      type: "email",
      autocomplete: "email",
      placeholder: "you@email.com",
      "data-testid": "auth-user",
      "data-nocapture": "1",
      required: true,
    });
    const pass = txt({
      type: "password",
      autocomplete: mode === "up" ? "new-password" : "current-password",
      placeholder: "At least 8 characters",
      "data-testid": "auth-pass",
      "data-nocapture": "1",
      required: true,
    });
    const confirm = txt({
      type: "password",
      autocomplete: "new-password",
      placeholder: "Repeat the password",
      "data-testid": "auth-confirm",
      "data-nocapture": "1",
    });
    const error = h("p", { class: "form-error", hidden: true });
    const form = h("form", { class: "card auth-card", "data-testid": mode === "up" ? "signup-form" : "login-form" }, [
      h("div", { class: "seg", role: "tablist" }, [
        h("button", { type: "button", class: mode === "in" ? "on" : "", onClick: () => { mode = "in"; paint(); } }, "Sign in"),
        h("button", { type: "button", class: mode === "up" ? "on" : "", onClick: () => { mode = "up"; paint(); } }, "Create account"),
        h("button", { type: "button", class: mode === "reset" ? "on" : "", onClick: () => { mode = "reset"; paint(); } }, "Reset"),
      ]),
      field("Email", user, "This signs you in on the web. Your profile syncs between phone and computer."),
      mode === "reset" ? null : field("Password", pass, mode === "up" ? "At least 8 characters. You can reset it by email." : "The password for this email."),
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
        if (mode === "reset") {
          await resetPassword(user.value);
          toast("If that email has an account, a reset link is on its way.");
          mode = "in";
          paint();
          return;
        }
        if (mode === "up") {
          if (pass.value !== confirm.value) throw new Error("Those passwords don't match.");
          if (pass.value.length < 8) throw new Error("Use at least 8 characters.");
          await signUpEmail(user.value, pass.value);
        } else {
          await signInEmail(user.value, pass.value);
        }
        navigate(next);
      } catch (err) {
        error.hidden = false;
        error.textContent = err.message || "Couldn't open that profile.";
        button.disabled = false;
      }
    });

    page.replaceChildren(
      h("div", { class: "auth-tools" }, themeButton()),
      h("section", { class: "auth-hero" }, [
        companyRow(),
        brandName("lg"),
        h("p", { class: "tag" }, "A counselor for any high school student. Sign in with email so your profile follows you. Chats go to Gemini in Google Cloud, not to a public page."),
      ]),
      h("div", { class: "auth-body" }, [
        form,
        restoreCard(),
      ]),
    );
  };

  const restoreCard = () => {
    const file = h("input", { type: "file", accept: "application/json,.json", "data-testid": "restore-file" });
    const name = txt({ placeholder: "Profile name", "data-testid": "restore-name", "data-nocapture": "1" });
    const pass = txt({ type: "password", placeholder: "New password for this device", "data-testid": "restore-pass", "data-nocapture": "1" });
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
      h("p", { class: "hint" }, "A JSON backup still restores a local copy. After you sign in with email, import that device profile from More so it moves into your cloud account."),
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
