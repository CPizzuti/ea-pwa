import { useState, useCallback } from "react";
import SupplierSelect from "../components/SupplierSelect";
import ClientSelect from "../components/ClientSelect";
import OrderCatalog from "../components/OrderCatalog";

/**
 * Orders module — Copia Commissione
 *
 * Three-step flow:
 * 1. Select supplier (Fornitore)
 * 2. Select client (Cliente GDO)
 * 3. Fill order quantities in the product catalog
 *
 * State is local to this module. Each step transition
 * preserves the previous selection.
 */

const STEPS = { SUPPLIER: 0, CLIENT: 1, CATALOG: 2 };

export default function OrdersIndex() {
  const [step, setStep] = useState(STEPS.SUPPLIER);
  const [supplier, setSupplier] = useState(null);
  const [client, setClient] = useState(null);

  const handleSupplierSelect = useCallback((s) => {
    setSupplier(s);
    setStep(STEPS.CLIENT);
  }, []);

  const handleClientSelect = useCallback((c) => {
    setClient(c);
    setStep(STEPS.CATALOG);
  }, []);

  const handleBack = useCallback(() => {
    if (step === STEPS.CLIENT) {
      setClient(null);
      setStep(STEPS.SUPPLIER);
    } else if (step === STEPS.CATALOG) {
      setClient(null);
      setStep(STEPS.CLIENT);
    }
  }, [step]);

  const handleReset = useCallback(() => {
    setSupplier(null);
    setClient(null);
    setStep(STEPS.SUPPLIER);
  }, []);

  return (
    <div className="min-h-full">
      {/* Step indicator */}
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

      {step === STEPS.SUPPLIER && (
        <SupplierSelect onSelect={handleSupplierSelect} />
      )}

      {step === STEPS.CLIENT && (
        <ClientSelect
          supplier={supplier}
          onSelect={handleClientSelect}
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
    </div>
  );
}
