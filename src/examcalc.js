import { h } from "./dom.js";

const ALLOWED = /^[0-9x+\-*/^().,\s]*$/;
function compile(expr) {
  let s = String(expr || "").toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, "pi");
  const names = { sqrt: "Math.sqrt", sin: "Math.sin", cos: "Math.cos", tan: "Math.tan", asin: "Math.asin", acos: "Math.acos", atan: "Math.atan", ln: "Math.log", log: "LG", abs: "Math.abs", pi: "Math.PI", e: "Math.E" };
  const stripped = s.replace(/asin|acos|atan|sqrt|sin|cos|tan|ln|log|abs|pi|\be\b/g, "");
  if (!ALLOWED.test(stripped)) throw new Error("Unsupported input");
  s = s.replace(/asin|acos|atan|sqrt|sin|cos|tan|ln|log|abs|pi|\be\b/g, (m) => names[m]).replace(/\^/g, "**");
  s = s.replace(/(\d)(x|Math|LG|\()/g, "$1*$2").replace(/\)(\d|x|Math|LG|\()/g, ")*$1");
  const fn = new Function("x", "LG", `"use strict"; return (${s || "0"});`);
  return (x) => fn(x, Math.log10);
}

export function openCalculator() {
  const display = h("input", { type: "text", inputmode: "text", placeholder: "e.g. 3^2 + sqrt(16) or 2x+1 to graph", style: "width:100%;font-size:1.1rem;padding:10px;border-radius:10px" });
  const out = h("p", { class: "hint", style: "min-height:1.4em" }, "");
  const canvas = h("canvas", { width: 320, height: 220, style: "width:100%;max-width:420px;background:#fff;border-radius:10px;display:none" });
  const press = (t) => { display.value += t; display.focus(); };
  const keys = ["7","8","9","/","sqrt(","4","5","6","*","^","1","2","3","-","(","0",".","pi","+",")","sin(","cos(","tan(","ln(","log(","x","abs(","e"];
  const evalNow = () => {
    try {
      const f = compile(display.value);
      if (/x/.test(display.value.replace(/exp/g, ""))) { graph(f); out.textContent = `Graph of y = ${display.value}`; return; }
      canvas.style.display = "none";
      const v = f(0);
      out.textContent = Number.isFinite(v) ? `= ${+v.toPrecision(12)}` : "Not a number";
    } catch { out.textContent = "Check the expression"; }
  };
  const graph = (f) => {
    canvas.style.display = "block";
    const c = canvas.getContext("2d"); const W = canvas.width, H = canvas.height, R = 10;
    c.clearRect(0, 0, W, H); c.strokeStyle = "#ccc"; c.beginPath();
    for (let i = -R; i <= R; i++) { const px = (i + R) / (2 * R) * W; c.moveTo(px, 0); c.lineTo(px, H); const py = (i + R) / (2 * R) * H; c.moveTo(0, py); c.lineTo(W, py); }
    c.stroke(); c.strokeStyle = "#333"; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
    c.strokeStyle = "#1a5cff"; c.lineWidth = 2; c.beginPath(); let pen = false;
    for (let px = 0; px <= W; px++) { const x = (px / W) * 2 * R - R; let y; try { y = f(x); } catch { y = NaN; }
      const py = H / 2 - (y / R) * (H / 2); if (!Number.isFinite(py) || Math.abs(py) > 5 * H) { pen = false; continue; }
      if (pen) c.lineTo(px, py); else c.moveTo(px, py); pen = true; }
    c.stroke();
  };
  const pad = h("div", { style: "display:grid;grid-template-columns:repeat(5,1fr);gap:6px" }, keys.map((k) => h("button", { type: "button", class: "btn ghost", style: "padding:8px 0", onClick: () => press(k) }, k)));
  const layer = h("div", { "data-testid": "calculator", style: "position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center" },
    h("div", { class: "card stack", style: "width:100%;max-width:480px;max-height:92vh;overflow:auto;margin:0;border-radius:16px 16px 0 0" }, [
      h("h2", {}, "Calculator"),
      h("p", { class: "hint" }, "Scientific and graphing. Use x to graph (window -10 to 10)."),
      display, out, canvas, pad,
      h("div", { class: "row", style: "display:flex;gap:8px" }, [
        h("button", { type: "button", class: "btn gold", onClick: evalNow }, "="),
        h("button", { type: "button", class: "btn ghost", onClick: () => { display.value = display.value.slice(0, -1); } }, "Del"),
        h("button", { type: "button", class: "btn ghost", onClick: () => { display.value = ""; out.textContent = ""; canvas.style.display = "none"; } }, "Clear"),
        h("button", { type: "button", class: "btn ghost", onClick: () => layer.remove() }, "Close and return to test"),
      ]),
    ]));
  display.addEventListener("keydown", (e) => { if (e.key === "Enter") evalNow(); });
  document.body.append(layer);
}

export const _compile = compile;
