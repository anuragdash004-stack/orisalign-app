import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "OrisAlign – #1 Clear Aligners in Bhubaneswar, Odisha | OrisAlign.com",
  description: "OrisAlign offers affordable clear aligners in Bhubaneswar, Odisha. Get straighter teeth in 6 months with OrisAlign's expert dentists. Starting ₹2,499/month. Book your consultation at OrisAlign today.",
  keywords: "OrisAlign, Orisalign clear aligners, Orisalign Bhubaneswar, clear aligners Bhubaneswar, teeth aligners Odisha, invisible braces Bhubaneswar, affordable aligners Odisha, OrisAlign.com, clear aligners India, OrisAlign dental",
  icons: {
    icon: "/pattern-icon.png",
    shortcut: "/pattern-icon.png",
    apple: "/pattern-icon.png",
  },
  openGraph: {
    title: "OrisAlign – #1 Clear Aligners in Bhubaneswar, Odisha",
    description: "OrisAlign: Straighter teeth in 6 months. Affordable clear aligners starting at ₹2,499/month. Expert dentists in Bhubaneswar, Odisha.",
    url: "https://orisalign.com",
    siteName: "OrisAlign",
    images: [
      {
        url: "https://orisalign.com/smiles-collage.jpg",
        width: 1200,
        height: 630,
        alt: "OrisAlign – 500+ Smiles Transformed in Bhubaneswar",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrisAlign – Clear Aligners in Bhubaneswar, Odisha",
    description: "OrisAlign: Straighter teeth in 6 months. Starting at ₹2,499/month. Expert dentists in Odisha.",
    images: ["https://orisalign.com/smiles-collage.jpg"],
  },
  alternates: {
    canonical: "https://orisalign.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "S-zL9XClUkdL5o2Wkmk4ZIl7lqHiHhtH4AgOWUwnBOc",
  },
  other: {
    "geo.region": "IN-OR",
    "geo.placename": "Bhubaneswar, Odisha",
    "geo.position": "20.2961;85.8245",
    "ICBM": "20.2961, 85.8245",
    "DC.title": "OrisAlign – Clear Aligners Bhubaneswar",
    "DC.description": "OrisAlign provides affordable clear aligner treatment in Bhubaneswar, Odisha.",
    "rating": "General",
    "language": "English",
    "revisit-after": "7 days",
    "author": "OrisAlign Private Limited",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "viewport": "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://orisalign.com/#organization",
      "name": "OrisAlign",
      "legalName": "Orisalign Private Limited",
      "url": "https://orisalign.com",
      "logo": "https://orisalign.com/logo.png",
      "description": "OrisAlign is Bhubaneswar's #1 clear aligner brand, providing affordable invisible teeth aligners in Odisha, India.",
      "email": "hello@orisalign.com",
      "telephone": "+918069645412",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "MIG-1, 43/5, Housing Board Colony, Chandrasekharpur",
        "addressLocality": "Bhubaneswar",
        "addressRegion": "Odisha",
        "postalCode": "751016",
        "addressCountry": "IN"
      },
      "sameAs": [
        "https://www.instagram.com/orisalign",
        "https://www.facebook.com/share/1Dn6whtfiS/"
      ]
    },
    {
      "@type": "MedicalBusiness",
      "@id": "https://orisalign.com/#clinic",
      "name": "OrisAlign Dental Clinic",
      "url": "https://orisalign.com",
      "image": "https://orisalign.com/smiles-collage.jpg",
      "description": "OrisAlign provides clear aligner orthodontic treatment in Bhubaneswar, Odisha. Expert dentists, Made in India aligners, starting at ₹2,499/month.",
      "telephone": "+918069645412",
      "email": "hello@orisalign.com",
      "priceRange": "₹₹",
      "medicalSpecialty": "Dentistry",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "MIG-1, 43/5, Housing Board Colony, Chandrasekharpur",
        "addressLocality": "Bhubaneswar",
        "addressRegion": "Odisha",
        "postalCode": "751016",
        "addressCountry": "IN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "20.2961",
        "longitude": "85.8245"
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
          "opens": "10:00",
          "closes": "19:00"
        }
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "50",
        "bestRating": "5"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://orisalign.com/#website",
      "url": "https://orisalign.com",
      "name": "OrisAlign",
      "description": "OrisAlign – Clear Aligners in Bhubaneswar, Odisha",
      "publisher": { "@id": "https://orisalign.com/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://orisalign.com/?s={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" type="image/png" href="/pattern-icon.png" />
        <link rel="shortcut icon" type="image/png" href="/pattern-icon.png" />
        <link rel="apple-touch-icon" href="/pattern-icon.png" />
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
            gtag('config', 'AW-18138830467');
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
