import katex from "katex";

function escapeText(text) {
  return String(text);
}

function appendInline(parent, text) {
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) parent.append(document.createTextNode(text.slice(last, match.index)));
    if (match[2]) parent.append(el("strong", match[2]));
    else if (match[3]) parent.append(el("em", match[3]));
    else if (match[4]) parent.append(el("code", match[4]));
    last = match.index + match[0].length;
  }
  if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
}

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function appendMarkdown(parent, text) {
  const lines = escapeText(text).split("\n");
  let list = null;
  const flush = () => {
    if (list) {
      parent.append(list);
      list = null;
    }
  };
  for (const line of lines) {
    const item = /^(?:- |\* )(.*)$/.exec(line);
    if (item) {
      if (!list) list = document.createElement("ul");
      const li = document.createElement("li");
      appendInline(li, item[1]);
      list.append(li);
      continue;
    }
    flush();
    if (!line.trim()) {
      parent.append(document.createElement("br"));
      continue;
    }
    const p = document.createElement("p");
    appendInline(p, line);
    parent.append(p);
  }
  flush();
}

function mathNode(source, display) {
  const span = document.createElement(display ? "div" : "span");
  span.className = display ? "math-block" : "math-inline";
  try {
    katex.render(source, span, { throwOnError: false, displayMode: display });
  } catch {
    span.textContent = source;
  }
  return span;
}

export function renderRich(text) {
  const frag = document.createDocumentFragment();
  const source = String(text || "");
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let match;
  while ((match = re.exec(source))) {
    if (match.index > last) appendMarkdown(frag, source.slice(last, match.index));
    frag.append(mathNode((match[1] || match[2] || "").trim(), Boolean(match[1])));
    last = match.index + match[0].length;
  }
  if (last < source.length) appendMarkdown(frag, source.slice(last));
  if (!frag.childNodes.length) frag.append(document.createTextNode(source));
  return frag;
}
