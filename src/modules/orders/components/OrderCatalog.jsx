import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";
import { useAuth } from "../../../contexts/AuthContext";

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function OrderCatalog({ supplier, client, onBack, onReset }) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState({});
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const scrollRef = useRef(null);

  const draftKey = `draft_${user?.id || 0}_${supplier.id}_${client.id}`;

  useEffect(() => {
    loadCatalog();
  }, [supplier.id, client.id]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        setOrderData(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, [draftKey]);

  useEffect(() => {
    if (Object.keys(orderData).length > 0) {
      localStorage.setItem(draftKey, JSON.stringify(orderData));
    }
  }, [orderData, draftKey]);

  const loadCatalog = async () => {
    try {
      const { data } = await api.get(`/api/catalogo/${client.id}/`);
      setCatalog(data);
    } catch {
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((productId, field, value) => {
    setOrderData((prev) => {
      const current = prev[productId] || {};
      const updated = { ...current, [field]: value };
      if (!updated.ordine && !updated.omaggi && !updated.promo) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: updated };
    });
  }, []);

  const filledLines = useMemo(
    () => Object.keys(orderData).length,
    [orderData]
  );

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
      localStorage.removeItem(draftKey);
      onReset();
    } catch {
      if (!navigator.onLine) {
        alert("Nessuna connessione. L'ordine è salvato come bozza e verrà inviato quando tornerà la rete.");
      } else {
        alert("Errore nell'invio. L'ordine è stato salvato come bozza.");
      }
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
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-slate-500 mb-4">Catalogo non disponibile</p>
        <button
          onClick={onReset}
          className="text-sm text-emerald-600 font-medium"
        >
          Torna alla selezione
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
        >
          <Icon name="ChevronLeft" size={16} />
          Indietro
        </button>
        <div className="text-center flex-1">
          <p className="text-sm font-medium text-slate-800">{supplier.name}</p>
          <p className="text-xs text-slate-500">{client.name}</p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
        >
          <Icon name="Home" size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
        <span>Quantità</span>
        <span>Omaggi</span>
        <span>Promo</span>
      </div>

      {/* Catalog */}
      <div ref={scrollRef} className="flex-1">
        {filteredCategories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <div
              className="sticky top-[33px] z-[5] border-b border-white/50 px-4 py-2"
              style={{ backgroundColor: hexToRgba(category.color, 0.25) }}
            >
              <span className="text-xs font-semibold" style={{ color: category.color !== "#10B981" ? undefined : "var(--color-slate-700)" }}>
                {category.name}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                ({category.products.length})
              </span>
            </div>

            {/* Product rows with category background */}
            {category.products.map((product) => {
              const data = orderData[product.id] || {};
              const hasValue = data.ordine || data.omaggi || data.promo;

              return (
                <div
                  key={product.id}
                  className="grid grid-cols-[1fr_64px_64px_64px] items-center gap-1 border-b border-white/30 px-4 py-2"
                  style={{
                    backgroundColor: hasValue
                      ? hexToRgba(category.color, 0.15)
                      : hexToRgba(category.color, 0.06),
                  }}
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm text-slate-800 leading-tight">
                      {product.description}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {product.code}
                      {product.qxc ? ` · QxC ${product.qxc}` : ""}
                    </p>
                  </div>

                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={data.ordine || ""}
                    onChange={(e) => updateField(product.id, "ordine", e.target.value)}
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.ordine
                        ? "border-emerald-400 bg-white font-medium text-emerald-800"
                        : "border-slate-200 bg-white/80 text-slate-800"
                    }`}
                  />

                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={data.omaggi || ""}
                    onChange={(e) => updateField(product.id, "omaggi", e.target.value)}
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.omaggi
                        ? "border-emerald-400 bg-white font-medium text-emerald-800"
                        : "border-slate-200 bg-white/80 text-slate-800"
                    }`}
                  />

                  <input
                    type="text"
                    inputMode="text"
                    placeholder="—"
                    value={data.promo || ""}
                    onChange={(e) => updateField(product.id, "promo", e.target.value)}
                    className={`w-full rounded-lg border px-1 py-2 text-center text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 ${
                      data.promo
                        ? "border-emerald-400 bg-white font-medium text-emerald-800"
                        : "border-slate-200 bg-white/80 text-slate-800"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
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
