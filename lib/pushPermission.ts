// Native notification permission — the OS-level "allow OrisAlign to send you
// notifications" grant, not the actual sending of push notifications. That
// second half needs Firebase Cloud Messaging configured (google-services.json
// + a service-account key), which isn't in place yet; this file exists so the
// permission prompt and the in-app settings toggle work today, and the send
// side can be added later without touching this.
//
// Deliberately calls only requestPermissions()/checkPermissions() — never
// register(). register() is what initializes Firebase Cloud Messaging on
// Android, and without google-services.json present that would throw. The
// permission APIs are plain Android runtime-permission calls and don't touch
// Firebase at all.
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
