import { create } from "zustand";

function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

interface AppState {
  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Focus mode
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;

  // Pan to node (search-triggered only)
  panToNodeId: string | null;
  setPanToNodeId: (id: string | null) => void;

  // Graph columns
  graphColumns: number;
  setGraphColumns: (n: number) => void;

  // Show disabled nodes
  showDisabledNodes: boolean;
  setShowDisabledNodes: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  focusNodeId: null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),

  panToNodeId: null,
  setPanToNodeId: (id) => set({ panToNodeId: id }),

  graphColumns: loadNumber("vibeshift:graphColumns", 3),
  setGraphColumns: (n) => {
    const v = Math.max(1, Math.min(10, n));
    localStorage.setItem("vibeshift:graphColumns", String(v));
    set({ graphColumns: v });
  },

  showDisabledNodes: false,
  setShowDisabledNodes: (v) => set({ showDisabledNodes: v }),
}));
