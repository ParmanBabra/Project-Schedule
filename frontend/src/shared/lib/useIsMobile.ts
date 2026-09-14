import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/** True below the mobile breakpoint (docs/ui-design.md §5); updates on resize. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && 'matchMedia' in window && window.matchMedia(QUERY).matches)
  useEffect(() => {
    if (!('matchMedia' in window)) return
    const mq = window.matchMedia(QUERY)
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}
