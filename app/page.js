'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'

const supabase = getSupabaseClient()

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        router.push('/doctor')
      } else {
        router.push('/login')
      }
    }

    checkUser()
  }, [])

  return <div>Loading...</div>
}