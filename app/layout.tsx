import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrisAlign – Clear Aligners in Bhubaneswar | Starting ₹2,499/month",
  description: "Get straighter teeth in 6 months with OrisAlign clear aligners. Designed by Dr. Anurag Dash in Bhubaneswar. Nearly invisible, Made in India, starting at ₹2,499/month. Book your free consultation today.",
  keywords: "clear aligners Bhubaneswar, teeth aligners Odisha, OrisAlign, invisible braces Bhubaneswar, affordable aligners India, Dr Anurag Dash dentist",
  openGraph: {
    title: "OrisAlign – Clear Aligners in Bhubaneswar",
    description: "Straighter teeth in 6 months. Clear aligners starting at ₹2,499/month. Free consultation with Dr. Anurag Dash, Bhubaneswar.",
    url: "https://orisalign.com",
    siteName: "OrisAlign",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrisAlign – Clear Aligners in Bhubaneswar",
    description: "Straighter teeth in 6 months. Starting at ₹2,499/month. Free consultation.",
  },
  alternates: {
    canonical: "https://orisalign.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
