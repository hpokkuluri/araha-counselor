export const firebaseConfig = {
  apiKey: "AIzaSyB4qpZplN8GZUZu1JkZVrvkzlNyvp39kZo",
  authDomain: "araha-counselor.firebaseapp.com",
  projectId: "araha-counselor",
  storageBucket: "araha-counselor.firebasestorage.app",
  messagingSenderId: "383246664890",
  appId: "1:383246664890:web:c9f43b507d6eaa9d292e83",
};

// Public site key only. Leave empty until App Check is turned on in the Firebase console.
export const appCheckSiteKey = "";

// Public VAPID key for web push. Leave empty until Cloud Messaging is configured.
export const fcmVapidKey = "";

export const GEMINI_MODEL = "gemini-2.5-flash";

let appPromise;

export function getFirebaseApp() {
  if (!appPromise) appPromise = start();
  return appPromise;
}

async function start() {
  const { initializeApp } = await import("firebase/app");
  const { getAuth, setPersistence, browserLocalPersistence } = await import("firebase/auth");
  const { initializeFirestore, persistentLocalCache } = await import("firebase/firestore");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });
  await maybeAppCheck(app);
  return { app, auth, db };
}

async function maybeAppCheck(app) {
  if (!appCheckSiteKey) return;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn("App Check did not start.", error);
  }
}
