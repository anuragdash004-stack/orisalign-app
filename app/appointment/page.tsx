"use client";

import { useState } from "react";

export default function AppointmentPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");

  const slots = [
    "09:00 AM",
    "11:00 AM",
    "04:00 PM",
    "06:00 PM",
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
        backgroundSize: "100px",
        backgroundRepeat: "repeat",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          padding: "30px",
          borderRadius: "20px",
          width: "360px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {/* LOGO */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            width: "130px",
            marginBottom: "15px",
          }}
        />

        <h2 style={{ marginBottom: "20px", color: "#333" }}>
          Book Appointment
        </h2>

        {/* NAME */}
        <input
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        {/* AGE */}
        <input
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          style={inputStyle}
        />

        {/* DATE */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />

        {/* SLOT */}
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

        {/* BUTTON */}
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