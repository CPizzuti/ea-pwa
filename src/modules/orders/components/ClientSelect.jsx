import { useState, useEffect } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";

export default function ClientSelect({ supplier, onSelect, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, [supplier.id]);

  const loadClients = async () => {
    try {
      const { data } = await api.get(
        `/api/catalogo/fornitori/${supplier.id}/clienti/`
      );
      setClients(data);
    } catch {
      // Fallback demo data
      if (import.meta.env.DEV) {
        setClients([
          { id: 1, name: "Gros", code: "GROS", product_count: 85 },
          { id: 2, name: "Elite", code: "ELITE", product_count: 72 },
          { id: 3, name: "Pac2000", code: "PAC2000", product_count: 68 },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
      >
        <Icon name="ChevronLeft" size={16} />
        Cambia fornitore
      </button>

      <p className="mb-3 text-sm font-medium text-slate-500">
        Clienti per{" "}
        <span className="text-slate-800">{supplier.name}</span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() => onSelect(client)}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-all active:scale-[0.97] active:bg-emerald-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon name="Users" size={22} />
            </div>
            <span className="text-sm font-medium text-slate-800">
              {client.name}
            </span>
            {client.product_count && (
              <span className="text-xs text-slate-400">
                {client.product_count} prodotti
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
