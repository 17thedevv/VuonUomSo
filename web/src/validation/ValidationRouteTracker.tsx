import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalizeRoute } from './routeCanonicalizer'
import { validationTracker } from './validationTracker'

/**
 * Observes location changes in the React Router context and emits canonical
 * screen_viewed validation telemetry events without leaking dynamic entity IDs.
 */
export const ValidationRouteTracker: React.FC = () => {
  const location = useLocation()
  const lastCanonicalRouteRef = useRef<string | null>(null)

  useEffect(() => {
    const canonical = canonicalizeRoute(location.pathname)
    if (canonical && canonical !== lastCanonicalRouteRef.current) {
      lastCanonicalRouteRef.current = canonical
      void validationTracker.screenViewed(canonical)
    }
  }, [location.pathname])

  return null
}
