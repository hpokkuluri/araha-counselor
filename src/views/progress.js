import { h, toast, downloadBlob, copyText } from "../dom.js";
import { shell } from "../shell.js";
import { session, update } from "../session.js";
import { navigate } from "../nav.js";
import { icon } from "../icons.js";
import { buildMailto, emailSubject, letterBody, parentEmails, progressSummary } from "../summary.js";
import { buildPdf, sharePdfFile } from "../pdf.js";

export function mountProgress(root) {
  const view = shell(root, { title: "Progress", tab: "more", back: "/home" });
  view.content.append(
    h("h1", { class: "display small" }, ["Share ", h("em", {}, "progress")]),
    h("p", { class: "lede" }, "Write a short note, then email both parents from your own mail app. The progress summary is added under your note. Nothing is sent by Arahasoft."),
  );
  attachProgressTools(view.content);
  return { unmount: view.destroy };
}

export function attachProgressTools(parent) {
  const note = h("textarea", {
    class: "txt",
    rows: 3,
    "data-testid": "parent-note",
    placeholder: "e.g. Hi, here is what I have been working on this month.",
  });
  note.value = session.data.shareNote || "";
  const toLine = h("p", { class: "hint", "data-testid": "email-to" });
  const subjectLine = h("p", { class: "hint" });
  const preview = h("pre", { class: "letter", "data-testid": "summary" });
  const warn = h("p", { class: "form-error", hidden: true }, "This letter is long. Some mail apps trim it. Share the PDF if you want the full report attached.");
  const mail = h("a", { class: "btn gold wide", "data-testid": "email-parents" }, ["Email my parents", icon("chevron")]);
  const share = h("button", { type: "button", class: "btn primary wide", "data-testid": "share-report" }, "Share report");
  const download = h("button", { type: "button", class: "btn ghost wide", "data-testid": "download-pdf" }, "Download PDF");

  const sync = () => {
    const summary = progressSummary(session.data);
    const subject = emailSubject(session.data);
    const emails = parentEmails(session.data);
    const built = buildMailto({ emails, subject, message: note.value, summary });
    preview.textContent = letterBody(note.value, summary);
    subjectLine.textContent = `Subject: ${subject}`;
    if (!emails.length) {
      toLine.textContent = "Add at least one parent email on your profile. Both are used when both are filled in.";
      mail.removeAttribute("href");
      mail.classList.add("is-disabled");
    } else {
      const missing = [session.data.profile.parent1Email, session.data.profile.parent2Email].filter((value) => !String(value || "").trim()).length;
      toLine.textContent = `To: ${emails.join(", ")}${missing ? " · one parent email is still blank" : ""}`;
      mail.href = built.href;
      mail.classList.remove("is-disabled");
    }
    warn.hidden = !built.tooLong;
  };

  note.addEventListener("input", () => {
    update((data) => { data.shareNote = note.value; });
    sync();
  });
  mail.addEventListener("click", (event) => {
    if (!parentEmails(session.data).length) {
      event.preventDefault();
      toast("Add a parent email in your profile first.");
      navigate("/profile");
    }
  });
  share.addEventListener("click", () => sendReport(true));
  download.addEventListener("click", () => sendReport(false));

  parent.append(h("section", { class: "card stack", "data-testid": "progress-tools" }, [
    h("label", { class: "field" }, [h("span", { class: "lbl" }, "A note to your parents"), note]),
    toLine,
    subjectLine,
    mail,
    warn,
    h("h3", {}, "Email preview"),
    preview,
    h("div", { class: "btn-row" }, [
      h("button", { type: "button", class: "btn ghost", onClick: async () => {
        const ok = await copyText(preview.textContent);
        toast(ok ? "Summary copied." : "Couldn't copy from this browser.");
      } }, "Copy text"),
      h("button", { type: "button", class: "btn ghost", onClick: () => {
        const blob = new Blob([preview.textContent], { type: "text/plain" });
        downloadBlob(blob, "araha-counselor-summary.txt");
      } }, "Download text"),
    ]),
    h("h3", {}, "PDF report"),
    h("p", { class: "hint" }, "Built on this device with the Arahasoft mark. On a phone, Share report can attach it in Mail. If sharing files isn't available, download it."),
    share,
    download,
  ]));
  sync();
}

async function sendReport(preferShare) {
  try {
    const { blob, filename } = await buildPdf(session.data);
    if (preferShare) {
      const result = await sharePdfFile(blob, filename);
      if (result === "shared") {
        toast("Share sheet opened.");
        return;
      }
      downloadBlob(blob, filename);
      toast("This browser can't attach a file from the share sheet. The PDF downloaded instead.");
      return;
    }
    downloadBlob(blob, filename);
    toast("PDF downloaded.");
  } catch (error) {
    toast(error.message || "Couldn't build the PDF.");
  }
}
