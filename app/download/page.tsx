import type { Metadata } from "next";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Download the OrisAlign App | OrisAlign",
  description: "Download the OrisAlign Android app directly as an APK.",
  robots: {
    index: false,
    follow: false,
  },
};

const s = { color: "#374151", fontSize: "14px", lineHeight: "1.8" };
const step = { ...s, marginBottom: "10px" };

export default function DownloadPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "40px 20px", width: "100%", flex: 1 }}>
        <BackButton />

        <div style={{ textAlign: "center", borderBottom: "2px solid #1B2A4A", paddingBottom: "24px", marginBottom: "32px" }}>
          <img src="/logo2.png" alt="OrisAlign" style={{ height: "48px", marginBottom: "16px", mixBlendMode: "multiply" }} />
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#1B2A4A", margin: "0 0 6px" }}>
            DOWNLOAD THE ORISALIGN APP
          </h1>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "6px 0 0" }}>
            Android · Version 1.1 · ~5.4 MB
          </p>
        </div>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <a
            href="/downloads/orisalign.apk"
            download
            style={{
              display: "inline-block",
              padding: "16px 40px",
              borderRadius: "10px",
              background: "#1B2A4A",
              color: "#C9A84C",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "16px",
              letterSpacing: "0.3px",
            }}
          >
            Download APK
          </a>
        </div>

        <div style={{ background: "white", borderRadius: "12px", padding: "20px 24px", border: "1px solid #e5e7eb", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#1B2A4A", marginBottom: "12px", marginTop: 0 }}>
            How to install
          </h2>
          <p style={step}>1. Tap <strong>Download APK</strong> above on your Android phone.</p>
          <p style={step}>2. Open the downloaded file from your notifications or Downloads folder.</p>
          <p style={step}>
            3. If prompted, allow your browser to <strong>install unknown apps</strong> — Android will
            show a one-time settings screen for this, since the app isn't from the Play Store yet.
          </p>
          <p style={step}>4. Tap <strong>Install</strong>, then open the app.</p>
        </div>

        <div style={{ background: "#FBF7EE", border: "1px solid #E8D5A0", borderRadius: "8px", padding: "14px 16px" }}>
          <p style={{ ...s, fontSize: "13px", fontStyle: "italic", margin: 0 }}>
            This app requires Android 7.0 or later. It isn&apos;t on the Play Store yet — installing
            it this way is safe and expected for now. All your data loads securely from
            orisalign.com, the same site you already use in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
