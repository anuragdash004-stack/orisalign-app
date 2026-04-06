"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
} from "firebase/firestore";

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}

export default function Home() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // AUTO LOGIN
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // LOAD APPOINTMENTS (ADMIN PANEL)
  useEffect(() => {
    if (!user) return;

    const loadAppointments = async () => {
      const snapshot = await getDocs(collection(db, "appointments"));

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAppointments(data);
    };

    loadAppointments();
  }, [user]);

  // SEND OTP
  const sendOTP = async () => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" }
    );

    const confirmation = await signInWithPhoneNumber(
      auth,
      "+91" + phone,
      window.recaptchaVerifier
    );

    window.confirmationResult = confirmation;
  };

  // VERIFY OTP
  const verifyOTP = async () => {
    const result = await window.confirmationResult.confirm(otp);
    setUser(result.user);
  };

  // APPROVE BOOKING
  const approveAppointment = async (appt: any) => {
    // 1️⃣ Add to patients
    const patientRef = await addDoc(collection(db, "patients"), {
      name: "New Patient",
      phone: appt.phone,
      doctor: user.uid,
      createdAt: new Date(),
    });

    // 2️⃣ Update appointment status
    await updateDoc(doc(db, "appointments", appt.id), {
      status: "approved",
      patientId: patientRef.id,
    });

    alert("Approved ✅");
  };

  // REJECT BOOKING
  const rejectAppointment = async (appt: any) => {
    await updateDoc(doc(db, "appointments", appt.id), {
      status: "rejected",
    });

    alert("Rejected ❌");
  };

  // LOGOUT
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) return <h2>Loading...</h2>;

  // ================= ADMIN PANEL =================
  if (user) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>🦷 OrisAlign Admin Panel</h1>

        <p>Logged in: {user.phoneNumber}</p>

        <button onClick={logout}>Logout</button>

        <hr />

        <h2>📅 Appointments (Leads)</h2>

        {appointments.length === 0 ? (
          <p>No bookings yet</p>
        ) : (
          appointments.map((a) => (
            <div
              key={a.id}
              style={{
                border: "1px solid gray",
                padding: "10px",
                margin: "10px",
              }}
            >
              <p>📞 {a.phone}</p>
              <p>📅 {a.date}</p>
              <p>⏰ {a.time}</p>
              <p>Status: {a.status || "pending"}</p>

              <button onClick={() => approveAppointment(a)}>
                Approve
              </button>

              <button onClick={() => rejectAppointment(a)}>
                Reject
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  // ================= LOGIN =================
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Admin Login</h1>

      <input
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <br /><br />

      <button onClick={sendOTP}>Send OTP</button>

      <br /><br />

      <input
        placeholder="OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />

      <br /><br />

      <button onClick={verifyOTP}>Verify</button>

      <div id="recaptcha-container"></div>
    </div>
  );
}