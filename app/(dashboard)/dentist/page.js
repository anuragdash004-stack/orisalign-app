"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function DentistDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dentistEmail, setDentistEmail] = useState("");
  const [sendingOtp, setSendingOtp] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadAssignedCases = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.push("/login");
        return;
      }
      const userId = authData.user.id;
      setDentistEmail(authData.user.email);

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      const isAdmin = userData?.role === "admin";

      let query = supabase
        .from("appointments_booking")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("assigned_dentist", userId);
      }

      const { data, error } = await query;

      if (error) console.error("Failed to load cases:", error);
      setAppointments(data || []);
      setLoading(false);
    };

    loadAssignedCases();
  }, []);

  const handleStartAppointment = async (appt) => {
    if (appt.status === "completed") {
      alert("This appointment is completed and cannot be edited.");
      return;
    }

    // Already started — go directly to appointment, no OTP needed
    if (appt.appointment_started) {
      router.push(`/dentist/${appt.id}/appointment`);
      return;
    }

    const hasEmail = appt.email && appt.email !== "N/A";

    if (!hasEmail) {
      router.push(`/dentist/${appt.id}/start`);
      return;
    }

    setSendingOtp(appt.id);

    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        patientEmail: appt.email,
        patientName: appt.name,
      }),
    });

    setSendingOtp(null);

    if (!res.ok) {
      alert("Failed to send OTP. Please try again.");
      return;
    }

    router.push(`/dentist/${appt.id}/start`);
  };

  if (loading) return <p>Loading your cases...</p>;

  return (
    <div>
      <h1 style={{ marginBottom: "6px" }}>My Cases</h1>
      <p style={{ color: "gray", fontSize: "13px", marginBottom: "20px" }}>
        Logged in as: {dentistEmail}
      </p>

      {appointments.length === 0 ? (
        <p>No cases assigned to you yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {appointments.map((appt) => {
            const isCompleted = appt.status === "completed";
            return (
              <div
                key={appt.id}
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "20px",
                  color: "#111827",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  opacity: isCompleted ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: "16px" }}>{appt.name || "Unnamed patient"}</strong>
                    <p style={{ margin: "6px 0 2px", fontSize: "14px", color: "gray" }}>Phone: {appt.phone || "N/A"}</p>
                    <p style={{ margin: "0 0 2px", fontSize: "14px", color: "gray" }}>Email: {appt.email || "N/A"}</p>
                    <p style={{ margin: "0", fontSize: "14px", color: "gray" }}>
                      Time: {[appt.date, appt.time].filter(Boolean).join(" ") || "N/A"}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "99px",
                    background: isCompleted ? "#f3f4f6" : appt.status === "confirmed" ? "#dcfce7" : "#fef9c3",
                    color: isCompleted ? "#6b7280" : appt.status === "confirmed" ? "#16a34a" : "#854d0e",
                  }}>
                    {isCompleted ? "COMPLETED" : (appt.status?.toUpperCase() || "ASSIGNED")}
                  </span>
                </div>

                <button
                  onClick={() => handleStartAppointment(appt)}
                  disabled={isCompleted || sendingOtp === appt.id}
                  style={{
                    marginTop: "14px", padding: "10px 20px", borderRadius: "8px", border: "none",
                    background: isCompleted ? "#e5e7eb" : "#22c55e",
                    color: isCompleted ? "#9ca3af" : "white",
                    cursor: isCompleted ? "not-allowed" : "pointer",
                    fontSize: "14px", fontWeight: "600",
                  }}
                >
                  {sendingOtp === appt.id ? "Sending OTP to patient..." : isCompleted ? "Appointment Completed" : appt.appointment_started ? "Continue Appointment →" : "Start Appointment →"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
