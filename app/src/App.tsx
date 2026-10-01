import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { NewProject } from "./pages/NewProject";
import { ProjectPage } from "./pages/ProjectPage";
import { SettingsPage } from "./pages/SettingsPage";

// Charts (recharts) only load on the System page.
const SystemPage = lazy(() => import("./pages/SystemPage").then((m) => ({ default: m.SystemPage })));

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/projects/:slug", element: <ProjectPage /> },
      { path: "/new", element: <NewProject /> },
      {
        path: "/system",
        element: (
          <Suspense fallback={<div className="h-64 rounded-2xl glass animate-pulse" />}>
            <SystemPage />
          </Suspense>
        ),
      },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
