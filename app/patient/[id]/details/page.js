"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

const supabase = getSupabaseClient();

export default function PatientDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: "",
    sex: "",
    fullAddress: "",
    pincode: "",
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();
      setPatient(data || null);
      if (data) {
        setFormData({
          age: data.age || "",
          sex: data.sex || "",
          fullAddress: data.address || "",
          pincode: data.pincode || "",
        });
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.age || !formData.sex) {
        alert("Please fill in Age and Sex");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.fullAddress || !formData.pincode) {
        alert("Please fill in Address and Pincode");
        return;
      }
      setStep(3);
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.age || !formData.sex || !formData.fullAddress || !formData.pincode) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("appointments_booking")
        .update({
          age: formData.age,
          sex: formData.sex,
          address: formData.fullAddress,
          pincode: formData.pincode,
        })
        .eq("id", id);

      if (error) throw error;

      router.push(`/patient/${id}`);
    } catch (err) {
      alert("Failed to submit details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "12px" }}>
        <p style={{ color: "#dc2626", fontWeight: "600" }}>Patient not found</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "60px", fontFamily: "'Inter', system-ui, sans-serif", colorScheme: "light", background: "#f9fafb" }}>
      {/* HEADER */}
      <div style={{ background: "white", padding: "24px 20px 32px", textAlign: "center", borderBottom: "3px solid #C9A84C", boxShadow: "0 2px 16px rgba(201,168,76,0.10)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <Image src="/logo.png" alt="OrisAlign" width={140} height={48} />
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: "900", margin: "0 0 4px", color: "#1B2A4A" }}>
          Fill Your Details
        </h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "0" }}>Step {step} of 3</p>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
        {/* PROGRESS BAR */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: "6px",
                  borderRadius: "99px",
                  background: s <= step ? "#b8905a" : "#e5e7eb",
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0", textAlign: "right" }}>
            {Math.round((step / 3) * 100)}% Complete
          </p>
        </div>

        {/* FORM CARD */}
        <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          {/* STEP 1 - Age and Sex */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 20px", color: "#111827" }}>
                Basic Information
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                    Age *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 25"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                    Sex *
                  </label>
                  <select
                    value={formData.sex}
                    onChange={(e) => handleInputChange("sex", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "2px solid #e5e7eb",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      color: formData.sex ? "#111827" : "#9ca3af",
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHERS">Others</option>
                  </select>
                </div>
              </div>

              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0", fontStyle: "italic" }}>
                These details help us provide personalized care
              </p>
            </div>
          )}

          {/* STEP 2 - Address and Pincode */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 20px", color: "#111827" }}>
                Address Information
              </h2>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                  Full Address *
                </label>
                <textarea
                  placeholder="Enter your full address"
                  value={formData.fullAddress}
                  onChange={(e) => handleInputChange("fullAddress", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    minHeight: "100px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                  Pincode *
                </label>
                <input
                  type="text"
                  placeholder="e.g., 751001"
                  maxLength="6"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0", fontStyle: "italic" }}>
                We'll use this to deliver your aligners
              </p>
            </div>
          )}

          {/* STEP 3 - Review */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 20px", color: "#111827" }}>
                Review Your Details
              </h2>

              <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
                {[
                  ["Name", patient.name || "N/A"],
                  ["Phone", patient.phone || "N/A"],
                  ["Age", formData.age || "N/A"],
                  ["Sex", formData.sex || "N/A"],
                  ["Address", formData.fullAddress || "N/A"],
                  ["Pincode", formData.pincode || "N/A"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "12px",
                      background: "#f8f7f5",
                      borderRadius: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>{label}:</span>
                    <span style={{ fontSize: "13px", color: "#111827", fontWeight: "700" }}>{value}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0", fontStyle: "italic" }}>
                Click Submit to confirm these details
              </p>
            </div>
          )}

          {/* BUTTON CONTROLS */}
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            {step > 1 && (
              <button
                onClick={handlePrev}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #e5e7eb",
                  background: "white",
                  color: "#111827",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.borderColor = "#b8905a";
                  e.target.style.background = "#f9fafb";
                }}
                onMouseOut={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.background = "white";
                }}
              >
                ← Back
              </button>
            )}

            <button
              onClick={step < 3 ? handleNext : handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: submitting ? "#d4a574" : "#b8905a",
                color: "white",
                fontWeight: "700",
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                if (!submitting) {
                  e.target.style.background = "#a0754d";
                }
              }}
              onMouseOut={(e) => {
                if (!submitting) {
                  e.target.style.background = "#b8905a";
                }
              }}
            >
              {submitting ? "Submitting..." : step < 3 ? "Next →" : "Submit"}
            </button>
          </div>
        </div>

        {/* INFO TEXT */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0" }}>
            Your details are safe and secure with us
          </p>
        </div>
      </div>
    </div>
  );
}
