"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Superseded by /login, which WhatsApp-OTP-verifies every patient
// (this page didn't verify smile-report lookups at all) and correctly
// routes report-only patients to their report vs. booked patients to
// their journey. Kept as a redirect so old bookmarks/links still land
// somewhere live.
export default function PatientLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
