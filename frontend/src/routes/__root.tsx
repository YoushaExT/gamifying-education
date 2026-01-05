import type { QueryClient } from "@tanstack/react-query"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Suspense } from "react"

import NotFound from "@/components/Common/NotFound"

interface RouterContext {
  queryClient: QueryClient
}

// const _loadDevtools = () =>
//   Promise.all([
//     import("@tanstack/router-devtools"),
//     import("@tanstack/react-query-devtools"),
//   ]).then(([routerDevtools, reactQueryDevtools]) => {
//     return {
//       default: () => (
//         <>
//           <routerDevtools.TanStackRouterDevtools />
//           <reactQueryDevtools.ReactQueryDevtools />
//         </>
//       ),
//     }
//   })

const TanStackDevtools = () => null
// process.env.NODE_ENV === "production" ? () => null : React.lazy(loadDevtools)

export const Route = createRootRoute<RouterContext>({
  component: () => (
    <>
      <Outlet />
      <Suspense>
        <TanStackDevtools />
      </Suspense>
    </>
  ),
  notFoundComponent: () => <NotFound />,
})
