"use client"

import { useEffect, useRef, useCallback } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

interface UseMobileDropdownAlignOptions {
  open: boolean
  triggerRef: React.RefObject<HTMLElement | null>
  inputRef?: React.RefObject<HTMLInputElement | null>
}

/**
 * Ensures that on mobile devices, when a dropdown/popover opens and the virtual
 * keyboard appears:
 * 1. The search input is focused with `preventScroll: true` to stop the browser's
 *    uncontrolled viewport jumping.
 * 2. The scrollable container is given temporary bottom padding so it can scroll
 *    the trigger element into view.
 * 3. The scrollable container is smoothly scrolled just enough so that the dropdown
 *    trigger sits right above the keyboard, with the popover modal anchored above it.
 * 4. The trigger remains visible and comfortable to tap to toggle/close the modal
 *    even while the virtual keyboard is open.
 */
export function useMobileDropdownAlign({
  open,
  triggerRef,
  inputRef,
}: UseMobileDropdownAlignOptions) {
  const isMobile = useIsMobile()
  const originalPaddingRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  const getScrollContainer = useCallback((el: HTMLElement | null): HTMLElement | null => {
    let cur = el?.parentElement
    while (cur) {
      if (cur === document.body || cur === document.documentElement) break
      const style = window.getComputedStyle(cur)
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return cur
      }
      cur = cur.parentElement
    }
    return null
  }, [])

  useEffect(() => {
    if (!open) {
      // Restore padding when dropdown closes
      if (containerRef.current && originalPaddingRef.current !== null) {
        containerRef.current.style.paddingBottom = originalPaddingRef.current
        originalPaddingRef.current = null
        containerRef.current = null
      }
      return
    }

    if (!isMobile) {
      // Desktop: just focus the search input normally
      if (inputRef?.current) {
        requestAnimationFrame(() => {
          inputRef.current?.focus()
        })
      }
      return
    }

    // Mobile logic:
    const trigger = triggerRef.current
    if (!trigger) return

    const computePadding = () => {
      const vv = window.visualViewport
      return vv ? Math.max(340, window.innerHeight - vv.height + 80) : 340
    }

    const scrollContainer = getScrollContainer(trigger)
    if (scrollContainer) {
      containerRef.current = scrollContainer
      if (originalPaddingRef.current === null) {
        originalPaddingRef.current = scrollContainer.style.paddingBottom
      }
      scrollContainer.style.paddingBottom = `${computePadding()}px`
    }

    // Focus input with preventScroll to stop native uncontrolled page shift
    if (inputRef?.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
      })
    }

    const alignTriggerAboveKeyboard = (smooth = true) => {
      const curTrigger = triggerRef.current
      const curContainer = containerRef.current || getScrollContainer(curTrigger)
      if (!curTrigger || !curContainer) return

      const vv = window.visualViewport
      const visualHeight = vv ? vv.height : window.innerHeight
      const visualTop = vv ? vv.offsetTop : 0
      const visibleBottom = visualTop + visualHeight

      // Position the trigger's bottom ~8px above the keyboard
      const targetBottom = visibleBottom - 8
      const rect = curTrigger.getBoundingClientRect()
      const delta = rect.bottom - targetBottom

      if (Math.abs(delta) > 2) {
        if (smooth) {
          curContainer.scrollBy({ top: delta, behavior: "smooth" })
        } else {
          curContainer.scrollTop += delta
        }
      }

      // Keep window scroll pinned at (0, 0)
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0)
      }
    }

    // Run initial alignment
    const rAF = requestAnimationFrame(() => alignTriggerAboveKeyboard(true))
    const timer1 = setTimeout(() => alignTriggerAboveKeyboard(true), 60)
    const timer2 = setTimeout(() => alignTriggerAboveKeyboard(false), 260)

    // Listen to visualViewport resize (as keyboard animates in)
    const handleViewportChange = () => {
      if (containerRef.current) {
        containerRef.current.style.paddingBottom = `${computePadding()}px`
      }
      alignTriggerAboveKeyboard(false)
    }

    const handleWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0)
      }
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true })
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange)
      window.visualViewport.addEventListener("scroll", handleViewportChange)
    }

    return () => {
      cancelAnimationFrame(rAF)
      clearTimeout(timer1)
      clearTimeout(timer2)
      window.removeEventListener("scroll", handleWindowScroll)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange)
        window.visualViewport.removeEventListener("scroll", handleViewportChange)
      }
      if (containerRef.current && originalPaddingRef.current !== null) {
        containerRef.current.style.paddingBottom = originalPaddingRef.current
        originalPaddingRef.current = null
        containerRef.current = null
      }
    }
  }, [open, isMobile, getScrollContainer, triggerRef, inputRef])
}
