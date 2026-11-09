"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, Sparkles, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TourStep, TourSampleFlags } from "./tour-steps"

interface TourOverlayProps {
  step: TourStep
  stepIndex: number
  totalSteps: number
  isMobile: boolean
  sampleFlags: TourSampleFlags
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

function findVisibleTarget(targetKey?: string): HTMLElement | null {
  if (!targetKey || typeof document === "undefined") return null
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${targetKey}"]`)
  for (const el of Array.from(nodes)) {
    const rects = el.getClientRects()
    if (rects.length === 0) continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      return el
    }
  }
  return null
}

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  isMobile,
  sampleFlags,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: TourOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [viewport, setViewport] = useState({ width: 1200, height: 800 })

  const targetKey = isMobile ? step.mobileTarget : step.desktopTarget
  const isSpotlight = step.kind === "spotlight" && !!targetKey

  const measure = useCallback(() => {
    if (typeof window === "undefined") return false
    setViewport({ width: window.innerWidth, height: window.innerHeight })
    if (!isSpotlight) {
      setTargetRect(null)
      return true
    }
    const el = findVisibleTarget(targetKey)
    if (!el) {
      return false
    }
    const r = el.getBoundingClientRect()
    // Ensure target is inside viewport vertically
    if (r.top < 0 || r.bottom > window.innerHeight) {
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest" })
      } catch {
        // ignore
      }
    }
    const updated = el.getBoundingClientRect()
    setTargetRect({
      top: updated.top,
      left: updated.left,
      width: updated.width,
      height: updated.height,
    })
    return true
  }, [isSpotlight, targetKey])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Measure target with retry up to 1.5s while transitions/carousel settle
  useEffect(() => {
    if (!mounted) return
    setTargetRect(null)

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    const startTime = performance.now()

    const attachObserver = () => {
      const el = findVisibleTarget(targetKey)
      if (el && typeof ResizeObserver !== "undefined") {
        resizeObserver?.disconnect()
        resizeObserver = new ResizeObserver(() => {
          if (!cancelled) measure()
        })
        resizeObserver.observe(el)
      }
    }

    const poll = () => {
      if (cancelled) return
      const found = measure()
      if (found) {
        attachObserver()
      }
      // Continue tracking for 600ms after found (in case carousel is still sliding),
      // or up to 1500ms if not yet found.
      const elapsed = performance.now() - startTime
      if (elapsed < (found ? 550 : 1500)) {
        requestAnimationFrame(poll)
      }
    }

    const rafId = requestAnimationFrame(poll)

    const onWindowChange = () => {
      if (!cancelled) measure()
    }
    window.addEventListener("resize", onWindowChange)
    window.addEventListener("scroll", onWindowChange, true)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", onWindowChange)
      window.removeEventListener("scroll", onWindowChange, true)
    }
  }, [mounted, step.id, isMobile, targetKey, measure])

  // Keyboard navigation
  useEffect(() => {
    if (!mounted) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onSkip()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        e.stopPropagation()
        if (step.kind === "finish") onFinish()
        else onNext()
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault()
        e.stopPropagation()
        onBack()
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [mounted, step.kind, stepIndex, onNext, onBack, onSkip, onFinish])

  if (!mounted || typeof document === "undefined") return null

  const pad = 6
  const hole = targetRect
    ? {
        x: Math.max(4, targetRect.left - pad),
        y: Math.max(4, targetRect.top - pad),
        w: Math.min(viewport.width - 8, targetRect.width + pad * 2),
        h: Math.min(viewport.height - 8, targetRect.height + pad * 2),
      }
    : null

  // Compute card position
  const cardWidth = Math.min(360, viewport.width - 32)
  const cardEstimatedHeight = 210
  const margin = 16
  let cardStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: cardWidth,
  }

  if (hole) {
    const isLeftSidebarTarget = !isMobile && hole.x < 280 && hole.w < 300
    const isBottomNavTarget = isMobile && hole.y > viewport.height - 230

    if (isLeftSidebarTarget) {
      const left = Math.min(
        hole.x + hole.w + 16,
        viewport.width - cardWidth - margin
      )
      const top = Math.min(
        Math.max(margin, hole.y - 8),
        viewport.height - cardEstimatedHeight - margin
      )
      cardStyle = { top, left, width: cardWidth }
    } else if (isBottomNavTarget) {
      const left = Math.min(
        Math.max(margin, hole.x + hole.w / 2 - cardWidth / 2),
        viewport.width - cardWidth - margin
      )
      const bottom = Math.max(margin, viewport.height - hole.y + 14)
      cardStyle = { bottom, left, width: cardWidth }
    } else {
      const spaceBelow = viewport.height - (hole.y + hole.h)
      const left = Math.min(
        Math.max(margin, hole.x),
        viewport.width - cardWidth - margin
      )
      if (spaceBelow >= cardEstimatedHeight + 24) {
        cardStyle = { top: hole.y + hole.h + 14, left, width: cardWidth }
      } else if (hole.y >= cardEstimatedHeight + 24) {
        cardStyle = {
          bottom: viewport.height - hole.y + 14,
          left,
          width: cardWidth,
        }
      } else {
        cardStyle = {
          bottom: margin + (isMobile ? 76 : 0),
          left,
          width: cardWidth,
        }
      }
    }
  }

  const spotlightCount = totalSteps - 2 // exclude welcome and finish
  const currentSpotlightNumber =
    step.kind === "spotlight" ? stepIndex : null
  const description = step.getDescription(sampleFlags)

  return createPortal(
    <div
      className="fixed inset-0 z-[120] select-none"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      {/* Dimmed backdrop with optional spotlight cutout */}
      <svg
        className="fixed inset-0 h-full w-full pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <mask id="tasker-tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.62)"
          mask="url(#tasker-tour-spotlight-mask)"
        />
      </svg>

      {/* Spotlight highlight ring */}
      {hole && (
        <div
          className="pointer-events-none fixed rounded-[10px] ring-2 ring-primary shadow-[0_0_0_4px_rgba(59,130,246,0.2)] transition-all duration-200"
          style={{
            top: hole.y,
            left: hole.x,
            width: hole.w,
            height: hole.h,
          }}
        />
      )}

      {/* Popover / Dialog Card */}
      <div
        style={cardStyle}
        className="fixed z-[121] rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl transition-all duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold leading-tight">
              {step.title}
            </h3>
          </div>
          {step.kind !== "finish" && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Skip tutorial"
              title="Skip tutorial (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* Progress dots for spotlight steps */}
        {currentSpotlightNumber !== null && (
          <div className="mt-4 flex items-center gap-1.5">
            {Array.from({ length: spotlightCount }).map((_, idx) => {
              const dotStep = idx + 1
              const isCurrent = dotStep === currentSpotlightNumber
              const isPast = dotStep < currentSpotlightNumber
              return (
                <span
                  key={dotStep}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    isCurrent
                      ? "w-4 bg-primary"
                      : isPast
                        ? "w-1.5 bg-primary/50"
                        : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              )
            })}
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {currentSpotlightNumber} / {spotlightCount}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex items-center justify-between gap-2 pt-1">
          {step.kind === "welcome" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-muted-foreground"
              >
                Skip
              </Button>
              <Button type="button" size="sm" onClick={onNext}>
                Show me around
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          ) : step.kind === "finish" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-muted-foreground"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
              <Button type="button" size="sm" onClick={onFinish}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Start capturing
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-muted-foreground px-2"
              >
                Skip
              </Button>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back
                </Button>
                <Button type="button" size="sm" onClick={onNext}>
                  Next
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
