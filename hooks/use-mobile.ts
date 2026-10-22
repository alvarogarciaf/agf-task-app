import * as React from 'react'

const MOBILE_BREAKPOINT = 768

const MobileOverrideContext = React.createContext<boolean | undefined>(undefined)

export function MobileOverrideProvider({
  value,
  children,
}: {
  value: boolean | undefined
  children: React.ReactNode
}) {
  return React.createElement(MobileOverrideContext.Provider, { value }, children)
}

export function useIsMobile() {
  const override = React.useContext(MobileOverrideContext)
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  if (override !== undefined) {
    return override
  }

  return !!isMobile
}
