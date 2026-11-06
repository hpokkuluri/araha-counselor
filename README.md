# ARAHA Counselor

ARAHA Counselor is a private, offline-first student counselor from Arahasoft. Version 1 is a static web app. It is free to run: there is no backend, no paid API, and no API key. The first profile you create lives only on that phone or computer.

A counselor chat and subject tutors can run an open-source model in the browser. Your questions are not uploaded. If the device cannot run the model, the rest of the app still works.

## Features

- Animated Arahasoft splash, then a local sign-in. Several profiles can share one device.
- Counselor home: profile, four-year course plan, colleges and majors, careers, scholarships, deadlines, and an essay coach.
- Essay coach helps brainstorm, outline, and revise. It is instructed not to write the essay.
- Subject help: add any class, keep notes, and open a tutor chat for that subject. Math renders with KaTeX.
- Parent PIN on the device, a progress summary, **Email my parents** (`mailto:` to both parent addresses, with a note the student can edit), and an on-device PDF report. Share the PDF with the Web Share API when the browser can attach files, or download it.
- Export and import a JSON backup so the data can move to a new phone.
- Installable PWA. After the first load, the app shell works offline.
- Day, Dark, and Auto themes. Dark follows the Interview Edge welcome look: deep blue glow, glass cards, gold type, and a gold primary button. The choice is saved on the device and applied before the first paint.

## Privacy

- Profiles are stored in IndexedDB. The saved record is encrypted with AES-GCM. The key is derived from the password with PBKDF2 and is kept in memory only for the session.
- Arahasoft cannot reset a forgotten password, because the password never leaves the device. Export a backup while you still know it.
- The JSON backup is readable on purpose so a new phone can import it. Store that file somewhere private.
- The parent PIN only gates the parent summary. It is not a second encrypted account.
- The on-device model is downloaded once from the public MLC / Hugging Face host (the model weights and a small WebGPU runtime). Chat text is not part of that request. After the download, WebLLM keeps the model in the browser cache.
- Email is handed to the mail app already on the device (`mailto:`). The PDF is built in the browser with jsPDF. Nothing is sent to a server by this app.

`src/entitlement.js` is the seam for a future Arahasoft sign-in or license check. Version 1 treats every local profile as allowed and does not make a network call there.

## Device requirements for the AI

The app itself runs in a current phone or laptop browser.

The counselor and tutors need WebGPU:

- Chrome or Edge on a recent computer is the most reliable place to run the model.
- Current Chrome on Android often works.
- Safari support depends on the version. Firefox often does not expose WebGPU.
- If WebGPU is missing, the model screen says so. Profile, plan, colleges, scholarships, deadlines, essays, notes, parent view, email, PDF, and backup keep working.

Model choices come from `@mlc-ai/web-llm` 0.2.87 `vram_required_MB`. They were not measured on a physical iPhone in this change.

| Model | id | GPU memory in that config | How it is chosen |
| --- | --- | --- | --- |
| Llama 3.2 1B Instruct q4f16 | `Llama-3.2-1B-Instruct-q4f16_1-MLC` | 879 MB | Automatic on a phone. About 700 MB to download. Loaded with a 2048-token cap. |
| Qwen 2.5 1.5B Instruct q4f16 | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | 1630 MB | Optional phone step up. Not automatic. |
| Qwen 2.5 3B Instruct q4f16 | `Qwen2.5-3B-Instruct-q4f16_1-MLC` | 2505 MB | Automatic on a computer. About 1.7 GB to download. |
| Qwen 2.5 7B Instruct q4f16 | `Qwen2.5-7B-Instruct-q4f16_1-MLC` | 5107 MB | Computer only, and only if you choose it. |
| Llama 3.1 8B Instruct q4f16 | `Llama-3.1-8B-Instruct-q4f16_1-MLC` | 5001 MB | Computer only, and only if you choose it. |

