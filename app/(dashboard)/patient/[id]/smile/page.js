"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function SmileCorrectionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();
      setAppt(data || null);
      setLoading(false);
    };
    load();
  }, [id]);

  const uploadImage = async (setNum, type, file) => {
    const key = `${setNum}-${type}`;
    setUploading(prev => ({ ...prev, [key]: true }));
    const ext = file.name.split(".").pop();
    const path = `smile-correction/${id}/set-${setNum}/${type}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("case-files")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(prev => ({ ...prev, [key]: false }));
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("case-files").getPublicUrl(path);
    const js = appt.journey_steps || {};
    const setImages = js.smile_set_images || {};
    const updated = {
      ...js,
      smile_set_images: {
        ...setImages,
        [setNum]: { ...(setImages[setNum] || {}), [type]: publicUrl },
      },
    };
    await supabase.from("appointments_booking").update({ journey_steps: updated }).eq("id", id);
    setAppt(prev => ({ ...prev, journey_steps: updated }));
    setUploading(prev => ({ ...prev, [key]: false }));
  };

  const handleRefinement = async () => {
    if (!window.confirm("Mark refinement as done?")) return;
    const js = appt.journey_steps || {};
    const updated = { ...js, refinement: true };
    await supabase.from("appointments_booking").update({ journey_steps: updated }).eq("id", id);
    setAppt(prev => ({ ...prev, journey_steps: updated }));
  };

  const handleEndJourney = async () => {
    if (!window.confirm("End the patient journey? Treatment will be marked as completed.")) return;
    const js = appt.journey_steps || {};
    const updated = { ...js, journey_ended: true };
    await supabase.from("appointments_booking")
      .update({ journey_steps: updated, status: "completed" })
      .eq("id", id);
    router.push(`/patient/${id}`);
  };

  const getSetDate = (index, startDateStr, daysPerSet) => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + index * (daysPerSet || 15));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#6b7280" }}>Loading...</p>
    </div>
  );

  if (!appt) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#dc2626" }}>Patient not found.</p>
    </div>
  );

  const js = appt.journey_steps || {};
  const isSetup = js.smile_sets_count && js.smile_start_date;
  const daysPerSet = js.smile_days_per_set || appt.aligner_days_per_set || 15;

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: "80px", backgroundColor: "#faf7f2", colorScheme: "light" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "24px 20px 32px",
        textAlign: "center",
        color: "white",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <img src="/logo.png" style={{ width: "120px" }} alt="OrisAlign" />
        </div>
        <h1 style={{
          fontSize: "22px", fontWeight: "800", margin: "0 0 4px",
          background: "linear-gradient(90deg, #f59e0b, #b8905a)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Smile Correction
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
          {appt.name} &nbsp;•&nbsp; {id.substring(0, 8).toUpperCase()}
        </p>
        <button
          onClick={() => router.push(`/patient/${id}`)}
          style={{
            marginTop: "12px", padding: "6px 16px", borderRadius: "8px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", fontSize: "12px", cursor: "pointer",
          }}
        >
          ← Back to Journey
        </button>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}>

        {!isSetup ? (
          /* Waiting for the clinic to set up the program */
          <div style={{
            background: "white", borderRadius: "20px", padding: "32px 28px",
            marginTop: "-16px", boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
            marginBottom: "24px", textAlign: "center",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>😁</div>
            <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
              Your Aligner Program is Being Prepared
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              Our team is finalising your aligner schedule. Once it&apos;s ready, your set-by-set plan and
              photo uploads will appear here. We&apos;ll keep you posted!
            </p>
          </div>

        ) : (
          <>
            {/* Summary card */}
            <div style={{
              background: "white", borderRadius: "20px", padding: "20px 24px",
              marginTop: "-16px", boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
              marginBottom: "24px",
              display: "flex", gap: "12px",
            }}>
              {[
                ["Total Sets", js.smile_sets_count],
                ["Start Date", new Date(js.smile_start_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
                ["Days / Set", String(daysPerSet)],
              ].map(([label, val]) => (
                <div key={label} style={{ flex: 1, background: "#f8f7f5", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: "#9ca3af", letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "15px", fontWeight: "800", color: "#111827" }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Set cards */}
            {Array.from({ length: js.smile_sets_count }, (_, i) => {
              const setNum = i + 1;
              const setDate = getSetDate(i, js.smile_start_date, daysPerSet);
              const setImages = js.smile_set_images?.[setNum] || {};
              const bothUploaded = setImages.edge_to_edge && setImages.complete_bite;

              return (
                <div key={setNum} style={{
                  background: "white", borderRadius: "16px", padding: "20px",
                  marginBottom: "14px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  border: `1px solid ${bothUploaded ? "#bbf7d0" : "#e5e7eb"}`,
                }}>
                  {/* Set header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: bothUploaded
                        ? "linear-gradient(135deg, #22c55e, #16a34a)"
                        : "linear-gradient(135deg, #b8905a, #f59e0b)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: "800", fontSize: "15px", flexShrink: 0,
                    }}>
                      {bothUploaded ? "✓" : setNum}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>Set {setNum}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Start: {setDate}</p>
                    </div>
                    {bothUploaded && (
                      <span style={{
                        fontSize: "11px", fontWeight: "700",
                        color: "#16a34a", background: "#dcfce7",
                        padding: "3px 10px", borderRadius: "99px",
                      }}>
                        Complete
                      </span>
                    )}
                  </div>

                  {/* Upload boxes */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                      { type: "edge_to_edge", label: "Edge to Edge Bite Photo" },
                      { type: "complete_bite", label: "Complete Bite Photo" },
                    ].map(({ type, label }) => {
                      const imgUrl = setImages[type];
                      const isUploading = uploading[`${setNum}-${type}`];
                      return (
                        <div key={type}>
                          <p style={{
                            margin: "0 0 6px", fontSize: "10px", fontWeight: "700",
                            color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px",
                          }}>
                            {label}
                          </p>
                          <label style={{
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            borderRadius: "12px",
                            border: `2px dashed ${imgUrl ? "#22c55e" : "#d1d5db"}`,
                            background: imgUrl ? "#f0fdf4" : "#f9fafb",
                            cursor: "pointer", overflow: "hidden",
                            aspectRatio: "4/3", position: "relative",
                          }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : isUploading ? (
                              <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Uploading...</p>
                            ) : (
                              <>
                                <span style={{ fontSize: "22px", marginBottom: "4px" }}>📷</span>
                                <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", textAlign: "center", padding: "0 8px" }}>Tap to upload</p>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              disabled={isUploading}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) uploadImage(setNum, type, file);
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Bottom actions */}
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: "12px",
              marginTop: "8px", paddingBottom: "40px",
            }}>
              <button
                onClick={handleRefinement}
                style={{
                  padding: "12px 24px", borderRadius: "12px",
                  border: js.refinement ? "none" : "1px solid #e5e7eb",
                  background: js.refinement ? "#dcfce7" : "white",
                  color: js.refinement ? "#16a34a" : "#374151",
                  fontWeight: "700", fontSize: "14px", cursor: "pointer",
                }}
              >
                {js.refinement ? "✓ Refinement" : "Refinement"}
              </button>
              <button
                onClick={handleEndJourney}
                style={{
                  padding: "12px 24px", borderRadius: "12px",
                  background: "#111827", color: "white",
                  fontWeight: "700", fontSize: "14px", border: "none", cursor: "pointer",
                }}
              >
                End Journey
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
