"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function OrthoPage() {
  const [role, setRole] = useState("");
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orthoEmail, setOrthoEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      const userRole = userData?.role || "";
      setRole(userRole);
      setOrthoEmail(authData.user.email);

      if (userRole === "orthodontist") {
        const { data } = await supabase
          .from("appointments_booking")
          .select("*")
          // Confirmed and completed appointments — never leads, and not
          // merely booked/assigned ones still awaiting admin confirmation.
          // Completed cases stay visible here too, just flagged as completed.
          .in("status", ["confirmed", "completed"])
          .eq("assigned_ortho", authData.user.id)
          .order("created_at", { ascending: false });
        setMyAppointments(data || []);
      } else {
        // admin — every confirmed/completed appointment, assigned or not, so
        // unassigned confirmed bookings stay visible for assignment.
        const { data } = await supabase
          .from("appointments_booking")
          .select("*")
          .in("status", ["confirmed", "completed"])
          .order("created_at", { ascending: false });
        setMyAppointments(data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <p>Loading...</p>;

  // Both ortho and admin use the same card view (admin sees all, ortho sees their own)
  if (role === "orthodontist" || role === "admin") {
    return (
      <div>
        <h1 style={{ marginBottom: "6px" }}>My Cases</h1>
        <p style={{ color: "gray", fontSize: "13px", marginBottom: "20px" }}>
          Logged in as: {orthoEmail}
        </p>

        {myAppointments.length === 0 ? (
          <p>No cases assigned to you yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {myAppointments.map((appt) => {
              const dentistStarted = appt.appointment_started;
              const isCompleted = appt.status === "completed";

              return (
                <div
                  key={appt.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--admin-line, #e9e1d0)",
                    borderRadius: "16px",
                    padding: "20px",
                    color: "var(--admin-ink, #1b2a4a)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ fontSize: "16px" }}>{appt.name || "Unnamed patient"}</strong>
                      <p style={{ margin: "6px 0 2px", fontSize: "14px", color: "gray" }}>
                        Phone: {appt.phone || "N/A"}
                      </p>
                      <p style={{ margin: "0 0 2px", fontSize: "14px", color: "gray" }}>
                        Email: {appt.email || "N/A"}
                      </p>
                      <p style={{ margin: "0", fontSize: "14px", color: "gray" }}>
                        Time: {[appt.date, appt.time].filter(Boolean).join(" ") || "N/A"}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "12px", fontWeight: "600", padding: "4px 10px",
                      borderRadius: "99px",
                      background: isCompleted ? "var(--admin-gold-wash, #f3f0e6)" : "#fef9c3",
                      color: isCompleted ? "var(--admin-ink2, #837a66)" : "#854d0e",
                    }}>
                      {appt.status?.toUpperCase() || "ASSIGNED"}
                    </span>
                  </div>

                  <button
                    onClick={() => router.push(`/ortho/${appt.id}`)}
                    style={{
                      marginTop: "14px", padding: "10px 24px",
                      borderRadius: "8px", border: "none",
                      background: dentistStarted ? "#22c55e" : "var(--admin-ink2, #837a66)",
                      color: "white", cursor: "pointer",
                      fontSize: "14px", fontWeight: "600",
                      transition: "background 0.2s",
                    }}
                  >
                    {dentistStarted ? "OPEN →" : "OPEN"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
