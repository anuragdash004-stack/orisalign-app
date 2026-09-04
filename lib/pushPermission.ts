// Native notification permission — the OS-level "allow OrisAlign to send you
// notifications" grant — plus registerForPush() below, which turns that
// permission into an actual FCM device token the server can send to.
import { Capacitor } from "@capacitor/core";

const ONBOARDING_SEEN_KEY = "orisalign_notif_prompt_seen";

export type NotifPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function getNotifPermission(): Promise<NotifPermissionState> {
  if (!isNativeApp()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "granted" || receive === "denied" ? receive : "prompt";
  } catch {
    return "unsupported";
  }
}

export async function requestNotifPermission(): Promise<NotifPermissionState> {
  if (!isNativeApp()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.requestPermissions();
    return receive === "granted" || receive === "denied" ? receive : "prompt";
  } catch {
    return "unsupported";
  }
}

// Turns a granted permission into an actual FCM device token, so the server
// has somewhere to send a push. Safe to call every time the app opens with
// permission already granted — it's how a stale/rotated token gets refreshed,
// and register() itself is a no-op if already registered.
export async function registerForPush(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      PushNotifications.addListener("registration", (token) => finish(token.value));
      PushNotifications.addListener("registrationError", () => finish(null));
      PushNotifications.register();
      // Don't hang the caller forever if Google Play Services is unavailable
      // and neither event ever fires.
      setTimeout(() => finish(null), 10000);
    });
  } catch {
    return null;
  }
}

// Android denies a second in-app prompt outright once the user has said no
// once — from then on the only way to change it is the system Settings app.
// This opens straight to this app's own notification settings page, which is
// the standard escape hatch every app uses for a previously-denied permission.
export async function openAppNotificationSettings(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { NativeSettings, AndroidSettings } = await import("capacitor-native-settings");
    await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
  } catch {
    // Plugin not installed — nothing sensible to fall back to on native;
    // the toggle in Settings will just re-run requestPermission() instead.
  }
}

export function hasSeenNotifOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
  } catch {
    return true; // fail closed — never nag if storage is unavailable
  }
}

export function markNotifOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {}
}
