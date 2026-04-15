"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function BookPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [doctor, setDoctor] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          doctor,
          date,
          time,
        }),
      });

      const data = await res.json();
      console.log(data);

      if (data.success) {
        alert("Appointment booked ✅");
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 100 }}>
      <form onSubmit={handleSubmit} style={{ width: 300 }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <br /><br />

        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <br /><br />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br /><br />

        <input
          placeholder="Doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
        />
        <br /><br />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <br /><br />

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <br /><br />

        <button type="submit">Book Appointment</button>
      </form>
    </div>
  );
}
