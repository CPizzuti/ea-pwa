import { useState, useEffect } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";

export default function SupplierSelect({ onSelect }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data } = await api.get("/api/catalogo/fornitori/");
      setSuppliers(data);
    } catch (err) {
      setError("Impossibile caricare i fornitori");
      // Fallback: use demo data for development
      if (import.meta.env.DEV) {
        setSuppliers([
          { id: 1, name: "COSWELL HF", icon: "Package", client_count: 3 },
          { id: 2, name: "D&C", icon: "Package", client_count: 3 },
          { id: 3, name: "EUROFOOD", icon: "Package", client_count: 2 },
          { id: 4, name: "INTERBRAU", icon: "Package", client_count: 2 },
          { id: 5, name: "ALMO NATURE", icon: "Package", client_count: 1 },
          { id: 6, name: "FINI", icon: "Package", client_count: 1 },
          { id: 7, name: "NOBERASCO", icon: "Package", client_count: 1 },
          { id: 8, name: "RHUTTEN", icon: "Package", client_count: 1 },
          { id: 9, name: "N&S", icon: "Package", client_count: 1 },
          { id: 10, name: "MANIA", icon: "Package", client_count: 1 },
        ]);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4">
      <p className="mb-3 text-sm font-medium text-slate-500">
        Seleziona fornitore
      </p>

      {/* Search bar */}
      {suppliers.length > 6 && (
        <div className="relative mb-4">
          <Icon
            name="Search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Cerca fornitore..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Supplier grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((supplier) => (
          <button
            key={supplier.id}
            onClick={() => onSelect(supplier)}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-all active:scale-[0.97] active:bg-emerald-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name={supplier.icon || "Package"} size={22} />
            </div>
            <span className="text-sm font-medium text-slate-800 leading-tight">
              {supplier.name}
            </span>
            {supplier.client_count && (
              <span className="text-xs text-slate-400">
                {supplier.client_count} clienti
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          Nessun fornitore trovato
        </p>
      )}
    </div>
  );
}
