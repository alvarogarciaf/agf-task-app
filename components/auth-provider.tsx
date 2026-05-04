"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth"
import { auth } from "@/lib/firebase/config"

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  async function handleSignOut() {
    await firebaseSignOut(auth)
    // RxDB databases remain on device (per uid) for fast re-login; clear manually if you share this device.
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
