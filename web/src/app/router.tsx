import React, { useEffect, useState } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation
} from 'react-router-dom'
import { bootstrapApp } from './bootstrap'
import { AppShell } from '../shared/components/AppShell'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { BatchesScreen } from '../features/batches/BatchesScreen'
import { BatchNewScreen } from '../features/batches/BatchNewScreen'
import { BatchDetailScreen } from '../features/batches/BatchDetailScreen'
import { OrdersScreen } from '../features/orders/OrdersScreen'
import { OrderNewScreen } from '../features/orders/OrderNewScreen'
import { OrderDetailScreen } from '../features/orders/OrderDetailScreen'
import { OrderReserveScreen } from '../features/orders/OrderReserveScreen'
import { ShipmentsScreen } from '../features/shipments/ShipmentsScreen'
import { ShipmentNewScreen } from '../features/shipments/ShipmentNewScreen'
import { ShipmentDetailScreen } from '../features/shipments/ShipmentDetailScreen'
import { BatchDossierScreen } from '../features/dossiers/BatchDossierScreen'
import { MoreScreen } from '../features/more/MoreScreen'
import { ValidationReportScreen } from '../features/validation/ValidationReportScreen'
import { PilotToolsScreen } from '../features/validation/PilotToolsScreen'
import { ValidationRouteTracker } from '../validation/ValidationRouteTracker'
import { GardenAvailabilityScreen } from '../features/garden/GardenAvailabilityScreen'
import { AvailabilityShareScreen } from '../features/share/AvailabilityShareScreen'

const RootLayout: React.FC = () => {
  return (
    <>
      <ValidationRouteTracker />
      <Outlet />
    </>
  )
}

const FOCUSED_TASK_ROUTES = [
  /^\/orders\/new$/,
  /^\/batches\/new$/,
  /^\/shipments\/new$/,
  /^\/orders\/[^/]+\/reserve$/,
  /^\/dossiers\/[^/]+$/
]

const isFocusedTaskRoute = (pathname: string): boolean =>
  FOCUSED_TASK_ROUTES.some((pattern) => pattern.test(pathname))

/**
 * Route guard ensuring user has completed onboarding before accessing core features.
 */
const AppShellLayout: React.FC = () => {
  const [checking, setChecking] = useState(true)
  const [isOnboarded, setIsOnboarded] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let isMounted = true
    bootstrapApp().then((state) => {
      if (isMounted) {
        setIsOnboarded(state.isOnboarded)
        setChecking(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [location.pathname])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-400">
        Đang khởi động Vườn Ươm...
      </div>
    )
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />
  }

  const isFocusedTask = isFocusedTaskRoute(location.pathname)

  return (
    <AppShell hideMobileNavOnly={isFocusedTask}>
      <Outlet />
    </AppShell>
  )
}

/**
 * Root index redirector based on onboarding state.
 */
const RootRedirect: React.FC = () => {
  const [checking, setChecking] = useState(true)
  const [isOnboarded, setIsOnboarded] = useState(false)

  useEffect(() => {
    bootstrapApp().then((state) => {
      setIsOnboarded(state.isOnboarded)
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-400">
        Đang mở sổ...
      </div>
    )
  }

  return <Navigate to={isOnboarded ? '/today' : '/onboarding'} replace />
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <RootRedirect />
      },
      {
        path: '/onboarding',
        element: <OnboardingScreen />
      },
      {
        element: <AppShellLayout />,
        children: [
          {
            path: '/today',
            element: <TodayScreen />
          },
          {
            path: '/garden',
            element: <GardenAvailabilityScreen />
          },
          {
            path: '/garden/share',
            element: <AvailabilityShareScreen />
          },
          {
            path: '/batches',
            element: <BatchesScreen />
          },
          {
            path: '/batches/new',
            element: <BatchNewScreen />
          },
          {
            path: '/batches/:id',
            element: <BatchDetailScreen />
          },
          {
            path: '/orders',
            element: <OrdersScreen />
          },
          {
            path: '/orders/new',
            element: <OrderNewScreen />
          },
          {
            path: '/orders/:id',
            element: <OrderDetailScreen />
          },
          {
            path: '/orders/:id/reserve',
            element: <OrderReserveScreen />
          },
          {
            path: '/shipments',
            element: <ShipmentsScreen />
          },
          {
            path: '/shipments/new',
            element: <ShipmentNewScreen />
          },
          {
            path: '/shipments/:id',
            element: <ShipmentDetailScreen />
          },
          {
            path: '/dossiers/:batchId',
            element: <BatchDossierScreen />
          },
          {
            path: '/more',
            element: <MoreScreen />
          },
          {
            path: '/validation',
            element: <ValidationReportScreen />
          },
          {
            path: '/pilot-tools',
            element: <PilotToolsScreen />
          }
        ]
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
])

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />
}
