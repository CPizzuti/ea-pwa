import { NavLink } from "react-router-dom";
import Icon from "./Icon";

export default function BottomNav({ modules }) {
  if (!modules || modules.length === 0) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white"
      style={{ paddingBottom: "var(--sab, 0px)" }}
    >
      <div className="flex items-stretch justify-around">
        {modules.map((mod) => (
          <NavLink
            key={mod.id}
            to={mod.path}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive
                  ? "text-emerald-600 font-medium"
                  : "text-slate-400"
              }`
            }
          >
            <Icon name={mod.icon} size={22} />
            <span>{mod.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
