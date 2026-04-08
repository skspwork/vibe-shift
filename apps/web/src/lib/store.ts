import { create } from "zustand";

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
}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  focusNodeId: null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),

  panToNodeId: null,
  setPanToNodeId: (id) => set({ panToNodeId: id }),

  graphColumns: 2,
  setGraphColumns: (n) => set({ graphColumns: Math.max(1, Math.min(10, n)) }),
}));
