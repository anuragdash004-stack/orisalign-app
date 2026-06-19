"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// Journey order for the 15 step templates (matches the patient roadmap).
const STEP_ORDER = [
  "booked",
  "confirmed",
  "scanning_done",
  "payment_done",
  "planning_done",
  "plan_approved",
  "manufacturing_started",
  "manufacturing_completed",
  "aligners_dispatched",
  "aligners_received",
  "followup_appointment",
  "aligners_delivered",
  "smile_correction",
  "treatment_completed",
  "feedback_submitted",
];

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [actor, setActor] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "admin" });
      }
      await fetchTemplates();
    };
    load();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/message-templates");
      const json = await res.json();
      const rows = json.templates || [];
      // Order by journey order, unknown keys last
      rows.sort((a, b) => {
        const ia = STEP_ORDER.indexOf(a.step_key);
        const ib = STEP_ORDER.indexOf(b.step_key);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      setTemplates(rows);
    } catch (err) {
      console.error("Failed to load templates", err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (stepKey, field, value) => {
    setTemplates((prev) => prev.map((t) => (t.step_key === stepKey ? { ...t, [field]: value } : t)));
  };

  const saveTemplate = async (tmpl) => {
    if (!tmpl.subject_line?.trim() || !tmpl.email_body?.trim()) {
      alert("Subject and message body are required.");
      return;
    }
    setSavingKey(tmpl.step_key);
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepKey: tmpl.step_key,
          subjectLine: tmpl.subject_line,
          emailBody: tmpl.email_body,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Failed to save: " + (json.error || "Unknown error"));
        return;
      }
      setSavedKey(tmpl.step_key);
      setTimeout(() => setSavedKey(null), 2500);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading templates...</div>;
  }

  const inputStyle = {
    width: "100%", padding: "11px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "14px", outline: "none",
    boxSizing: "border-box", background: "white", color: "#111827",
  };
  const label = {
    display: "block", fontSize: "11px", fontWeight: "800", color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px",
  };

  return (
    <div style={{ padding: "24px", maxWidth: "860px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>Message Templates</h1>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: "6px 0 0", lineHeight: 1.6 }}>
          These are the emails patients receive at each step of their journey. Edit and save a template, and
          every future message for that step will be sent using the new text.
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {templates.map((tmpl, idx) => (
          <div key={tmpl.step_key} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", flexShrink: 0 }}>
                {idx + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111827" }}>{tmpl.step_label || tmpl.step_key}</h3>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <span style={label}>Email Subject</span>
              <input
                style={inputStyle}
                value={tmpl.subject_line || ""}
                onChange={(e) => updateField(tmpl.step_key, "subject_line", e.target.value)}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <span style={label}>Message Body</span>
              <textarea
                style={{ ...inputStyle, minHeight: "120px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
                value={tmpl.email_body || ""}
                onChange={(e) => updateField(tmpl.step_key, "email_body", e.target.value)}
              />
            </div>

            <button
              onClick={() => saveTemplate(tmpl)}
              disabled={savingKey === tmpl.step_key}
              style={{
                padding: "10px 22px", borderRadius: "10px", border: "none",
                background: savedKey === tmpl.step_key ? "#16a34a" : "#111827",
                color: "white", fontWeight: "700", fontSize: "13px",
                cursor: savingKey === tmpl.step_key ? "not-allowed" : "pointer",
                opacity: savingKey === tmpl.step_key ? 0.6 : 1, letterSpacing: "0.5px",
              }}
            >
              {savingKey === tmpl.step_key ? "Saving..." : savedKey === tmpl.step_key ? "Saved ✓" : "Save Template"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
