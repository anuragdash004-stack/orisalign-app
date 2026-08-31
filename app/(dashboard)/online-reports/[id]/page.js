"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const PHOTO_SLOT_LABELS = {
  front_bite: "Front Bite",
  upper_arch: "Upper Arch",
  lower_arch: "Lower Arch",
  left_buccal: "Left Side Bite",
  right_buccal: "Right Side Bite",
};

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

const label = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--admin-ink2, #837a66)", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" };
const input = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--admin-line, #e9e1d0)", fontSize: 14, outline: "none", background: "white", color: "var(--admin-ink, #1b2a4a)", boxSizing: "border-box" };
const cardStyle = { background: "white", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

export default function OnlineReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [caseSeverity, setCaseSeverity] = useState("");
  const [dentalConcernsText, setDentalConcernsText] = useState("");
  const [objectivesText, setObjectivesText] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [simulatedPlanUrl, setSimulatedPlanUrl] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState([]);
  const [addingPhoto, setAddingPhoto] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Per-photo review UI
  const [reviewingSlot, setReviewingSlot] = useState(null);
  const [rejectingSlot, setRejectingSlot] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Request More Info
  const [infoQuestion, setInfoQuestion] = useState("");
  const [sendingInfo, setSendingInfo] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("online_reports").select("*").eq("id", id).single();
    setReport(data);
    if (data) {
      setCaseSeverity(data.case_severity || "");
      setDentalConcernsText((data.dental_concerns || []).join("\n"));
      setObjectivesText((data.objectives || []).join("\n"));
      setEstimatedDuration(data.estimated_duration || "");
      setReviewerNotes(data.reviewer_notes || "");
      setSimulatedPlanUrl(data.simulated_plan_url || "");
      setDoctorId(data.doctor_id || "");
      setAdditionalPhotos(data.additional_photo_urls || []);
    }
    const { data: docs } = await supabase.from("doctors").select("*").eq("active", true).order("name");
    setDoctors(docs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const checkRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
      setIsAdmin(data?.role === "admin");
    };
    checkRole();
  }, []);

  const deleteReport = async () => {
    if (!window.confirm(`Permanently delete ${report.full_name}'s Online Smile Report? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/online-report/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      setDeleting(false);
      if (!json.success) { alert("Failed to delete: " + (json.error || "Unknown error")); return; }
      router.push("/online-reports");
    } catch {
      setDeleting(false);
      alert("Network error. Please try again.");
    }
  };

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

  const reviewPhoto = async (slotKey, status, reason) => {
    setReviewingSlot(slotKey);
    try {
      const res = await fetch("/api/online-report/review-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, slotKey, status, reason }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Failed to save review: " + (data.error || "unknown error")); return; }
      setRejectingSlot(null);
      setRejectReason("");
      await load();
    } finally {
      setReviewingSlot(null);
    }
  };

  const sendInfoRequest = async () => {
    if (!infoQuestion.trim()) { alert("Write the question first."); return; }
    setSendingInfo(true);
    try {
      const res = await fetch("/api/online-report/request-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, question: infoQuestion.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Failed to send: " + (data.error || "unknown error")); return; }
      setInfoQuestion("");
      await load();
    } finally {
      setSendingInfo(false);
    }
  };

  const unresolvedRejectedPhotos = Object.entries(report?.photo_review || {}).filter(([, r]) => r?.status === "rejected");
  const hasOpenQuestion = report?.reviewer_question && !report?.patient_answer;

  const submitReport = async () => {
    if (!doctorId) { alert("Please select the reviewing doctor before submitting."); return; }
    if (unresolvedRejectedPhotos.length > 0) {
      alert("Some photos are still rejected and awaiting patient reupload. Resolve those before submitting.");
      return;
    }
    if (hasOpenQuestion) {
      alert("The patient hasn't answered your question yet. Wait for their response before submitting.");
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("online_reports")
        .update({
          status: "report_ready",
          case_severity: caseSeverity || null,
          dental_concerns: dentalConcernsText.split("\n").map((s) => s.trim()).filter(Boolean),
          objectives: objectivesText.split("\n").map((s) => s.trim()).filter(Boolean),
          estimated_duration: estimatedDuration || null,
          reviewer_notes: reviewerNotes || null,
          simulated_plan_url: simulatedPlanUrl || null,
          doctor_id: doctorId,
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>Loading…</div>;
  if (!report) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>Report not found.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}>{report.full_name}</h1>
          <p style={{ fontSize: 13, color: "var(--admin-ink2, #837a66)", margin: "0 0 20px" }}>Status: <strong>{report.status}</strong></p>
        </div>
        {isAdmin && (
          <button
            onClick={deleteReport}
            disabled={deleting}
            style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: deleting ? "wait" : "pointer", whiteSpace: "nowrap" }}
          >
            {deleting ? "Deleting…" : "Delete Report"}
          </button>
        )}
      </div>

      {notice && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>{notice}</div>
      )}

      {report.edit_requested_at && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
          Patient requested to edit their submitted information (requested {new Date(report.edit_requested_at).toLocaleString("en-IN")}). Please contact them.
        </div>
      )}
      {report.callback_requested_at && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
          Patient requested a callback ({new Date(report.callback_requested_at).toLocaleString("en-IN")}).
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>Patient Info</h3>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Age:</strong> {report.age ?? "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Gender:</strong> {report.sex || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Phone:</strong> {report.patient_phone || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Email:</strong> {report.patient_email || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}>
          <strong>Amount Paid:</strong> ₹{report.payment_amount ?? 0} ({report.payment_status}{report.coupon_code ? `, coupon: ${report.coupon_code}` : ""})
        </p>

        <h4 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "var(--admin-ink2, #837a66)", textTransform: "uppercase" }}>Existing Conditions</h4>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>
          {Object.entries(report.conditions || {})
            .filter(([k, v]) => k !== "other" && v)
            .map(([k]) => CONDITION_LABELS[k] || k)
            .concat(report.conditions?.other ? [`Other: ${report.conditions.other}`] : [])
            .join(", ") || "None reported"}
        </p>

        <h4 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "var(--admin-ink2, #837a66)", textTransform: "uppercase" }}>Chief Complaint</h4>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>{report.chief_complaint || "—"}</p>

        <h4 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "var(--admin-ink2, #837a66)", textTransform: "uppercase" }}>Dental Self-Assessment</h4>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Known cavities:</strong> {report.known_cavities || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Food lodgement:</strong> {report.food_lodgement || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Tooth mobility:</strong> {report.tooth_mobility || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: "0 0 4px" }}><strong>Pain:</strong> {report.pain || "—"}</p>
        <p style={{ fontSize: 13, color: "var(--admin-ink, #1b2a4a)", margin: 0 }}><strong>Other concerns:</strong> {report.other_concerns || "—"}</p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>Uploaded Photos</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {Object.entries(report.photo_urls || {}).map(([slotKey, url]) => {
            const review = (report.photo_review || {})[slotKey];
            const status = review?.status;
            const isBusy = reviewingSlot === slotKey;
            return (
              <div key={slotKey} style={{ border: `1.5px solid ${status === "approved" ? "#bbf7d0" : status === "rejected" ? "#fecaca" : "var(--admin-line, #e9e1d0)"}`, borderRadius: 10, padding: 10, background: status === "approved" ? "#f0fdf4" : status === "rejected" ? "#fef2f2" : "white" }}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={PHOTO_SLOT_LABELS[slotKey] || slotKey} style={{ width: "100%", height: 120, objectFit: "contain", background: "#fafafa", borderRadius: 8, border: "1px solid var(--admin-line, #e9e1d0)" }} />
                </a>
                <p style={{ margin: "6px 0 8px", fontSize: 11, color: "var(--admin-ink2, #837a66)", textAlign: "center", fontWeight: 700 }}>{PHOTO_SLOT_LABELS[slotKey] || slotKey}</p>

                {status === "approved" && (
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#16a34a", textAlign: "center" }}>✓ Approved</p>
                )}

                {status === "rejected" && (
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#dc2626", textAlign: "center" }}>✕ Rejected — awaiting patient reupload</p>
                    {review?.reason && <p style={{ margin: 0, fontSize: 11, color: "#7f1d1d", textAlign: "center", fontStyle: "italic" }}>"{review.reason}"</p>}
                  </div>
                )}

                {(!status || status === "pending") && rejectingSlot !== slotKey && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => reviewPhoto(slotKey, "approved")} disabled={isBusy} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "none", background: "#16a34a", color: "white", fontWeight: 700, fontSize: 11, cursor: isBusy ? "wait" : "pointer" }}>
                      Approve
                    </button>
                    <button onClick={() => setRejectingSlot(slotKey)} disabled={isBusy} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontWeight: 700, fontSize: 11, cursor: isBusy ? "wait" : "pointer" }}>
                      Reject
                    </button>
                  </div>
                )}

                {(!status || status === "pending") && rejectingSlot === slotKey && (
                  <div>
                    <textarea
                      autoFocus
                      placeholder="Reason for rejection…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      style={{ width: "100%", minHeight: 60, padding: 8, borderRadius: 8, border: "1px solid var(--admin-line, #e9e1d0)", fontSize: 12, boxSizing: "border-box", marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => reviewPhoto(slotKey, "rejected", rejectReason.trim())}
                        disabled={isBusy || !rejectReason.trim()}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontWeight: 700, fontSize: 11, cursor: isBusy || !rejectReason.trim() ? "not-allowed" : "pointer" }}
                      >
                        {isBusy ? "Saving…" : "Submit Rejection"}
                      </button>
                      <button
                        onClick={() => { setRejectingSlot(null); setRejectReason(""); }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink2, #837a66)", fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(report.photo_urls || {}).length === 0 && <p style={{ fontSize: 13, color: "var(--admin-ink2, #837a66)" }}>No photos.</p>}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>Request More Info from Patient</h3>
        {report.reviewer_question ? (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--admin-ink2, #837a66)", textTransform: "uppercase" }}>Question sent</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--admin-ink, #1b2a4a)" }}>{report.reviewer_question}</p>
            {report.patient_answer ? (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Patient answered</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--admin-ink, #1b2a4a)" }}>{report.patient_answer}</p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: "#b45309", fontWeight: 700 }}>Awaiting patient's answer…</p>
            )}
          </div>
        ) : (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--admin-ink2, #837a66)" }}>No question sent yet.</p>
        )}
        <textarea
          placeholder="Write a question for the patient — e.g. clarify a symptom, ask for missing detail…"
          value={infoQuestion}
          onChange={(e) => setInfoQuestion(e.target.value)}
          style={{ ...input, minHeight: 70, marginBottom: 8 }}
        />
        <button
          onClick={sendInfoRequest}
          disabled={sendingInfo || !infoQuestion.trim()}
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: 700, fontSize: 13, cursor: sendingInfo || !infoQuestion.trim() ? "not-allowed" : "pointer" }}
        >
          {sendingInfo ? "Sending…" : "Send to Patient"}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>Reviewer Form</h3>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>1. Case Severity</span>
          <select style={input} value={caseSeverity} onChange={(e) => setCaseSeverity(e.target.value)}>
            <option value="">Select…</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>2. Concern — Patient Concern (read-only, from chief complaint)</span>
          <p style={{ ...input, minHeight: 20, background: "var(--admin-bg, #faf6ec)", color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>{report.chief_complaint || "—"}</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Dental Concern (one point per line)</span>
          <textarea
            style={{ ...input, minHeight: 80 }}
            placeholder={"e.g.\nCrowding in lower anteriors\nMild bite mismatch"}
            value={dentalConcernsText}
            onChange={(e) => setDentalConcernsText(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>3. Objectives (one point per line)</span>
          <textarea
            style={{ ...input, minHeight: 80 }}
            placeholder={"e.g.\nAlign anterior crowding\nCorrect bite mismatch"}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>4. Estimated Treatment Duration (in months)</span>
          <input style={input} placeholder="e.g. 6-9 months" value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Additional Notes (optional)</span>
          <textarea style={{ ...input, minHeight: 70 }} value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Simulated Plan Link (external URL)</span>
          <input style={input} placeholder="https://..." value={simulatedPlanUrl} onChange={(e) => setSimulatedPlanUrl(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Additional Reference Photos</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {additionalPhotos.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--admin-line, #e9e1d0)" }} />
            ))}
          </div>
          <label style={{ fontSize: 12, color: "var(--admin-gold, #b8905a)", fontWeight: 700, cursor: "pointer" }}>
            {addingPhoto ? "Uploading…" : "+ Add photo"}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={addingPhoto} onChange={(e) => uploadAdditionalPhoto(e.target.files?.[0])} />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={label}>Reviewing Doctor</span>
          <select style={input} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} — {d.designation}{d.location ? ` (${d.location})` : ""}</option>
            ))}
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--admin-ink2, #837a66)" }}>
            Manage doctors (name, designation, registration number, location) in the Doctors section.
          </p>
        </div>

        {(unresolvedRejectedPhotos.length > 0 || hasOpenQuestion) && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: 12, fontSize: 12, marginBottom: 12 }}>
            {unresolvedRejectedPhotos.length > 0 && <p style={{ margin: "0 0 4px" }}>⚠ {unresolvedRejectedPhotos.length} photo(s) still rejected — waiting on patient reupload.</p>}
            {hasOpenQuestion && <p style={{ margin: 0 }}>⚠ Waiting on the patient's answer to your question.</p>}
          </div>
        )}

        <button
          onClick={submitReport}
          disabled={submitting}
          style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "var(--admin-gold, #b8905a)", color: "white", fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer" }}
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--admin-ink, #1b2a4a)" }}>Impression Status</h3>
        {report.status === "impression_interested" && (
          <button onClick={markReadyToPayImpression} disabled={statusBusy} style={statusBtn}>Mark Ready to Pay ₹999 (Impression)</button>
        )}
        {report.status === "impression_paid" && (
          <button onClick={markImpressionTaken} disabled={statusBusy} style={statusBtn}>Mark Impression Taken</button>
        )}
        {!["impression_interested", "impression_paid"].includes(report.status) && (
          <p style={{ fontSize: 13, color: "var(--admin-ink2, #837a66)", margin: 0 }}>No action available at this stage.</p>
        )}
      </div>
    </div>
  );
}

const statusBtn = { padding: "10px 18px", borderRadius: 10, border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink, #1b2a4a)", fontWeight: 700, fontSize: 13, cursor: "pointer" };
