import { useState, useCallback } from "react";
import SupplierSelect from "../components/SupplierSelect";
import PVSearch from "../components/PVSearch";
import OrderCatalog from "../components/OrderCatalog";
import DraftsList from "../components/DraftsList";
import { useDrafts } from "../../../hooks/useDrafts";
import Icon from "../../../components/Icon";

const STEPS = { SUPPLIER: 0, PV: 1, CATALOG: 2, DRAFTS: 3 };

export default function OrdersIndex() {
  const [step, setStep] = useState(STEPS.SUPPLIER);
  const [supplier, setSupplier] = useState(null);
  const [client, setClient] = useState(null);
  const { drafts, draftCount, removeDraftByKey, refreshDrafts } = useDrafts();

  const handleSupplierSelect = useCallback((s) => {
    setSupplier(s);
    setStep(STEPS.PV);
  }, []);

  const handlePVSelect = useCallback((c) => {
    setClient(c);
    setStep(STEPS.CATALOG);
  }, []);

  const handleBack = useCallback(() => {
    if (step === STEPS.PV) {
      setClient(null);
      setStep(STEPS.SUPPLIER);
    } else if (step === STEPS.CATALOG) {
      setClient(null);
      setStep(STEPS.PV);
    } else if (step === STEPS.DRAFTS) {
      setStep(STEPS.SUPPLIER);
    }
  }, [step]);

  const handleReset = useCallback(() => {
    setSupplier(null);
    setClient(null);
    setStep(STEPS.SUPPLIER);
    refreshDrafts();
  }, [refreshDrafts]);

  return (
    <div className="min-h-full">
      {/* Step indicator (hide for drafts view) */}
      {step !== STEPS.DRAFTS && (
        <div className="flex items-center justify-center gap-2 py-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-emerald-500"
                  : i < step
                    ? "w-1.5 bg-emerald-500"
                    : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}

      {/* Drafts banner — only on supplier select screen */}
      {step === STEPS.SUPPLIER && draftCount > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setStep(STEPS.DRAFTS)}
            className="w-full flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 active:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Icon name="FileText" size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-amber-800">
                  {draftCount} {draftCount === 1 ? "ordine" : "ordini"} da
                  spedire
                </p>
                <p className="text-xs text-amber-600">
                  Tocca per inviare
                </p>
              </div>
            </div>
            <Icon name="ChevronRight" size={18} className="text-amber-400" />
          </button>
        </div>
      )}

      {step === STEPS.SUPPLIER && (
        <SupplierSelect onSelect={handleSupplierSelect} />
      )}

      {step === STEPS.PV && (
        <PVSearch
          supplier={supplier}
          onSelect={handlePVSelect}
          onBack={handleBack}
        />
      )}

      {step === STEPS.CATALOG && (
        <OrderCatalog
          supplier={supplier}
          client={client}
          onBack={handleBack}
          onReset={handleReset}
        />
      )}

      {step === STEPS.DRAFTS && (
        <DraftsList
          drafts={drafts}
          onRemove={removeDraftByKey}
          onClose={() => {
            refreshDrafts();
            setStep(STEPS.SUPPLIER);
          }}
          onRefresh={refreshDrafts}
        />
      )}
    </div>
  );
}
