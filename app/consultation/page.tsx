import type { Metadata } from "next";
import ConsultationClient from "./ConsultationClient";

export const metadata: Metadata = {
  title: "Choose Your 3D Scan Type | OrisAlign Clear Aligners",
  description:
    "Choose your OrisAlign 3D scan type — 3D Consultation (₹199) or 3D Consultation + 3D Plan (₹999). Transparent pricing, expert dentists, aligners made in India.",
  alternates: {
    canonical: "https://orisalign.com/consultation",
  },
  openGraph: {
    title: "Choose Your 3D Scan Type | OrisAlign",
    description:
      "Choose your OrisAlign 3D scan type with transparent, upfront pricing.",
    url: "https://orisalign.com/consultation",
    siteName: "OrisAlign",
    locale: "en_IN",
    type: "website",
  },
};

export default function ConsultationPage() {
  return <ConsultationClient />;
}
