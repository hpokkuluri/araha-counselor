import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { session } from "../session.js";
import { navigate } from "../nav.js";

export function mountCareers(root) {
  const view = shell(root, { title: "Careers", tab: "plan", back: "/plan" });
  view.content.append(h("p", { class: "lede" }, "Jot careers you want to understand. Ask your counselor how a path lines up with your classes."));
  mountCollection(view.content, {
    empty: "No careers yet. Add one you want to explore, such as a job title you have heard about.",
    addLabel: "Add a career",
    required: "title",
    getItems: () => session.data.careers,
    list: (data) => data.careers,
    blank: () => ({ title: "", fit: "", notes: "" }),
    footer: (item) => item.title ? h("button", {
      type: "button",
      class: "btn ghost",
      onClick: () => navigate(`/chat?draft=${encodeURIComponent(`Help me understand the career "${item.title}" using my classes and interests. Ask me questions before you suggest a path.`)}`),
    }, "Discuss with counselor") : null,
    fields: [
      { key: "title", label: "Career", placeholder: "e.g. mechanical engineer" },
      { key: "fit", label: "Why it interests you", type: "textarea", placeholder: "e.g. I like building things and physics" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Questions you still have" },
    ],
  });
  return { unmount: view.destroy };
}
