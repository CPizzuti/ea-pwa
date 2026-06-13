import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const DRAFT_PREFIX = "draft_";

/**
 * Hook to manage order drafts in localStorage.
 * Each draft stores: orderData, notes, supplier info, client/PV info, timestamp.
 */
export function useDrafts() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);

  const userId = user?.id || 0;

  // Scan localStorage for all drafts belonging to this user
  const refreshDrafts = useCallback(() => {
    const found = [];
    const prefix = `${DRAFT_PREFIX}${userId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data && data.orderData && Object.keys(data.orderData).length > 0) {
            found.push({
              key,
              ...data,
              lineCount: Object.keys(data.orderData).length,
            });
          }
        } catch {
          // ignore corrupt data
        }
      }
    }

    // Sort by timestamp, newest first
    found.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    setDrafts(found);
  }, [userId]);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  // Save a draft with full metadata
  const saveDraft = useCallback(
    (supplierId, clientId, data) => {
      const key = `${DRAFT_PREFIX}${userId}_${supplierId}_${clientId}`;
      const payload = {
        ...data,
        savedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      refreshDrafts();
    },
    [userId, refreshDrafts]
  );

  // Get a specific draft
  const getDraft = useCallback(
    (supplierId, clientId) => {
      const key = `${DRAFT_PREFIX}${userId}_${supplierId}_${clientId}`;
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    [userId]
  );

  // Remove a draft
  const removeDraft = useCallback(
    (supplierId, clientId) => {
      const key = `${DRAFT_PREFIX}${userId}_${supplierId}_${clientId}`;
      localStorage.removeItem(key);
      refreshDrafts();
    },
    [userId, refreshDrafts]
  );

  // Remove by key directly
  const removeDraftByKey = useCallback(
    (key) => {
      localStorage.removeItem(key);
      refreshDrafts();
    },
    [refreshDrafts]
  );

  return {
    drafts,
    draftCount: drafts.length,
    saveDraft,
    getDraft,
    removeDraft,
    removeDraftByKey,
    refreshDrafts,
  };
}
