"use client"

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react"

export type TabToolbarState = {
  canAdd: boolean
  addLabel: string
  onAdd: (() => void) | null
}

const defaultState: TabToolbarState = {
  canAdd: false,
  addLabel: "",
  onAdd: null,
}

function toolbarStateChanged(a: TabToolbarState, b: TabToolbarState) {
  return a.canAdd !== b.canAdd || a.addLabel !== b.addLabel || a.onAdd !== b.onAdd
}

const TabToolbarContext = createContext<{
  register: (state: TabToolbarState) => void
} | null>(null)

export function TabToolbarProvider({
  children,
  isActive,
  onChange,
}: {
  children: React.ReactNode
  isActive: boolean
  onChange: (state: TabToolbarState) => void
}) {
  const lastState = useRef<TabToolbarState>(defaultState)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const register = useCallback((state: TabToolbarState) => {
    const prev = lastState.current
    lastState.current = state
    if (isActive && toolbarStateChanged(prev, state)) {
      onChangeRef.current(state)
    }
  }, [isActive])

  useEffect(() => {
    if (isActive) {
      onChangeRef.current(lastState.current)
    }
  }, [isActive])

  return (
    <TabToolbarContext.Provider value={{ register }}>
      {children}
    </TabToolbarContext.Provider>
  )
}

export function useRegisterTabAdd(
  onAdd: (() => void) | null,
  addLabel: string,
  enabled: boolean,
) {
  const ctx = useContext(TabToolbarContext)
  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd

  const invokeAddRef = useRef<(() => void) | null>(null)
  if (!invokeAddRef.current) {
    invokeAddRef.current = () => {
      onAddRef.current?.()
    }
  }

  useEffect(() => {
    if (!ctx) return
    ctx.register({
      canAdd: enabled && !!onAddRef.current,
      addLabel,
      onAdd: enabled && onAddRef.current ? invokeAddRef.current : null,
    })
  }, [ctx, addLabel, enabled])
}
