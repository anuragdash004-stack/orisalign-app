import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.orisalign.app",
  appName: "OrisAlign",
  webDir: "public",
  server: {
    url: "https://orisalign.com",
    androidScheme: "https",
  },
};

export default config;
