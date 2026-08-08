import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book OrisAlign Consultation – Clear Aligners Bhubaneswar | OrisAlign",
  description: "Book your OrisAlign clear aligner consultation in Bhubaneswar, Odisha. Home visit or clinic appointment. Consultation at just ₹199. Expert dentists, invisible aligners at ₹39,999 for a 6-month plan*.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://orisalign.com/book" },
  openGraph: {
    title: "Book OrisAlign Consultation – Bhubaneswar",
    description: "Book a consultation with OrisAlign expert dentists in Bhubaneswar. Home visit or clinic. Just ₹199.",
    url: "https://orisalign.com/book",
    siteName: "OrisAlign",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
