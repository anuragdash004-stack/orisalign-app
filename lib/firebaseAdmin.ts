import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // .env files can't hold real newlines inside a quoted value, so the key is
  // stored with literal "\n" escapes and unescaped here.
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

// Sends one push notification to one device token. Firebase auto-drops
// tokens that are no longer valid (app uninstalled, etc.) — callers should
// clear the token from Supabase when this throws a
// "registration-token-not-registered" error.
export async function sendPushToToken(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  return getMessaging().send({
    token,
    notification: { title, body },
    data,
    android: { priority: "high" },
  });
}
