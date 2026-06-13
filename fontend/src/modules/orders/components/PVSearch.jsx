import { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";

export default function PVSearch({ supplier, onSelect, onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      searchPV(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, supplier.id]);

  const searchPV = async (q) => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get(
        `/api/pv/search/?q=${encodeURIComponent(q)}&supplier_id=${supplier.id}`
      );
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback((pv) => {
    if (!pv.has_catalog) return;
    onSelect({
      id: pv.catalog_id,
      name: pv.title,
      pv_id: pv.id,
      pv_title: pv.title,
      pv_address: pv.address,
      pv_city: pv.city,
      gruppo: pv.gruppo,
      insegna: pv.insegna,
    });
  }, [onSelect]);

  return (
    <div className="px-4">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
      >
        <Icon name="ChevronLeft" size={16} />
        Cambia fornitore
      </button>

      <p className="mb-1 text-sm font-medium text-slate-500">
        Cerca punto vendita per{" "}
        <span className="text-slate-800">{supplier.name}</span>
      </p>
      <p className="mb-3 text-xs text-slate-400">
        Cerca per nome, indirizzo o città
      </p>

      {/* Search input */}
      <div className="relative mb-4">
        <Icon
          name="Search"
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          autoFocus
          placeholder="Es. DESA, Via Maremmana, Tivoli..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-2">
        {results.map((pv) => (
          <button
            key={pv.id}
            onClick={() => handleSelect(pv)}
            disabled={!pv.has_catalog}
            className={`w-full rounded-xl border p-3 text-left transition-all ${
              pv.has_catalog
                ? "border-slate-200 bg-white active:scale-[0.98] active:bg-emerald-50"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 leading-tight">
                  {pv.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pv.address}{pv.city ? `, ${pv.city}` : ""}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {pv.gruppo && (
                    <span className="text-xs text-slate-400">
                      {pv.gruppo}
                    </span>
                  )}
                  {pv.insegna && (
                    <span className="text-xs text-slate-400">
                      {pv.insegna}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 mt-0.5">
                {pv.has_catalog ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Disponibile
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    Non disponibile
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Empty states */}
      {searched && !loading && results.length === 0 && query.length >= 2 && (
        <p className="py-8 text-center text-sm text-slate-400">
          Nessun punto vendita trovato per "{query}"
        </p>
      )}

      {!searched && (
        <p className="py-8 text-center text-sm text-slate-400">
          Digita almeno 2 caratteri per cercare
        </p>
      )}
    </div>
  );
}
