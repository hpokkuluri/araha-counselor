import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";

const polys = `
  <polygon points="27.0,32.0 21.0,42.4 9.0,42.4 3.0,32.0 9.0,21.6 21.0,21.6" fill="none" stroke="#E2262E" stroke-width="2"/>
  <polygon points="48.0,20.0 42.0,30.4 30.0,30.4 24.0,20.0 30.0,9.6 42.0,9.6" fill="none" stroke="#E2262E" stroke-width="2"/>
  <polygon points="48.0,44.0 42.0,54.4 30.0,54.4 24.0,44.0 30.0,33.6 42.0,33.6" fill="none" stroke="#E2262E" stroke-width="2"/>
  <text x="15" y="37" font-size="13" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-weight="700">a</text>
  <text x="36" y="25" font-size="12" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-weight="700">ra</text>
  <text x="36" y="49" font-size="12" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-weight="700">ha</text>`;

function svg(size, scale) {
  const cx = 25.5;
  const cy = 32;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0E1B3D"/>
  <g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-cx} ${-cy})">
    ${polys}
  </g>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });
const outputs = [
  ["public/icons/icon-192.png", 192, 3.15],
  ["public/icons/icon-512.png", 512, 8.4],
  ["public/icons/icon-512-maskable.png", 512, 5.6],
  ["public/icons/apple-touch-icon.png", 180, 2.9],
];
for (const [file, size, scale] of outputs) {
  const png = new Resvg(svg(size, scale), { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(file, png);
  console.log(file, png.length);
}

writeFileSync("public/favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0E1B3D"/>
  ${polys}
</svg>`);
