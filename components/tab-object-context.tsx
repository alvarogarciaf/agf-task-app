"use client"

import { createContext, useContext } from "react"

type TabObjectContextValue = {
  openObjectFullScreen: (taskId: string, mode: "view" | "edit") => void
  openObjectInNewTab: (taskId: string, mode: "view" | "edit") => void
}

const TabObjectContext = createContext<TabObjectContextValue | null>(null)

export function TabObjectProvider({
  value,
  children,
}: {
  value: TabObjectContextValue
  children: React.ReactNode
}) {
  return (
    <TabObjectContext.Provider value={value}>
      {children}
    </TabObjectContext.Provider>
  )
}

/** Returns the opener when inside a desktop tab panel, otherwise null. */
export function useOpenObjectFullScreen() {
  return useContext(TabObjectContext)
}
