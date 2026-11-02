let render = () => {};

export function setRenderer(fn) {
  render = fn;
}

export function navigate(path) {
  const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
  if (location.hash === next) render();
  else location.hash = next;
}

export function refresh() {
  render();
}
