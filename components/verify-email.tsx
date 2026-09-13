"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, RefreshCw, LogOut, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import { sendEmailVerification, User } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { useAuth, CachedUser } from "@/components/auth-provider"
import { toast } from "sonner"

interface VerifyEmailProps {
  user: User | CachedUser
  onSignOut: () => Promise<void>
}

export function VerifyEmail({ user, onSignOut }: VerifyEmailProps) {
  const { reloadUser } = useAuth()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-polling: check if email got verified every 4 seconds
  useEffect(() => {
    let isMounted = true
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        const isVerified = await reloadUser()
        if (isVerified && isMounted) {
          toast.success("Email verified! Welcome to Tasker AGF.")
        }
      }
    }, 4000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [reloadUser])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    }
  }, [cooldown])

  async function handleCheckVerification() {
    setChecking(true)
    try {
      const isVerified = await reloadUser()
      if (isVerified) {
        toast.success("Email verified! Redirecting to workspace...")
      } else {
        toast.error("Email not verified yet. Please click the link in your email first.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check verification status.")
    } finally {
      setChecking(false)
    }
  }

  async function handleResendEmail() {
    if (cooldown > 0 || resending) return
    if (!auth.currentUser) return

    setResending(true)
    try {
      await sendEmailVerification(auth.currentUser)
      setCooldown(60)
      toast.success("Verification email sent! Check your inbox.")
    } catch (err: any) {
      console.error("Resend verification error:", err)
      if (err.code === "auth/too-many-requests") {
        setCooldown(60)
        toast.error("Too many requests. Please wait a minute before trying again.")
      } else {
        toast.error(err.message || "Failed to resend verification email.")
      }
    } finally {
      setResending(false)
    }
  }

  async function handleStartOver() {
    if (deleting) return
    setDeleting(true)
    try {
      if (auth.currentUser) {
        // Delete the unverified account so the email can be re-registered or typo cleared
        try {
          await auth.currentUser.delete()
        } catch (delErr) {
          console.warn("Could not delete unverified user, proceeding with sign out:", delErr)
        }
      }
      await onSignOut()
      toast.info("Unverified account discarded. You can now sign up with the correct email.")
    } catch (err: any) {
      toast.error("Failed to sign out. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center">
          <img src="/logo.svg" alt="Logo" className="h-24 w-auto mb-2" />
          
          <div className="relative my-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-8 w-8 animate-pulse" />
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Verify your email address</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to:
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-sm font-semibold text-foreground">
            {user.email || "your email"}
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-border bg-card p-4 text-left text-sm text-muted-foreground space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Click the verification link in the email to activate your account.</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Check your spam or junk folder if you don't see the email within a minute.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheckVerification}
            disabled={checking}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking status..." : "I've verified my email"}
          </button>

          <button
            type="button"
            onClick={handleResendEmail}
            disabled={cooldown > 0 || resending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {resending
              ? "Sending..."
              : cooldown > 0
              ? `Resend email in ${cooldown}s`
              : "Resend verification email"}
          </button>
        </div>

        {/* Footer options */}
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={handleStartOver}
            disabled={deleting}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {deleting ? "Discarding..." : "Mistyped email? Start over"}
          </button>

          <button
            type="button"
            onClick={() => onSignOut()}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
