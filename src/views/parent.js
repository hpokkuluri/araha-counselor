import { h, field, txt, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update, parentUnlocked } from "../session.js";
import { b64ToBytes, bytesToB64, deriveSecrets, timingEqual } from "../crypto.js";
import { gradeLabel, statusLabel } from "../format.js";
import { COURSE_STATUS } from "../data.js";
import { allUpcoming, dueLabel } from "../format.js";
import { attachProgressTools } from "./progress.js";
import { approveParent, loadStudent, parentRequests, publishLinkCode, readLinkCode, requestParentLink } from "../cloud.js";

const PIN_ROUNDS = 80000;

export function mountParent(root) {
  const view = shell(root, { title: "Parent view", tab: "more", back: "/settings" });
  const host = h("div", { class: "stack", "data-testid": "parent-view" });
  view.content.append(familyCard(), host);
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
  const pin = txt({ inputmode: "numeric", maxlength: "6", placeholder: "4 to 6 digits", "data-testid": "pin-new", autocomplete: "new-password", "data-nocapture": "1" });
  const again = txt({ inputmode: "numeric", maxlength: "6", placeholder: "Repeat the PIN", "data-testid": "pin-again", autocomplete: "new-password", "data-nocapture": "1" });
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
  const pin = txt({ inputmode: "numeric", maxlength: "6", placeholder: "Parent PIN", "data-testid": "pin-entry", autocomplete: "off", "data-nocapture": "1" });
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

function familyCard() {
  if (!session.cloud) {
    return h("section", { class: "card stack" }, [
      h("h2", {}, "Parent accounts"),
      h("p", { class: "hint" }, "Sign in with email to link a parent. A parent sees this phone's data only after the student approves. The PIN above is still only a lock on this device."),
    ]);
  }
  const codeOut = h("p", { class: "hint" });
  const incoming = h("div", { class: "stack" });
  const parentCode = txt({ placeholder: "Student code", autocapitalize: "characters" });
  const childView = h("div", { class: "stack" });
  let lastStudent = "";
  const refresh = async () => {
    const rows = await parentRequests(session.id).catch(() => []);
    incoming.replaceChildren(...rows.filter((row) => row.status === "pending").map((row) => h("button", {
      type: "button",
      class: "btn ghost",
      onClick: async () => {
        session.approvedParents = await approveParent(session.id, row.parentUid, session.approvedParents);
        toast("Parent approved. They can read this account.");
        refresh();
      },
    }, `Approve ${row.parentEmail || row.parentUid}`)));
  };
  refresh();
  return h("section", { class: "card stack" }, [
    h("h2", {}, "Link a parent"),
    h("p", { class: "hint" }, "A code lets one parent account request access. You approve it here. They can link more than one student the same way."),
    h("button", { type: "button", class: "btn gold", onClick: async () => {
      const code = await publishLinkCode(session.id, session.data.profile.name || session.username);
      codeOut.textContent = `Give this code to a parent: ${code}`;
    } }, "Create a link code"),
    codeOut,
    h("h3", {}, "Waiting for your approval"),
    incoming,
    h("h3", {}, "I am the parent"),
    field("Student code", parentCode),
    h("button", { type: "button", class: "btn primary", onClick: async () => {
      const found = await readLinkCode(parentCode.value);
      if (!found?.studentUid) {
        toast("That code was not found.");
        return;
      }
      await requestParentLink(session.id, found.studentUid, session.username);
      const kids = session.linkedKids || [];
      kids.push({ uid: found.studentUid, name: found.name || "Student", status: "pending" });
      session.linkedKids = kids;
      const { saveCloudData } = await import("../cloud.js");
      await saveCloudData(session.id, session.data, { approvedParents: session.approvedParents || [], linkedKids: kids, email: session.username });
      lastStudent = found.studentUid;
      toast(`Request sent to ${found.name || "the student"}. They must approve it.`);
    } }, "Request access"),
    h("button", { type: "button", class: "btn ghost", onClick: async () => {
      if (!lastStudent) {
        toast("Enter a student code first.");
        return;
      }
      try {
        const child = await loadStudent(lastStudent);
        const profile = child.data?.profile || {};
        childView.replaceChildren(
          h("p", {}, `${profile.name || "Student"} · ${profile.school || "school not entered"}`),
          h("p", { class: "hint" }, profile.counselorSummary || "No counselor summary yet."),
        );
      } catch {
        toast("This student has not approved your account yet.");
      }
    } }, "Open linked student"),
    childView,
  ]);
}
