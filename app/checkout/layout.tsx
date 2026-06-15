import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout | OrisAlign",
  description: "Complete your aligner treatment payment securely.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
