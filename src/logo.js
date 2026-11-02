/** Interview Edge / Arahasoft mark. Keep the splash copy in index.html in sync. */
const MARK = `
<svg viewBox="0 0 64 64" aria-hidden="true">
  <polygon class="mark-h" points="27.0,32.0 21.0,42.4 9.0,42.4 3.0,32.0 9.0,21.6 21.0,21.6"></polygon>
  <polygon class="mark-h" points="48.0,20.0 42.0,30.4 30.0,30.4 24.0,20.0 30.0,9.6 42.0,9.6"></polygon>
  <polygon class="mark-h" points="48.0,44.0 42.0,54.4 30.0,54.4 24.0,44.0 30.0,33.6 42.0,33.6"></polygon>
  <text class="mark-t" x="15" y="37" font-size="13">a</text>
  <text class="mark-t" x="36" y="25" font-size="12">ra</text>
  <text class="mark-t" x="36" y="49" font-size="12">ha</text>
</svg>`;

export function logo(className = "logo") {
  const holder = document.createElement("span");
  holder.innerHTML = MARK;
  const svg = holder.firstElementChild;
  svg.setAttribute("class", className);
  return svg;
}