Gemma 2 2B (`gemma-2-2b-it-q4f16_1-MLC`) is in the same library at 1895 MB and is not marked low-resource. It also requires `shader-f16`. It is not offered. The 1024-token Gemma build is smaller but too short for counseling context.

iOS can still drop a model under memory pressure. The app asks the browser to persist storage and says so when that request is denied. A reload after a crash keeps the sign-in session and switches a model that died mid-download to the smaller one. Clearing a chat does not unload the model or delete the profile.

Sizes are the published MLC packages (weights) plus a small runtime library. A phone with tight memory should use the smaller model. The download screen can wait for Wi-Fi when the browser reports a cellular connection.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173/araha-counselor/

Production build:

```bash
npm run build
npm run preview
```

Preview is served at http://127.0.0.1:4173/araha-counselor/ and includes the service worker.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the `dist` folder to GitHub Pages on every push to `main`.

In the repository settings, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once. The site is then:

https://hpokkuluri.github.io/araha-counselor/

The Vite `base` path is `/araha-counselor/` so asset URLs match that project site.

## Custom domain later

`counselor.arahasoft.com` is the intended future address. This repo does not change DNS, and production stays on GitHub Pages until a separate release.

The Vite `base` is `/araha-counselor/` unless `VITE_BASE=/` is set. The service worker scope is `./`, so a root-domain build stays at `/` and the project site stays under `/araha-counselor/`. Do not ship both from one deploy.

When that domain is actually pointed at Pages:

1. Confirm DNS with the records GitHub Pages asks for.
2. Build with `VITE_BASE=/ npm run build`.
3. Add `public/CNAME` and the Pages custom-domain setting in that same release.

IndexedDB, the encrypted profile, and the WebLLM cache belong to the current origin. Opening a new domain starts empty. Export a JSON backup from More, then Import it there. The app cannot copy data across origins by itself.

Photo text recognition uses tesseract.js in the browser. The first run may download a public English language file from jsDelivr. The photo is not uploaded. Handwriting and math are often wrong. Voice input is off: there is no on-device speech model here, and the app does not call browser or cloud dictation.

Email my parents is a `mailto:` link. It does not attach the PDF. Share or download the PDF separately. Checklist templates are not real deadlines.

## Theme

The choice is stored in `localStorage` under `ac-theme` (`auto`, `light`, or `dark`). A small script in `index.html` applies it before CSS paints. Auto follows `prefers-color-scheme`. Day keeps the light Arahasoft app (white cards, navy text, gold call-to-action). Dark reuses the Interview Edge welcome palette: `#0E1B3D` with the royal-blue radial glow (`rgba(27,92,235,.5)` at the top right), glass cards (`rgba(255,255,255,.07)` and a light border, 16px radius), gold `#F2B33D` for numbers, the italic accent, links, and the primary button (navy text on gold). The splash screen stays on its own navy intro.

## Project layout

- `index.html` — splash (the Interview Edge logo and motion) and the theme boot script
- `src/session.js`, `src/crypto.js`, `src/db.js` — local accounts and encryption
- `src/views/` — screens
- `src/ai.js` — WebLLM download and chat, loaded only when needed
- `src/pdf.js` — on-device progress report
- `public/fonts/` — the same Manrope and Instrument Serif files used by Interview Edge

## Limits in version 1

- Reminders appear inside the app. There is no server to push a notification while the app is closed.
- The parent email opens the student's mail app. Very long letters can be trimmed by some mail apps; the PDF is the full report.
- Sharing the PDF as an attachment depends on `navigator.canShare({ files })`. Otherwise the app downloads the file.
- The on-device model is large and needs a GPU. Phones stay on the 1B model unless a larger one is explicitly chosen, and 7B/8B models are not offered on a phone.
- This copy was not run on iPhone hardware. Memory limits above are the WebLLM config, not a device measurement.
- Password recovery and cloud sync are intentionally not included.
