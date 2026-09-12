"use client"

import { useState } from "react"
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase/config"
import { toast } from "sonner"

type AuthMode = "signin" | "signup" | "forgot"

export function SignIn() {
  const [mode, setMode] = useState<AuthMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      console.error("Google sign-in failed:", err)
      if (err.code === "auth/popup-closed-by-user") {
        setError(null)
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup blocked by browser. Please allow popups and try again.")
      } else {
        setError("Google sign-in failed. Please try again.")
      }
      setLoading(false)
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return setError("Email is required.")
    
    if (mode === "forgot") {
      setLoading(true)
      try {
        await sendPasswordResetEmail(auth, email)
        toast.success("Password reset email sent. Check your inbox.")
        setMode("signin")
      } catch (err: any) {
        setError(err.message || "Failed to send reset email.")
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) return setError("Password is required.")
    
    setLoading(true)
    setError(null)
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err: any) {
      console.error("Email auth failed:", err)
      if (err.code === "auth/invalid-credential") {
        setError("Incorrect email or password.")
      } else if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.")
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.")
      } else {
        setError(err.message || "Authentication failed.")
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <img src="/logo.svg" alt="Logo" className="h-32 w-auto" />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">TASKER AGF</h1>
          <p className="mt-2 text-base text-muted-foreground md:text-sm">
            {mode === "signin" && "Welcome back. Sign in to your workspace."}
            {mode === "signup" && "Create your account to get started."}
            {mode === "forgot" && "Reset your password."}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:text-sm"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:text-sm"
              />
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-md bg-primary text-primary-foreground text-base font-medium transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:text-sm"
          >
            {loading ? "Please wait…" : (
              mode === "signin" ? "Sign In" : 
              mode === "signup" ? "Create Account" : 
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
          {mode === "signin" && (
            <>
              <button type="button" onClick={() => { setMode("forgot"); setError(null); }} className="hover:text-primary transition-colors">Forgot your password?</button>
              <button type="button" onClick={() => { setMode("signup"); setError(null); }} className="hover:text-primary transition-colors">Don't have an account? Sign up</button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" onClick={() => { setMode("signin"); setError(null); }} className="hover:text-primary transition-colors">Already have an account? Sign in</button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => { setMode("signin"); setError(null); }} className="hover:text-primary transition-colors">Back to sign in</button>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-border bg-card text-base font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:text-sm"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Your data is stored securely and accessible offline.
        </p>
      </div>
    </div>
  )
}
