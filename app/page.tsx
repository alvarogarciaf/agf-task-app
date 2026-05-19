"use client"

import { useMemo, useState, Suspense } from "react"
import { useAuth } from "@/components/auth-provider"
import { DbProvider } from "@/components/db-provider"
import { SignIn } from "@/components/sign-in"
import { AppContent } from "@/components/app-content"
import { GoogleCalendarProvider } from "@/components/google-calendar-provider"
import { MessageSyncProvider } from "@/components/message-sync-provider"

export default function Page() {
  const { user, loading, signOut } = useAuth()

  // Loading state while Firebase checks session
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  // Not authenticated — show sign-in
  if (!user) {
    return <SignIn />
  }

  // Authenticated — render app with user-isolated database
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
