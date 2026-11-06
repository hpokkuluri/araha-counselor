export function keyboardInset(layoutHeight, visualHeight, offsetTop = 0) {
  const raw = Number(layoutHeight) - Number(visualHeight) - Number(offsetTop || 0);
  if (!Number.isFinite(raw) || raw < 80) return 0;
  return Math.round(Math.min(raw, 480));
}

export function bindKeyboardInset(win = globalThis, doc = globalThis.document) {
  if (!win || !doc?.documentElement) return () => {};
  const apply = () => {
    const viewport = win.visualViewport;
    const inset = viewport
      ? keyboardInset(win.innerHeight, viewport.height, viewport.offsetTop)
      : 0;
    doc.documentElement.style.setProperty("--kb", `${inset}px`);
  };
  apply();
  win.visualViewport?.addEventListener("resize", apply);
  win.visualViewport?.addEventListener("scroll", apply);
  return () => {
    win.visualViewport?.removeEventListener("resize", apply);
    win.visualViewport?.removeEventListener("scroll", apply);
  };
}
