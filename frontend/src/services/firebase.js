import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import linkedProject from './firebase-web.json';

const env = import.meta.env;
const override = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Keep overrides together so a second project's settings never mix with the linked app.
const config = Object.values(override).some((value) => value !== undefined) ? override : linkedProject;
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let db = null;
let auth = null;
if (isFirebaseConfigured) {
  const app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
}
export { db };

let pendingSignIn;

/** Signs in anonymously (once per browser) and returns the user's uid. */
export async function ensureUid() {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  pendingSignIn ??= signInAnonymously(auth).finally(() => { pendingSignIn = undefined; });
  return (await pendingSignIn).user.uid;
}
