"use client";

import { useState } from "react";

export default function AppointmentPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleBooking = () => {
    if (!name || !age || !date || !time) {
      alert("Please fill all fields");
      return;
    }

    alert("Appointment Booked Successfully ✅");
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#faf7f2",
      }}
    >
      {/* 🔥 SAME ICON PATTERN */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/pattern-icon.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "70px",   // 👈 smaller icons
          opacity: 0.16,            // 👈 more visible
        }}
      />

      {/* 🔥 CARD */}
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.95)",
          padding: "35px 30px",
          borderRadius: "20px",
          width: "360px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {/* 🔥 LOGO */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            width: "140px",
            display: "block",
            margin: "0 auto 10px auto",
          }}
        />

        <h3 style={{ marginBottom: "20px", color: "#333" }}>
          Book Appointment
        </h3>

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
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select Time Slot</option>
          <option>09:00 AM</option>
          <option>11:00 AM</option>
          <option>04:00 PM</option>
          <option>06:00 PM</option>
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
  border: "1px solid #0e0c0c",
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