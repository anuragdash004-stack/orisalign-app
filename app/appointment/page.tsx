"use client";

import { useState } from "react";

export default function AppointmentPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");

  const slots = [
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
  ];

  const handleBooking = () => {
    if (!name || !age || !date || !slot) {
      alert("Please fill all details");
      return;
    }

    alert("Appointment Booked Successfully ✅");
  };

  return (
   <div
  style={{
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    backgroundImage: "url('/pattern.png')",

    // ✅ Good spacing
    backgroundSize: "180px",

    // ✅ Keep pattern visible
    backgroundRepeat: "repeat",

    // 🔥 ADD THIS (IMPORTANT)
    backgroundColor: "#faf7f2", // warm premium base
  }}
>
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          padding: "35px 30px",
          borderRadius: "20px",
          width: "360px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {/* 🔥 LOGO PERFECT CENTER FIX */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "10px",
          }}
        >
          <img
            src="/logo.png"
            alt="OrisAlign"
            style={{
              width: "140px",
              objectFit: "contain",
            }}
          />
        </div>

        <h2 style={{ marginBottom: "20px", color: "#333" }}>
          Book Appointment
        </h2>

        {/* INPUTS */}
        <input
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          style={inputStyle}
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />

        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select Time Slot</option>
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button onClick={handleBooking} style={buttonStyle}>
          Confirm Booking
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  background: "#b9925b",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "600",
};