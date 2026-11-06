import { h, field, txt, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update, parentUnlocked } from "../session.js";
import { b64ToBytes, bytesToB64, deriveSecrets, timingEqual } from "../crypto.js";
import { gradeLabel, statusLabel } from "../format.js";
import { COURSE_STATUS } from "../data.js";
import { allUpcoming, dueLabel } from "../format.js";
import { attachProgressTools } from "./progress.js";

const PIN_ROUNDS = 80000;

export function mountParent(root) {
  const view = shell(root, { title: "Parent view", tab: "more", back: "/settings" });
  const host = h("div", { class: "stack", "data-testid": "parent-view" });
  view.content.append(host);
  const paint = () => {
    host.replaceChildren();
    if (!session.data.parentPin) host.append(setPin(paint));
    else if (!parentUnlocked()) host.append(enterPin(paint));
    else host.append(dashboard(paint));
  };
  paint();
  return { unmount: view.destroy };
}

function setPin(paint) {
  const pin = txt({ inputmode: "numeric", maxlength: "6", placeholder: "4 to 6 digits", "data-testid": "pin-new", autocomplete: "new-password" });
  const again = txt({ inputmode: "numeric", maxlength: "6", placeholder: "Repeat the PIN", "data-testid": "pin-again", autocomplete: "new-password" });
  const form = h("form", { class: "card stack" }, [
    h("h2", {}, "Set parent PIN"),
    h("p", { class: "hint" }, "First time on this phone: choose a PIN here. It only opens the parent summary on the student's device. It is not a parent login, it does not cover another child, and it does not follow you to a different phone."),
    field("PIN", pin),
    field("Confirm PIN", again),
    h("button", { class: "btn gold wide", type: "submit" }, "Save PIN"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin.value) || pin.value !== again.value) {
      toast("Use the same 4 to 6 digit PIN both times.");
      return;
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const { verifier } = await deriveSecrets(pin.value, salt, PIN_ROUNDS);
    update((data) => {
      data.parentPin = { salt: bytesToB64(salt), verifier: bytesToB64(verifier), iterations: PIN_ROUNDS };
    });
    session.parentUntil = Date.now() + 15 * 60 * 1000;
    paint();
  });
  return form;
}

function enterPin(paint) {
  const pin = txt({ inputmode: "numeric", maxlength: "6", placeholder: "Parent PIN", "data-testid": "pin-entry", autocomplete: "off" });
  const form = h("form", { class: "card stack" }, [
    h("h2", {}, "Parent PIN"),
    h("p", { class: "hint" }, "This summary is on the student's phone. The PIN keeps it from opening by accident."),
    field("PIN", pin),
    h("button", { class: "btn gold wide", type: "submit", "data-testid": "pin-submit" }, "Unlock"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (session.pinWait > Date.now()) {
      toast("Too many tries. Wait a minute and try again.");
      return;
    }
    const record = session.data.parentPin;
    const { verifier } = await deriveSecrets(pin.value, b64ToBytes(record.salt), record.iterations || PIN_ROUNDS);
    if (!timingEqual(verifier, b64ToBytes(record.verifier))) {
      session.pinFails += 1;
      if (session.pinFails >= 5) {
        session.pinWait = Date.now() + 60 * 1000;
        session.pinFails = 0;
        toast("Too many tries. Wait a minute.");
      } else toast("That PIN doesn't match.");
      return;
    }
    session.pinFails = 0;
    session.parentUntil = Date.now() + 15 * 60 * 1000;
    paint();
  });
  return form;
}

function dashboard(paint) {
  const data = session.data;
  const profile = data.profile;
  const week = Date.now() - 7 * 86400000;
  const recent = data.activity.filter((item) => new Date(item.at).getTime() >= week);
  const questions = data.subjects.reduce((sum, subject) => sum + subject.messages.filter((message) => message.role === "user").length, 0);
  const box = h("div", { class: "stack" });
  box.append(
    h("div", { class: "stats" }, [
      h("div", { class: "stat" }, [h("b", {}, String(recent.length)), h("span", {}, "Actions, 7 days")]),
      h("div", { class: "stat" }, [h("b", {}, String(data.subjects.length)), h("span", {}, "Subjects")]),
      h("div", { class: "stat" }, [h("b", {}, String(questions)), h("span", {}, "Tutor questions")]),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, profile.name.trim() || "Student"),
      h("p", {}, [gradeLabel(profile.grade), profile.school.trim(), profile.gpa.trim() && `GPA ${profile.gpa.trim()}`].filter(Boolean).join(" · ") || "Profile details are still blank."),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, "Subjects"),
      data.subjects.length ? h("ul", { class: "plain" }, data.subjects.map((subject) => h("li", {}, subject.name || "Untitled"))) : h("p", { class: "hint" }, "No subjects yet."),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, "Plan"),
      ...["9", "10", "11", "12"].map((year) => h("p", {}, `${gradeLabel(year)}: ${(data.plan[year] || []).length} courses`)),
      h("ul", { class: "plain" }, ["9", "10", "11", "12"].flatMap((year) => (data.plan[year] || []).slice(0, 3).map((course) => (
        h("li", {}, `${gradeLabel(year)} · ${course.name || "Untitled"} · ${statusLabel(COURSE_STATUS, course.status)}`)
      )))),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, "Coming up"),
      ...allUpcoming(data).slice(0, 6).map((item) => h("p", {}, `${item.title} · ${dueLabel(item.date)}`)),
      allUpcoming(data).length ? null : h("p", { class: "hint" }, "No upcoming dates."),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, "Colleges"),
      data.colleges.length ? h("ul", { class: "plain" }, data.colleges.map((college) => h("li", {}, college.name || "Untitled"))) : h("p", { class: "hint" }, "No colleges saved."),
    ]),
    h("div", { class: "btn-row" }, [
      h("button", { type: "button", class: "btn ghost", onClick: () => { session.parentUntil = 0; paint(); } }, "Lock"),
      h("button", { type: "button", class: "btn ghost danger-text", onClick: () => {
        update((record) => { record.parentPin = null; });
        session.parentUntil = 0;
        toast("Parent PIN removed.");
        paint();
      } }, "Remove PIN"),
    ]),
  );
  attachProgressTools(box);
  return box;
}
