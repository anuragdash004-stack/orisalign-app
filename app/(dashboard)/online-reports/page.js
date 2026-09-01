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
  new_submission: { bg: "#D7EFEB", color: "#0F5F58" },
  report_ready: { bg: "#dbeafe", color: "#1d4ed8" },
  impression_interested: { bg: "#ede9fe", color: "#6d28d9" },
  ready_to_pay_impression: { bg: "#fce7f3", color: "#be185d" },
  impression_paid: { bg: "#dcfce7", color: "#16a34a" },
  impression_taken: { bg: "#dcfce7", color: "#16a34a" },
  plan_paid: { bg: "#dcfce7", color: "#15803d" },
  treatment_started: { bg: "#052e16", color: "#bbf7d0" },
};

// Three sections:
//  - Unpaid Leads: Step 1 completed (or in progress) but payment never went through.
//  - Paid Leads: payment received, waiting on the reviewer to submit a report.
//  - Completed: report has been reviewed and delivered — status has moved
//    past "new_submission", whatever stage it's advanced to since (impression,
//    plan, treatment...) still counts as "report dispatched" for this grouping.
function categorize(report) {
  if (report.status !== "new_submission") return "completed";
  if (report.payment_status === "paid" || report.payment_status === "free_coupon") return "paid";
  return "unpaid";
}

const SECTIONS = [
  { key: "unpaid", label: "Unpaid Leads", empty: "No unpaid leads." },
  { key: "paid", label: "Paid Leads", empty: "No paid leads awaiting a report." },
  { key: "completed", label: "Completed (Report Dispatched)", empty: "No completed reports yet." },
];

export default function OnlineReportsListPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("online_reports")
        .select("id, full_name, patient_phone, status, payment_status, created_at, payment_amount")
        .order("created_at", { ascending: false });
      if (error) console.error("Error loading online reports:", error);
      setReports(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>Loading…</div>;

  const grouped = { unpaid: [], paid: [], completed: [] };
  for (const r of reports) grouped[categorize(r)].push(r);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>Online Smile Reports</h1>
        <p style={{ fontSize: 14, color: "var(--admin-ink2, #837a66)", margin: "4px 0 0" }}>
          {reports.length} submission{reports.length === 1 ? "" : "s"} total.
        </p>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        {SECTIONS.map((s) => {
          const rows = grouped[s.key];
          return (
            <div key={s.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>{s.label}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-ink2, #837a66)", background: "var(--admin-gold-wash, #f3f0e6)", borderRadius: 99, padding: "2px 10px" }}>{rows.length}</span>
                <div style={{ flex: 1, height: 1, background: "#eee" }} />
              </div>
              {rows.length === 0 ? (
                <div style={{ padding: 14, background: "white", border: "1px dashed var(--admin-line, #e9e1d0)", borderRadius: 12, textAlign: "center", color: "var(--admin-ink2, #837a66)", fontSize: 13 }}>
                  {s.empty}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {rows.map((r) => {
                    const c = STATUS_COLORS[r.status] || { bg: "var(--admin-gold-wash, #f3f0e6)", color: "var(--admin-ink2, #837a66)" };
                    return (
                      <Link
                        key={r.id}
                        href={`/online-reports/${r.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "white", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: 12, padding: "14px 18px", textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                      >
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--admin-ink, #1b2a4a)" }}>{r.full_name}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--admin-ink2, #837a66)" }}>{r.patient_phone || "—"} · ₹{r.payment_amount ?? 0}</p>
                        </div>
                        <span style={{ padding: "4px 12px", borderRadius: 99, background: c.bg, color: c.color, fontSize: 11, fontWeight: 700 }}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--admin-ink2, #837a66)" }}>
                          {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
