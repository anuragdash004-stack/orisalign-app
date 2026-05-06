import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

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
      <head>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-44CDZK652L"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-44CDZK652L');
          `}
        </Script>

        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1407834411464438');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
