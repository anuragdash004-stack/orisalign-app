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

    // later we will save to database
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0c0c0c",
        color: "white",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          padding: "30px",
          borderRadius: "16px",
          width: "350px",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
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
  padding: "10px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "none",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  background: "#b9925b",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};