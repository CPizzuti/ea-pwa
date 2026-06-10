import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";
import { useAuth } from "../../../contexts/AuthContext";

/**
 * OrderCatalog — The heart of the Copia Commissione
 *
 * Displays the full product catalog for a supplier/client pair,
 * grouped by category. The agent fills in Ordine (qty), Omaggi
 * (freebies), and Promo (discount) per product row.
 *
 * Optimized for tablet touch input:
 * - Large touch targets on inputs
 * - inputmode="numeric" opens number pad
 * - Visual feedback on filled rows
 * - Sticky category headers while scrolling
 * - Bottom bar with live line count and send button
 */

// Demo catalog data — used when backend API is not yet implemented
const DEMO_CATALOG = {
  categories: [
    {
      id: 1,
      name: "Tisane a caldo",
      color: "#7DEC18",
      products: [
        { id: 1, description: "Tisana Linea 18 filtri", code: "GA1992900", ean: "8002890025388", qxc: 10, weight: "" },
        { id: 2, description: "Tisana della Sera 18 filtri", code: "GA1993000", ean: "8002890025395", qxc: 10, weight: "" },
        { id: 3, description: "Tisana Dopo Pasto 18 filtri", code: "GA1993100", ean: "8002890025401", qxc: 10, weight: "" },
        { id: 4, description: "Tisana Calma Colon 18 filtri", code: "GA1997900", ean: "8002890027115", qxc: 10, weight: "" },
        { id: 5, description: "Tisana Giusta Regola ACT 18 filtri", code: "GA2153500", ean: "8002890034236", qxc: 10, weight: "" },
        { id: 6, description: "Tisana Ventre Piatto 18 filtri", code: "GA1993400", ean: "8002890025432", qxc: 10, weight: "" },
      ],
    },
    {
      id: 2,
      name: "Camomille",
      color: "#59D559",
      products: [
        { id: 7, description: "Camomilla Setaciata 18 filtri", code: "GA1993600", ean: "8002890025456", qxc: 10, weight: "" },
        { id: 8, description: "Camomilla Miele 18 filtri", code: "GA1993700", ean: "8002890025463", qxc: 10, weight: "" },
        { id: 9, description: "Camomilla Solubile 16 bustine", code: "GA2027700", ean: "8002890029461", qxc: 6, weight: "" },
      ],
    },
    {
      id: 3,
      name: "Integratori",
      color: "#5B9BD5",
      products: [
        { id: 10, description: "Melatonina Pura 60 cpr", code: "GA2184200", ean: "8002890036513", qxc: 6, weight: "" },
        { id: 11, description: "Magnesio Supremo 150g", code: "GA2184300", ean: "8002890036520", qxc: 6, weight: "" },
      ],
    },
  ],
};

