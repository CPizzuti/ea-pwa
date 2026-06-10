import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import BottomNav from "./BottomNav";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}

export default function AppShell({ modules }) {
  const { user, organization, logout } = useAuth();

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      {/* Top bar */}
      <header
        className="flex shrink-0 items-center justify-between bg-emerald-600 px-4 py-3 text-white"
        style={{ paddingTop: "calc(var(--sat, 0px) + 12px)" }}
      >
        <div>
          <h1 className="text-base font-semibold leading-tight">
            {organization?.name || "Evoluzione Agenti"}
          </h1>
          {user && (
            <p className="text-xs text-emerald-100 leading-tight">
              {user.full_name || user.username}
            </p>
          )}
        </div>
        <button
          onClick={logout}
          className="rounded-lg p-2 text-emerald-100 transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          aria-label="Esci"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom navigation */}
      <BottomNav modules={modules} />
    </div>
  );
}
