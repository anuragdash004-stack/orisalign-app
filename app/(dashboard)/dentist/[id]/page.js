"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Legacy /dentist/[id] route — the real dentist workflow lives at
// /dentist/[id]/appointment. Redirect there so nothing lands on the old stub.
export default function DentistCaseRedirect() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/dentist/${id}/appointment`);
  }, [id]);

  return <p style={{ padding: "24px", color: "var(--admin-ink2, #837a66)" }}>Redirecting…</p>;
}
