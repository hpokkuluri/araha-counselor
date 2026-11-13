# Changelog

## 2.1.0

- Email and password sign-in with Firebase Auth, Firestore sync, and Gemini (`gemini-2.5-flash`) as the default counselor. The on-device model is optional.
- Essay interest topics, labeled sample essays, guided questions, and starter drafts from the student's answers.
- Test prep for PSAT/NMSQT, PSAT 10, SAT, ACT, and three AP courses, generated in the published timing.
- Parent link codes, weekly reminder workflow, and Home Screen hint on iPhone.
- `public/CNAME` is `counselor.arahasoft.com` because that name already resolves to GitHub Pages.

## 2.0.0

ARAHA Counselor 2.0 keeps every 1.0 profile. Backup format is still version 1, so an older export still imports.

- On-device speech: Whisper Tiny English runs in the browser after a public model download. Recordings are not uploaded. The speech model is disposed after each transcription. This was not tested on iPhone hardware.
- College Scorecard snapshot (institution file dated 2026-11-02) and NCES CCD public-school directory (preliminary 2024-25). Lookup stays on the device after the packaged file loads. It does not send the student profile. It does not visit college websites or fill deadlines.
- Preparation sequences, catch-up milestones, and an application brief built from entered profile, essay, and recommendation data.
- Essay outline and optional edits still come from the on-device counselor model. Study can ask that model for original quizzes and flashcards.
- App version is 2.0.0 in the package, the update line, Settings, the PDF footer, and the page title. A service-worker refresh swaps the app shell only. It does not delete IndexedDB profiles or WebLLM model caches.
- Experimental Gemma 2 2B (`gemma-2-2b-it-q4f16_1-MLC-1k`) can be chosen. It is not the default. The 4096-token Gemma build is not offered.

## 1.0.0

First public release: local accounts, counselor, essays, study, parent PIN, PDF, and on-device WebLLM.
