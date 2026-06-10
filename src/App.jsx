import { useMemo } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { getEnabledModules, DEFAULT_MODULES } from "./config/modules";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";

function AppRoutes() {
  const { user, loading } = useAuth();

  // Get modules enabled for this agent (from user profile or defaults)
  const enabledModules = useMemo(() => {
    if (!user) return [];
    const moduleIds = user.enabled_modules || DEFAULT_MODULES;
    return getEnabledModules(moduleIds);
  }, [user]);

  // First enabled module path — used as default redirect
  const defaultPath = enabledModules[0]?.path || "/ordini";

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell modules={enabledModules} />}>
        {/* Dynamic module routes */}
        {enabledModules.map((mod) => (
          <Route key={mod.id} path={mod.path} element={<mod.component />} />
        ))}

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={defaultPath} replace />} />
        <Route path="/login" element={<Navigate to={defaultPath} replace />} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
