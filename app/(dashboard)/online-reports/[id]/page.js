"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const CONDITION_LABELS = {
  none: "None",
  blood_pressure: "Blood pressure",
  sugar_diabetes: "Sugar / Diabetes",
  vitamin_deficiency: "Vitamin deficiency",
  recent_surgery: "Recent surgery (within 6 months to 1 year)",
  asthma: "Asthma",
  pregnancy: "Pregnancy",
  bone_defect: "Any bone defect",
};

const label = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" };
const input = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", background: "white", color: "#111827", boxSizing: "border-box" };
const cardStyle = { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

export default function OnlineReportDetailPage() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [simulatedPlanUrl, setSimulatedPlanUrl] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState([]);
  const [addingPhoto, setAddingPhoto] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("online_reports").select("*").eq("id", id).single();
    setReport(data);
    if (data) {
      setEstimatedDuration(data.estimated_duration || "");
      setReviewerNotes(data.reviewer_notes || "");
      setSimulatedPlanUrl(data.simulated_plan_url || "");
      setReviewerId(data.reviewer_id || "");
      setAdditionalPhotos(data.additional_photo_urls || []);
    }
    const { data: revs } = await supabase.from("report_reviewers").select("*").eq("active", true);
    setReviewers(revs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const uploadAdditionalPhoto = async (file) => {
    if (!file) return;
    setAddingPhoto(true);
    const path = `${id}/additional_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("online-report-photos").upload(path, file, { upsert: true });
    if (error) { alert("Upload failed: " + error.message); setAddingPhoto(false); return; }
    const { data } = supabase.storage.from("online-report-photos").getPublicUrl(path);
    setAdditionalPhotos((p) => [...p, data.publicUrl]);
    setAddingPhoto(false);
  };

  const submitReport = async () => {
    if (!reviewerId) { alert("Please select the reviewer before submitting."); return; }
    setSubmitting(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("online_reports")
        .update({
          status: "report_ready",
          estimated_duration: estimatedDuration || null,
          reviewer_notes: reviewerNotes || null,
          simulated_plan_url: simulatedPlanUrl || null,
          reviewer_id: reviewerId,
          additional_photo_urls: additionalPhotos,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);

      const res = await fetch("/api/online-report/notify-report-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice("Report saved, but the patient notification failed to send: " + (data.error || "unknown error"));
      } else {
        setNotice("Report submitted and patient notified.");
      }
      await load();
    } catch (err) {
      alert("Failed to submit report: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markReadyToPayImpression = async () => {
    setStatusBusy(true);
    const { error } = await supabase.from("online_reports").update({ status: "ready_to_pay_impression", updated_at: new Date().toISOString() }).eq("id", id);
    setStatusBusy(false);
    if (error) { alert("Failed: " + error.message); return; }
    await load();
  };

  const markImpressionTaken = async () => {
    setStatusBusy(true);
    const { error } = await supabase.from("online_reports").update({ status: "impression_taken", updated_at: new Date().toISOString() }).eq("id", id);
    setStatusBusy(false);
    if (error) { alert("Failed: " + error.message); return; }
    await load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading…</div>;
  if (!report) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>Report not found.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{report.full_name}</h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Status: <strong>{report.status}</strong></p>

      {notice && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>{notice}</div>
      )}

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#111827" }}>Patient Info</h3>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Age:</strong> {report.age ?? "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Gender:</strong> {report.sex || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Phone:</strong> {report.patient_phone || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Email:</strong> {report.patient_email || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}>
          <strong>Amount Paid:</strong> ₹{report.payment_amount ?? 0} ({report.payment_status}{report.coupon_code ? `, coupon: ${report.coupon_code}` : ""})
        </p>

        <h4 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Existing Conditions</h4>
        <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
          {Object.entries(report.conditions || {})
            .filter(([k, v]) => k !== "other" && v)
            .map(([k]) => CONDITION_LABELS[k] || k)
            .concat(report.conditions?.other ? [`Other: ${report.conditions.other}`] : [])
            .join(", ") || "None reported"}
        </p>

        <h4 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Dental Self-Assessment</h4>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Known cavities:</strong> {report.known_cavities || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Food lodgement:</strong> {report.food_lodgement || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}><strong>Tooth mobility:</strong> {report.tooth_mobility || "—"}</p>
        <p style={{ fontSize: 13, color: "#374151", margin: 0 }}><strong>Other concerns:</strong> {report.other_concerns || "—"}</p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#111827" }}>Uploaded Photos</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {(report.photo_urls || []).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
            </a>
          ))}
          {(report.photo_urls || []).length === 0 && <p style={{ fontSize: 13, color: "#9ca3af" }}>No photos.</p>}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#111827" }}>Reviewer Form</h3>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Estimated Treatment Duration</span>
          <input style={input} placeholder="e.g. 6-9 months" value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Notes / Reason for Investigation / Additional Information</span>
          <textarea style={{ ...input, minHeight: 90 }} value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Simulated Plan Link (external URL)</span>
          <input style={input} placeholder="https://..." value={simulatedPlanUrl} onChange={(e) => setSimulatedPlanUrl(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Additional Reference Photos</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {additionalPhotos.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }} />
            ))}
          </div>
          <label style={{ fontSize: 12, color: "#b8905a", fontWeight: 700, cursor: "pointer" }}>
            {addingPhoto ? "Uploading…" : "+ Add photo"}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={addingPhoto} onChange={(e) => uploadAdditionalPhoto(e.target.files?.[0])} />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={label}>Reviewer</span>
          <select style={input} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">Select reviewer…</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>{r.name} — {r.designation}</option>
            ))}
          </select>
        </div>

        <button
          onClick={submitReport}
          disabled={submitting}
          style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#b8905a", color: "white", fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer" }}
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#111827" }}>Impression Status</h3>
        {report.status === "impression_interested" && (
          <button onClick={markReadyToPayImpression} disabled={statusBusy} style={statusBtn}>Mark Ready to Pay ₹999 (Impression)</button>
        )}
        {report.status === "impression_paid" && (
          <button onClick={markImpressionTaken} disabled={statusBusy} style={statusBtn}>Mark Impression Taken</button>
        )}
        {!["impression_interested", "impression_paid"].includes(report.status) && (
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No action available at this stage.</p>
        )}
      </div>
    </div>
  );
}

const statusBtn = { padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" };
