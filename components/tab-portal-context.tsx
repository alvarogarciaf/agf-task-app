"use client"

import { createContext, useContext, useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const TabPortalContext = createContext<HTMLElement | null>(null)

export function useTabPortalContainer() {
  return useContext(TabPortalContext)
}

export function TabPortalProvider({
  children,
  className,
  hidden,
  isActive,
  onContainer,
}: {
  children: React.ReactNode
  className?: string
  hidden?: boolean
  isActive?: boolean
  onContainer?: (el: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const onContainerRef = useRef(onContainer)
  onContainerRef.current = onContainer

  useEffect(() => {
    const el = ref.current
    if (el) setContainer(el)
  }, [])

  useEffect(() => {
    if (isActive) {
      onContainerRef.current?.(ref.current)
    }
  }, [isActive])

  return (
    <TabPortalContext.Provider value={container}>
      <div
        ref={ref}
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden",
          hidden && "hidden",
          className,
        )}
      >
        {children}
      </div>
    </TabPortalContext.Provider>
  )
}
