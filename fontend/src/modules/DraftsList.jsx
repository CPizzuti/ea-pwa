import { useState } from "react";
import api from "../../../services/api";
import Icon from "../../../components/Icon";

export default function DraftsList({ drafts, onRemove, onClose, onRefresh }) {
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]); // { key, status, error? }

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === drafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map((d) => d.key)));
    }
  };

  const sendSelected = async () => {
    if (selected.size === 0) return;
    setSending(true);
    const sendResults = [];

    for (const draft of drafts) {
      if (!selected.has(draft.key)) continue;

      try {
        const lines = Object.entries(draft.orderData).map(
          ([productId, values]) => ({
            product_id: parseInt(productId),
            ordine: parseInt(values.ordine) || 0,
            omaggi: parseInt(values.omaggi) || 0,
            promo: values.promo || "",
          })
        );

        await api.post("/api/catalogo/ordini/invia/", {
          supplier_id: draft.supplier?.id,
          client_id: draft.client?.id,
          pv_id: draft.client?.pv_id,
          lines,
          notes: draft.notes || "",
        });

        onRemove(draft.key);
        sendResults.push({ key: draft.key, status: "ok" });
      } catch (err) {
        sendResults.push({
          key: draft.key,
          status: "error",
          error: "Errore nell'invio",
        });
      }
    }

    setResults(sendResults);
    setSending(false);
    setSelected(new Set());
    onRefresh();
  };

  const sentCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  if (results.length > 0 && !sending) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800">
          {sentCount} ordini inviati
        </h2>
        {errorCount > 0 && (
          <p className="mt-1 text-sm text-red-500">
            {errorCount} ordini con errore
          </p>
        )}
        <button
          onClick={() => {
            setResults([]);
            if (drafts.length === 0) onClose();
          }}
          className="mt-6 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          {drafts.length > 0 ? "Torna alle bozze" : "Chiudi"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-slate-500"
        >
          <Icon name="ChevronLeft" size={16} />
          Torna ai fornitori
        </button>
        <span className="text-sm text-slate-500">
          {drafts.length} bozze
        </span>
      </div>

      {/* Select all */}
      <button
        onClick={toggleAll}
        className="mb-3 flex items-center gap-2 text-sm text-emerald-600 font-medium"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border ${
            selected.size === drafts.length && drafts.length > 0
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300"
          }`}
        >
          {selected.size === drafts.length && drafts.length > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
        Seleziona tutti
      </button>

      {/* Draft list */}
      <div className="space-y-2">
        {drafts.map((draft) => {
          const isSelected = selected.has(draft.key);
          const supplierName = draft.supplier?.name || "—";
          const pvName = draft.client?.pv_title || draft.client?.name || "—";
          const pvAddress = draft.client?.pv_address || "";
          const savedDate = draft.savedAt
            ? new Date(draft.savedAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          return (
            <div
              key={draft.key}
              onClick={() => toggleSelect(draft.key)}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                isSelected
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300"
                }`}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {supplierName}
                </p>
                <p className="text-xs text-slate-600 truncate">
                  {pvName}
                  {pvAddress ? ` - ${pvAddress}` : ""}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400">
                    {draft.lineCount} righe
                  </span>
                  {savedDate && (
                    <span className="text-xs text-slate-400">{savedDate}</span>
                  )}
                  {draft.notes && (
                    <span className="text-xs text-emerald-600">con note</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom send bar */}
      {drafts.length > 0 && (
        <div className="sticky bottom-16 z-20 mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-800">
              {selected.size}
            </span>{" "}
            selezionati
          </span>
          <button
            onClick={sendSelected}
            disabled={selected.size === 0 || sending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Icon name="Send" size={16} />
            )}
            Invia selezionati
          </button>
        </div>
      )}
    </div>
  );
}
