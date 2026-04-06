"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "42px" }}>🦷 OrisAlign</h1>

      <p style={{ marginTop: "10px", color: "#94a3b8" }}>
        Straighten your smile with clear aligners
      </p>

      <button
        onClick={() => router.push("/book")}
        style={{
          marginTop: "30px",
          padding: "15px 30px",
          fontSize: "18px",
          background: "#22c55e",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
        }}
      >
        Book Appointment
      </button>
    </div>
  );
}