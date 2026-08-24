"use client"

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react"
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth"
import { auth, firestoreDb } from "@/lib/firebase/config"
import { getFirestore } from "firebase/firestore"

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
  const [user, setUser] = useState<User | CachedUser | null>(() => getCachedUser())
  const [loading, setLoading] = useState(() => !getCachedUser())
  const authResolved = useRef(false)



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      authResolved.current = true
      if (firebaseUser) {
        setUser(firebaseUser)
        setCachedUser(firebaseUser)
        // Publish email to directory for linking
        if (firebaseUser.email) {
          const emailBase64 = btoa(firebaseUser.email.toLowerCase())
          import("firebase/firestore").then(({ doc, setDoc, getFirestore }) => {
            const fsDb = auth.app.options ? getFirestore(auth.app) : firestoreDb
            const ref = doc(fsDb, `directory_by_email/${emailBase64}`)
            setDoc(ref, { uid: firebaseUser.uid }).catch(err => console.error("Failed to publish to directory", err))
            
            // Dynamically re-bind push subscription to the current user if already subscribed
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then(async (registration) => {
                const subscription = await registration.pushManager.getSubscription()
                if (subscription) {
                  localStorage.setItem("notifications_enabled", "true")
                  const subJson = subscription.toJSON()
                  const subId = btoa(subJson.endpoint || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)
                  setDoc(doc(fsDb, `users/${firebaseUser.uid}/push_subscriptions/${subId}`), {
                    ...subJson,
                    createdAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                  }).catch(e => console.warn("Failed to auto-bind push sub", e))
                } else {
                  localStorage.setItem("notifications_enabled", "false")
                }
              })
            }
          })
        }
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
    if (user && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          // We DO NOT unsubscribe from the browser, we just remove it from the old user's Firestore collection.
          // This allows the device to automatically re-bind when a new user signs in.
          const subJson = subscription.toJSON()
          const subId = btoa(subJson.endpoint || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)
          
          const { doc, deleteDoc, getFirestore } = await import("firebase/firestore")
          const fsDb = auth.app.options ? getFirestore(auth.app) : firestoreDb
          await deleteDoc(doc(fsDb, `users/${user.uid}/push_subscriptions/${subId}`))
        }
      } catch (err) {
        console.warn("Failed to clean up push subscription on sign out", err)
      }
    }

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
