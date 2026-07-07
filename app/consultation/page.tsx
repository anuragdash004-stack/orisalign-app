import type { Metadata } from "next";
import ConsultationClient from "./ConsultationClient";

export const metadata: Metadata = {
  title: "Book Your Consultation | OrisAlign Clear Aligners",
  description:
    "Choose your OrisAlign consultation — Basic (₹199) or Full (₹999) — then pick your treatment path. Transparent pricing, expert dentists, aligners made in India.",
  alternates: {
    canonical: "https://orisalign.com/consultation",
  },
  openGraph: {
    title: "Book Your Consultation | OrisAlign",
    description:
      "Choose your OrisAlign consultation and treatment path with transparent, upfront pricing.",
    url: "https://orisalign.com/consultation",
    siteName: "OrisAlign",
    locale: "en_IN",
    type: "website",
  },
};

export default function ConsultationPage() {
  return <ConsultationClient />;
}
