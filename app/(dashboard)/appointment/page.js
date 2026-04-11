"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)

    const supabase = getSupabaseClient()

    if (!supabase) {
      alert("Server not ready. Please try again.")
      setLoading(false)
      return
    }

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

    // 🔥 ROLE-BASED REDIRECT (from metadata)
    const role = user?.user_metadata?.role

    if (role === "admin") {
      router.push("/admin")
    } else if (role === "dentist") {
      router.push("/dentist")
    } else if (role === "orthodontist") {
      router.push("/orthodontist")
    } else {
      alert("No role assigned to this user")
    }

    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-[350px] text-center">
        
        {/* Logo */}
        <img
          src="/onlylogo.png"
          alt="OrisAlign"
          className="mx-auto mb-6 w-[180px]"
        />

        <h2 className="text-xl font-semibold mb-4">Login</h2>

        {/* Email */}
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 p-3 border rounded-lg"
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-3 border rounded-lg"
        />

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#C69C6D] text-white p-3 rounded-lg font-semibold"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  )
}