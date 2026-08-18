"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const STATUS_LABELS = {
  new_submission: "New Submission",
  report_ready: "Report Ready",
  impression_interested: "Impression Interested",
  ready_to_pay_impression: "Ready to Pay (Impression)",
  impression_paid: "Impression Paid",
  impression_taken: "Impression Taken",
  plan_paid: "Plan Paid",
  treatment_started: "Treatment Started",
};

const STATUS_COLORS = {
  new_submission: { bg: "#fef3c7", color: "#92400e" },
  report_ready: { bg: "#dbeafe", color: "#1d4ed8" },
  impression_interested: { bg: "#ede9fe", color: "#6d28d9" },
  ready_to_pay_impression: { bg: "#fce7f3", color: "#be185d" },
  impression_paid: { bg: "#dcfce7", color: "#16a34a" },
  impression_taken: { bg: "#dcfce7", color: "#16a34a" },
  plan_paid: { bg: "#dcfce7", color: "#15803d" },
  treatment_started: { bg: "#052e16", color: "#bbf7d0" },
};

export default function OnlineReportsListPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("online_reports")
        .select("id, full_name, patient_phone, status, created_at, payment_amount")
        .order("created_at", { ascending: false });
      if (error) console.error("Error loading online reports:", error);
      setReports(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: 0 }}>Online Smile Reports</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          {reports.length} submission{reports.length === 1 ? "" : "s"}, newest first.
        </p>
      </div>

      {reports.length === 0 ? (
        <div style={{ padding: "40px 24px", background: "white", borderRadius: 12, border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>
          No submissions yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.map((r) => {
            const c = STATUS_COLORS[r.status] || { bg: "#f3f4f6", color: "#6b7280" };
            return (
              <Link
                key={r.id}
                href={`/online-reports/${r.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{r.full_name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{r.patient_phone || "—"} · ₹{r.payment_amount ?? 0}</p>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 99, background: c.bg, color: c.color, fontSize: 11, fontWeight: 700 }}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
