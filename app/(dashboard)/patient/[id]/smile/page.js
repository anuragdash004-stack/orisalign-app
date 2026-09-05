"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Superseded — Smile Correction now opens inline inside the main journey
// dashboard (app/(dashboard)/patient/[id]/page.js), instead of navigating
// here. This route is kept only so old reminder emails/WhatsApp messages and
// any bookmarked links still land somewhere live, rather than a stale page
// that duplicated upload logic and exposed admin-only actions (End Journey,
// Refinement) directly to patients.
export default function SmileCorrectionRedirect() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/patient/${id}`);
  }, [id, router]);

  return null;
}
