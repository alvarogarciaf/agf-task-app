"use client"

import { Suspense, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useAuth } from "@/components/auth-provider"
import { DbProvider } from "@/components/db-provider"
import { SignIn } from "@/components/sign-in"
import { VerifyEmail } from "@/components/verify-email"
import { AppContent } from "@/components/app-content"
import { GoogleCalendarProvider } from "@/components/google-calendar-provider"
import { MessageSyncProvider } from "@/components/message-sync-provider"
import { PublicPageView } from "@/components/public-page-view"
import type { PublicPageData } from "@/lib/public-page-types"

function getInitialObjectIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("objectId") || params.get("taskId") || params.get("noteId")
}

function PageClientContent() {
  const { user, loading, signOut } = useAuth()
  const [objectId] = useState<string | null>(() => getInitialObjectIdFromUrl())
  const [publicCheck, setPublicCheck] = useState<{
    status: "idle" | "loading" | "found" | "not_found"
    page: PublicPageData | null
  }>({ status: "idle", page: null })

  useEffect(() => {
    if (loading || (user && user.emailVerified) || !objectId) return
    let cancelled = false
    setPublicCheck({ status: "loading", page: null })

    fetch(`/api/public/${encodeURIComponent(objectId)}`)
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as PublicPageData
      })
      .then((page) => {
        if (cancelled) return
        if (page) {
          setPublicCheck({ status: "found", page })
        } else {
          setPublicCheck({ status: "not_found", page: null })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicCheck({ status: "not_found", page: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, user, objectId])

  // Loading state while Firebase checks session or checks if linked item is public
  if (
    loading ||
    ((!user || !user.emailVerified) &&
      !!objectId &&
      (publicCheck.status === "idle" || publicCheck.status === "loading"))
  ) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  // If unauthenticated/unverified and target object is public, render full-page public view
  if (
    (!user || !user.emailVerified) &&
    publicCheck.status === "found" &&
    publicCheck.page
  ) {
    return <PublicPageView page={publicCheck.page} />
  }

  // Not authenticated — show sign-in
  if (!user) {
    return <SignIn />
  }

  // Email not verified — show verification gate
  if (!user.emailVerified) {
    return <VerifyEmail user={user} onSignOut={signOut} />
  }

  // Authenticated and verified — render app with user-isolated database
  return (
    <DbProvider userUid={user.uid}>
      <MessageSyncProvider>
        <GoogleCalendarProvider>
          <Suspense fallback={null}>
            <AppContent user={user} onSignOut={signOut} />
          </Suspense>
        </GoogleCalendarProvider>
      </MessageSyncProvider>
    </DbProvider>
  )
}

export default dynamic(() => Promise.resolve(PageClientContent), { ssr: false })
