import { lazy } from "react";

/**
 * Module Registry
 * ===============
 * Each module is a self-contained feature of the agent PWA.
 * The backend returns which module IDs are enabled for the logged-in agent.
 * Only enabled modules appear in the bottom nav and are routable.
 *
 * To add a new module:
 * 1. Create a folder under src/modules/<name>/
 * 2. Add the entry below with a lazy() import
 * 3. The module will auto-appear when the backend enables it
 */

const MODULE_REGISTRY = {
  orders: {
    id: "orders",
    label: "Ordini",
    icon: "ClipboardList",
    path: "/ordini",
    component: lazy(() => import("../modules/orders/pages/OrdersIndex")),
  },
  clients: {
    id: "clients",
    label: "Clienti",
    icon: "Users",
    path: "/clienti",
    component: lazy(() => import("../modules/clients/ClientsIndex")),
  },
  map: {
    id: "map",
    label: "Mappa",
    icon: "MapPin",
    path: "/mappa",
    component: lazy(() => import("../modules/map/MapIndex")),
  },
  stats: {
    id: "stats",
    label: "Statistiche",
    icon: "BarChart3",
    path: "/statistiche",
    component: lazy(() => import("../modules/stats/StatsIndex")),
  },
};

/**
 * Given an array of enabled module IDs from the backend,
 * return the matching module configs in display order.
 */
export function getEnabledModules(enabledIds = []) {
  return enabledIds
    .map((id) => MODULE_REGISTRY[id])
    .filter(Boolean);
}

/**
 * Fallback: if backend doesn't return modules yet,
 * default to only the orders module.
 */
export const DEFAULT_MODULES = ["orders"];

export default MODULE_REGISTRY;
