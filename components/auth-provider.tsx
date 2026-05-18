"use client"

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react"
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth"
import { auth } from "@/lib/firebase/config"

const CACHED_USER_KEY = "tasker_cached_user"

interface CachedUser {
  uid: string
  displayName: string | null
  email: string | null
}

interface AuthContextValue {
  user: User | CachedUser | null
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

function getCachedUser(): CachedUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedUser
  } catch {
    return null
  }
}

function setCachedUser(user: User | null) {
  if (typeof window === "undefined") return
  if (user) {
    const cached: CachedUser = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
    }
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(cached))
  } else {
    localStorage.removeItem(CACHED_USER_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with server-safe defaults to avoid hydration mismatch
  const [user, setUser] = useState<User | CachedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const authResolved = useRef(false)

  // Restore cached user synchronously before first paint (avoids flash)
  useEffect(() => {
    if (authResolved.current) return
    const cached = getCachedUser()
    if (cached) {
      setUser(cached)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      authResolved.current = true
      if (firebaseUser) {
        setUser(firebaseUser)
        setCachedUser(firebaseUser)
      } else {
        // Session expired or user signed out
        setUser(null)
        localStorage.removeItem(CACHED_USER_KEY)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  async function handleSignOut() {
    await firebaseSignOut(auth)
    localStorage.removeItem(CACHED_USER_KEY)
    // RxDB databases remain on device (per uid) for fast re-login; clear manually if you share this device.
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
