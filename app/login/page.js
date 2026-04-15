"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function LoginPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const user = data.user

    // 🔍 Debug - check user in console
    console.log("FULL USER:", user)

    // ✅ Get role safely
    const role =
      user?.user_metadata?.role ||
      user?.app_metadata?.role ||
      "user"

    console.log("ROLE:", role)

    // ✅ Role-based routing
    if (role === "admin") {
      router.push("/admin")
    } else if (role === "dentist") {
      router.push("/dentist")
    } else if (role === "orthodontist") {
      router.push("/ortho")
    } else {
      router.push("/doctor") // fallback
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        
        <h1 className="text-2xl font-bold mb-6 text-center">
          Login
        </h1>

        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 border rounded-lg"
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 border rounded-lg"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  )
}