export default function OrderCatalog({ supplier, client, onBack, onReset }) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState({}); // { productId: { ordine, omaggi, promo } }
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const scrollRef = useRef(null);

  // Draft key namespaced by user to prevent cross-agent collisions on shared tablets
  const draftKey = `draft_${user?.id || 0}_${supplier.id}_${client.id}`;

  useEffect(() => {
    loadCatalog();
  }, [supplier.id, client.id]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        setOrderData(JSON.parse(saved));
      } catch {
        /* ignore corrupt data */
      }
    }
  }, [supplier.id, client.id]);

  // Auto-save draft to localStorage on changes
  useEffect(() => {
    if (Object.keys(orderData).length > 0) {
      localStorage.setItem(draftKey, JSON.stringify(orderData));
    }
  }, [orderData, draftKey]);

  const loadCatalog = async () => {
    try {
      const { data } = await api.get(
        `/api/catalogo/${supplier.id}/${client.id}/`
      );
      setCatalog(data);
    } catch {
      if (import.meta.env.DEV) {
        setCatalog(DEMO_CATALOG);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((productId, field, value) => {
    setOrderData((prev) => {
      const current = prev[productId] || {};
      const updated = { ...current, [field]: value };

      // Remove entry if all fields are empty
      if (!updated.ordine && !updated.omaggi && !updated.promo) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }

      return { ...prev, [productId]: updated };
    });
  }, []);

  // Count filled lines
  const filledLines = useMemo(
    () => Object.keys(orderData).length,
    [orderData]
  );

  // Filter products by search term
  const filteredCategories = useMemo(() => {
    if (!catalog?.categories) return [];
    if (!searchFilter) return catalog.categories;

    return catalog.categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            p.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
            p.code?.toLowerCase().includes(searchFilter.toLowerCase()) ||
            p.ean?.includes(searchFilter)
        ),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [catalog, searchFilter]);

  const handleSend = async () => {
    if (filledLines === 0) return;

    setSending(true);
    try {
      // Build the order payload
      const lines = Object.entries(orderData).map(([productId, values]) => ({
        product_id: parseInt(productId),
        ordine: parseInt(values.ordine) || 0,
        omaggi: parseInt(values.omaggi) || 0,
        promo: values.promo || "",
      }));

      await api.post("/api/catalogo/ordini/invia/", {
        supplier_id: supplier.id,
        client_id: client.id,
        lines,
      });

      // Clear draft on success
      localStorage.removeItem(draftKey);

      // Reset and go back
      onReset();
    } catch {
      // Phase 1 fallback: generate email
      alert(
        "Invio diretto non disponibile.\nL'ordine è stato salvato come bozza."
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-500">
        Catalogo non disponibile
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header with context */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
        >
          <Icon name="ChevronLeft" size={16} />
          Indietro
        </button>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-800">
            {supplier.name}
          </p>
          <p className="text-xs text-slate-500">{client.name}</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Icon
            name="Search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Cerca prodotto..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_64px_64px_64px] gap-1 border-b border-slate-300 bg-slate-100 px-4 py-2 text-center text-xs font-medium text-slate-500">
        <span className="text-left">Prodotto</span>
        <span>Ordine</span>
        <span>Omaggi</span>
        <span>Promo</span>
      </div>

      {/* Scrollable catalog */}
      <div ref={scrollRef} className="flex-1">
        {filteredCategories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <div className="sticky top-[33px] z-[5] flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-xs font-medium text-slate-700">
                {category.name}
              </span>
              <span className="text-xs text-slate-400">
                ({category.products.length})
              </span>
            </div>

            {/* Product rows */}
            {category.products.map((product) => {
              const data = orderData[product.id] || {};
              const hasValue = data.ordine || data.omaggi || data.promo;

              return (
                <div
                  key={product.id}
                  className={`grid grid-cols-[1fr_64px_64px_64px] items-center gap-1 border-b border-slate-100 px-4 py-2 transition-colors ${
                    hasValue ? "bg-emerald-50/50" : ""
                  }`}
                >
                  {/* Product info */}
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm text-slate-800 leading-tight">
                      {product.description}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {product.code}
                      {product.qxc ? ` · QxC ${product.qxc}` : ""}
                    </p>
                  </div>

                  {/* Ordine */}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={data.ordine || ""}
                    onChange={(e) =>
                      updateField(product.id, "ordine", e.target.value)
                    }
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.ordine
                        ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  />

                  {/* Omaggi */}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={data.omaggi || ""}
                    onChange={(e) =>
                      updateField(product.id, "omaggi", e.target.value)
                    }
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.omaggi
                        ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  />

                  {/* Promo */}
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="—"
                    value={data.promo || ""}
                    onChange={(e) =>
                      updateField(product.id, "promo", e.target.value)
                    }
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.promo
                        ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-16 z-20 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{filledLines}</span>
          {" "}righe compilate
        </div>
        <button
          onClick={handleSend}
          disabled={filledLines === 0 || sending}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Icon name="Send" size={16} />
          )}
          Invia ordine
        </button>
      </div>
    </div>
  );
}
