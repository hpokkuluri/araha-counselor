import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";

const DOWNLOADS = "/tmp/ac-dl";
mkdirSync(DOWNLOADS, { recursive: true });

const BASE = "http://127.0.0.1:4173/araha-counselor/";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: DOWNLOADS,
  eventsEnabled: true,
});
page.setDefaultTimeout(20000);
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});

async function shot(name) {
  await page.evaluate(() => document.getElementById("toast")?.classList.remove("on"));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

async function saveDownload(trigger) {
  for (const file of readdirSync(DOWNLOADS)) rmSync(`${DOWNLOADS}/${file}`);
  await trigger();
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const files = readdirSync(DOWNLOADS).filter((name) => !name.endsWith(".crdownload"));
    if (files.length) return readFile(`${DOWNLOADS}/${files[0]}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Download did not finish");
}

async function skipSplash() {
  const button = await page.$("[data-testid=skip-splash]");
  if (button) await button.click();
  await page.waitForFunction(() => !document.getElementById("splash")).catch(() => {});
}

async function setTheme(choice) {
  await page.click("[data-testid=theme-toggle]");
  await page.waitForSelector(`[data-testid=theme-${choice}]`);
  await page.click(`[data-testid=theme-${choice}]`);
  const theme = choice === "light" ? "light" : choice === "dark" ? "dark" : null;
  if (theme) {
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value, {}, theme);
  }
}

try {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=splash]");
  await new Promise((r) => setTimeout(r, 2400));
  await shot("01-splash");
  await skipSplash();
  await page.waitForSelector("[data-testid=signup-form], [data-testid=login-form]");
  await shot("02-login-day");

  await setTheme("dark");
  await shot("03-login-dark");
  await setTheme("light");

  await page.click("[data-testid=auth-user]", { clickCount: 3 });
  await page.type("[data-testid=auth-user]", "alex");
  await page.type("[data-testid=auth-pass]", "correct-horse");
  await page.type("[data-testid=auth-confirm]", "correct-horse");
  await page.click("[data-testid=auth-submit]");
  await page.waitForSelector("[data-testid=tab-home]");
  await shot("04-home-day");

  await page.click("[data-testid=goto-profile]");
  await page.waitForSelector("[data-testid=profile-name]");
  await page.type("[data-testid=profile-name]", "Alex Rivera");
  await page.select("[data-testid=profile-grade]", "10");
  await page.type("[data-testid=profile-school]", "East Windsor High School");
  await page.type("[data-testid=profile-gpa]", "3.7 unweighted");
  await page.type("[data-testid=parent1-email]", "parent.one@example.com");
  await page.type("[data-testid=parent2-email]", "parent.two@example.com");
  await page.click("[data-testid=profile-save]");
  await shot("05-profile-day");

  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForSelector("[data-testid=open-chat]");

  await page.evaluate(() => { location.hash = "#/essays"; });
  await page.waitForSelector("[data-testid=essay-title]");
  await page.type("[data-testid=essay-title]", "A bridge I helped build");
  await page.click("form button[type=submit]");
  await page.waitForSelector("[data-testid=essay-draft]");
  await page.type("[data-testid=essay-brainstorm]", "I stayed after school to help repair the footbridge.");
  await page.type("[data-testid=essay-draft]", "The boards were loose, so I asked the shop teacher if I could stay and fix them.");
  await setTheme("dark");
  await shot("08-essay-dark");
  await setTheme("light");
  await shot("09-essay-day");

  await page.evaluate(() => { location.hash = "#/study"; });
  await page.waitForSelector("[data-testid=subject-name]");
  await page.type("[data-testid=subject-name]", "Geometry");
  await page.click("[data-testid=subject-add]");
  await page.waitForSelector("[data-testid=subject-notes]");
  await page.type("[data-testid=subject-notes]", "Remember the distance formula.");
  await shot("10-subject-day");
  await setTheme("dark");
  await shot("11-subject-dark");

  await page.evaluate(() => { location.hash = "#/model"; });
  await page.waitForSelector("[data-testid=model-screen] h1");
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes("can't run the model") || text.includes("Why download it") || text.includes("WebGPU");
  });
  await shot("12-model-dark");
  await setTheme("light");
  await shot("13-model-day");

  await page.evaluate(() => { location.hash = "#/deadlines"; });
  await page.waitForSelector("[data-testid=course-name], form");
  const deadlineTitle = await page.$("input[placeholder='e.g. PSAT']");
  if (deadlineTitle) {
    await deadlineTitle.type("PSAT");
    await page.evaluate(() => {
      const date = document.querySelector("input[type=date]");
      if (!date) return;
      date.value = "2026-11-12";
    });
    await page.click("form button[type=submit]");
  }

  await page.evaluate(() => { location.hash = "#/colleges"; });
  await page.waitForSelector("[data-testid=college-add]");
  const collegeInput = await page.$("form input.txt");
  await collegeInput.click({ clickCount: 3 });
  await collegeInput.type("Example State University");
  const typed = await page.evaluate(() => document.querySelector("form input.txt")?.value);
  console.log("college typed", JSON.stringify(typed));
  await page.$eval("[data-testid=college-add]", (button) => button.click());
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Remove"));
  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForSelector("[data-testid=open-chat]");
  await shot("06-home-filled-day");
  await setTheme("dark");
  await shot("07-home-dark");
  await setTheme("light");

  await page.evaluate(() => { location.hash = "#/parent"; });
  await page.waitForSelector("[data-testid=pin-new]");
  await page.type("[data-testid=pin-new]", "2468");
  await page.type("[data-testid=pin-again]", "2468");
  await page.click("form button[type=submit]");
  await page.waitForSelector("[data-testid=progress-tools]");
  await shot("14-parent-day");
  await setTheme("dark");
  await shot("15-parent-dark");

  await page.type("[data-testid=parent-note]", "Hi, here is what I worked on this month.");
  const href = await page.$eval("[data-testid=email-parents]", (node) => node.getAttribute("href") || "");
  if (!href.startsWith("mailto:parent.one@example.com,parent.two@example.com?")) {
    throw new Error(`Unexpected mailto: ${href.slice(0, 180)}`);
  }
  const decoded = decodeURIComponent(href);
  if (!decoded.includes("Hi, here is what I worked on this month.")) throw new Error("Note missing from mailto");
  if (!decoded.includes("Geometry")) throw new Error("Summary missing subject");
  if (!decoded.includes("Example State University")) throw new Error("Summary missing college");
  console.log("mailto ok", href.length);

  const pdfBytes = await saveDownload(() => page.click("[data-testid=download-pdf]"));
  if (pdfBytes.subarray(0, 4).toString() !== "%PDF") throw new Error("PDF magic missing");
  console.log("pdf bytes", pdfBytes.length);

  await page.evaluate(() => { location.hash = "#/progress"; });
  await page.waitForSelector("[data-testid=summary]");
  await shot("16-progress-dark");
  await setTheme("light");
  await shot("17-progress-day");

  await page.evaluate(() => { location.hash = "#/settings"; });
  await page.waitForSelector("[data-testid=export-json]");
  const backupBytes = await saveDownload(() => page.click("[data-testid=export-json]"));
  const backup = JSON.parse(backupBytes.toString("utf8"));
  if (backup.app !== "araha-counselor") throw new Error("backup app id");
  if (backup.data.profile.school !== "East Windsor High School") throw new Error("backup school");
  console.log("export ok");

  await page.click("[data-testid=sign-out]");
  await page.waitForSelector("[data-testid=login-form]");
  await page.type("[data-testid=auth-user]", "alex");
  await page.type("[data-testid=auth-pass]", "correct-horse");
  await page.click("[data-testid=auth-submit]");
  await page.waitForSelector("[data-testid=tab-home]");
  await page.evaluate(() => { location.hash = "#/study"; });
  await page.waitForFunction(() => document.body.innerText.includes("Geometry"));
  console.log("signed back in with saved subject");

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (await page.$("[data-testid=login-form], [data-testid=signup-form]")) {
    await skipSplash();
    await shot("20-login-laptop");
    await page.type("[data-testid=auth-user]", "alex");
    await page.type("[data-testid=auth-pass]", "correct-horse");
    await page.click("[data-testid=auth-submit]");
    await page.waitForSelector("[data-testid=tab-home]");
  }
  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForSelector("[data-testid=open-chat]");
  await shot("21-home-laptop");
  await setTheme("dark");
  await shot("22-home-laptop-dark");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await skipSplash();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForSelector("[data-testid=login-form]");
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await skipSplash();
  await page.waitForSelector("[data-testid=login-form]", { timeout: 15000 });
  await shot("18-offline-login");
  await page.type("[data-testid=auth-user]", "alex");
  await page.type("[data-testid=auth-pass]", "correct-horse");
  await page.click("[data-testid=auth-submit]");
  await page.waitForSelector("[data-testid=tab-home]", { timeout: 15000 });
  await page.evaluate(() => { location.hash = "#/study"; });
  await page.waitForFunction(() => document.body.innerText.includes("Geometry"));
  await shot("19-offline-study");
  console.log("offline sign-in kept Geometry");
  console.log("SMOKE OK");
} catch (error) {
  console.error("SMOKE FAIL", error);
  await shot("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
