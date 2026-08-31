import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.orisalign.app",
  appName: "OrisAlign",
  webDir: "capacitor-web",
  server: {
    url: "https://app.orisalign.com/login",
    androidScheme: "https",
    allowNavigation: ["app.orisalign.com"],
  },
};

export default config;
