import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountThread } from "../thread.js";
import { session } from "../session.js";
import { counselorSystem } from "../prompts.js";
import { quickAsks } from "../counsel.js";

export function mountChat(root, draft = "") {
  const view = shell(root, { title: "Counselor", tab: "home", back: "/home", tabs: false });
  view.content.append(h("p", { class: "crisis" }, "ARAHA is a study counselor, not a crisis service. If you need help now, tell a trusted adult or call or text 988."));
  mountThread(view.content, {
    intro: "Ask about courses, colleges, careers, or scholarships. The counselor uses your profile and will not invent facts or write your essays.",
    placeholder: "Ask your counselor",
    draft,
    starters: quickAsks(session.data.profile.grade, session.data.profile.goalChoice),
    key: "counselor",
    messages: () => session.data.counselorMessages,
    push: (data, message) => {
      data.counselorMessages.push(message);
      if (data.counselorMessages.length > 80) data.counselorMessages.splice(0, data.counselorMessages.length - 80);
    },
    clear: (data) => { data.counselorMessages = []; },
    system: () => counselorSystem(session.data),
    activity: "counselor",
    activityLabel: "Counselor chat",
    maxTokens: 700,
  });
  return { unmount: view.destroy };
}
