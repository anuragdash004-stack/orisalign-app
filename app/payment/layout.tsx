import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment | OrisAlign",
  description: "Complete your aligner treatment payment securely.",
  robots: { index: false, follow: false },
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
