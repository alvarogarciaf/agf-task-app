import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from "firebase/firestore"
import { firestoreDb } from "./firebase/config"

export type TutorialStatus = "pending" | "completed" | "skipped"

export interface OnboardingState {
  seededAt?: number
  tutorial?: {
    status: TutorialStatus
    at?: number
    version: number
  }
}

export const TUTORIAL_VERSION = 1

export const TUTORIAL_TEST_EMAILS = ["alvaro.garciafiorio@gmail.com"]

function localDoneKey(uid: string) {
  return `tasker_tutorial_done_${uid}`
}

function onboardingDocRef(uid: string) {
  return doc(firestoreDb, "users", uid, "settings", "onboarding")
}

export function isTutorialDoneLocally(uid: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(localDoneKey(uid)) === "true"
  } catch {
    return false
  }
}

export function markTutorialDoneLocally(uid: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(localDoneKey(uid), "true")
  } catch {
    // ignore storage errors
  }
}

export function shouldAutoStartTutorial(
  state: OnboardingState | null,
  uid: string,
  email?: string | null
): boolean {
  if (isTutorialDoneLocally(uid)) return false

  const status = state?.tutorial?.status
  if (status === "completed" || status === "skipped") {
    markTutorialDoneLocally(uid)
    return false
  }

  if (status === "pending") {
    return true
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? ""
  if (normalizedEmail && TUTORIAL_TEST_EMAILS.includes(normalizedEmail)) {
    return true
  }

  return false
}

export async function getOnboarding(uid: string): Promise<OnboardingState | null> {
  try {
    const snap = await getDoc(onboardingDocRef(uid))
    if (snap.exists()) {
      return snap.data() as OnboardingState
    }
  } catch (err) {
    console.warn("[onboarding] Failed to read onboarding doc:", err)
  }
  return null
}

export function onOnboardingState(
  uid: string,
  callback: (state: OnboardingState | null, exists: boolean) => void
): Unsubscribe {
  return onSnapshot(
    onboardingDocRef(uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as OnboardingState
        if (data.tutorial?.status === "completed" || data.tutorial?.status === "skipped") {
          markTutorialDoneLocally(uid)
        }
        callback(data, true)
      } else {
        callback(null, false)
      }
    },
    (err) => {
      console.warn("[onboarding] Snapshot error:", err)
      callback(null, false)
    }
  )
}

export async function setTutorialStatus(
  uid: string,
  status: "completed" | "skipped"
): Promise<void> {
  markTutorialDoneLocally(uid)
  try {
    await setDoc(
      onboardingDocRef(uid),
      {
        tutorial: {
          status,
          at: Date.now(),
          version: TUTORIAL_VERSION,
        },
      },
      { merge: true }
    )
  } catch (err) {
    console.warn("[onboarding] Failed to persist tutorial status:", err)
  }
}
