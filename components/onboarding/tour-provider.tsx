"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import {
  onOnboardingState,
  setTutorialStatus,
  shouldAutoStartTutorial,
  isTutorialDoneLocally,
  type OnboardingState,
} from "@/lib/onboarding"
import {
  TOUR_STEPS,
  type TourNavHelpers,
  type TourSampleFlags,
} from "./tour-steps"
import { TourOverlay } from "./tour-overlay"

interface TourContextValue {
  isOpen: boolean
  stepIndex: number
  start: (options?: { isReplay?: boolean }) => void
  next: () => void
  back: () => void
  skip: () => void
  finish: () => void
}

const TourContext = createContext<TourContextValue>({
  isOpen: false,
  stepIndex: 0,
  start: () => {},
  next: () => {},
  back: () => {},
  skip: () => {},
  finish: () => {},
})

export function useTour() {
  return useContext(TourContext)
}

interface TourProviderProps {
  userUid?: string | null
  userEmail?: string | null
  isMobile: boolean
  sampleFlags: TourSampleFlags
  navHelpers: TourNavHelpers
  children: ReactNode
}

export function TourProvider({
  userUid,
  userEmail,
  isMobile,
  sampleFlags,
  navHelpers,
  children,
}: TourProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [isReplaySession, setIsReplaySession] = useState(false)
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null)
  const [snapshotLoaded, setSnapshotLoaded] = useState(false)

  const hasAutoStartedRef = useRef(false)
  const navHelpersRef = useRef(navHelpers)
  navHelpersRef.current = navHelpers

  // Subscribe to Firestore onboarding state for the current user
  useEffect(() => {
    hasAutoStartedRef.current = false
    setSnapshotLoaded(false)
    setOnboardingState(null)

    if (!userUid) return
    if (isTutorialDoneLocally(userUid)) {
      return
    }

    const unsub = onOnboardingState(userUid, (state) => {
      setOnboardingState(state)
      setSnapshotLoaded(true)
    })

    return () => unsub()
  }, [userUid])

  // Auto-start when eligible, waiting up to 5s for `t_sample` on newly seeded accounts
  useEffect(() => {
    if (!userUid || !snapshotLoaded || hasAutoStartedRef.current || isOpen) {
      return
    }
    if (!shouldAutoStartTutorial(onboardingState, userUid, userEmail)) {
      return
    }

    const isPendingNewUser = onboardingState?.tutorial?.status === "pending"
    const waitMs =
      isPendingNewUser && !sampleFlags.hasSampleTask ? 5000 : 600

    const timer = setTimeout(() => {
      if (hasAutoStartedRef.current) return
      hasAutoStartedRef.current = true
      setIsReplaySession(false)
      setStepIndex(0)
      setIsOpen(true)
    }, waitMs)

    return () => clearTimeout(timer)
  }, [
    userUid,
    userEmail,
    snapshotLoaded,
    onboardingState,
    sampleFlags.hasSampleTask,
    isOpen,
  ])

  // Run beforeShow hook whenever active step changes
  useEffect(() => {
    if (!isOpen) return
    const currentStep = TOUR_STEPS[stepIndex]
    currentStep?.beforeShow?.(navHelpersRef.current)
  }, [isOpen, stepIndex])

  const start = useCallback((options?: { isReplay?: boolean }) => {
    hasAutoStartedRef.current = true
    setIsReplaySession(Boolean(options?.isReplay))
    setStepIndex(0)
    setIsOpen(true)
  }, [])

  const next = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1))
  }, [])

  const back = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const returnToInboxOnMobile = useCallback(() => {
    const helpers = navHelpersRef.current
    if (helpers.isMobile) {
      helpers.switchMobileSection("tasks")
      helpers.navigateToHome()
    }
  }, [])

  const skip = useCallback(() => {
    setIsOpen(false)
    returnToInboxOnMobile()
    if (userUid && !isReplaySession) {
      void setTutorialStatus(userUid, "skipped")
    }
  }, [userUid, isReplaySession, returnToInboxOnMobile])

  const finish = useCallback(() => {
    setIsOpen(false)
    returnToInboxOnMobile()
    if (userUid && !isReplaySession) {
      void setTutorialStatus(userUid, "completed")
    }
  }, [userUid, isReplaySession, returnToInboxOnMobile])

  const currentStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  return (
    <TourContext.Provider
      value={{ isOpen, stepIndex, start, next, back, skip, finish }}
    >
      {children}
      {isOpen && (
        <TourOverlay
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={TOUR_STEPS.length}
          isMobile={isMobile}
          sampleFlags={sampleFlags}
          onNext={next}
          onBack={back}
          onSkip={skip}
          onFinish={finish}
        />
      )}
    </TourContext.Provider>
  )
}
