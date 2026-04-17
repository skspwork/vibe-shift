import { create } from "zustand";

function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

interface AppState {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  columns: number;
  setColumns: (n: number) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  collapseAll: number;
  expandAll: number;
  triggerCollapseAll: () => void;
  triggerExpandAll: () => void;

  showDisabledNodes: boolean;
  setShowDisabledNodes: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  columns: loadNumber("vibeshift:columns", 1),
  setColumns: (n) => {
    const v = Math.max(1, Math.min(4, n));
    localStorage.setItem("vibeshift:columns", String(v));
    set({ columns: v });
  },

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  collapseAll: 0,
  expandAll: 0,
  triggerCollapseAll: () => set((s) => ({ collapseAll: s.collapseAll + 1 })),
  triggerExpandAll: () => set((s) => ({ expandAll: s.expandAll + 1 })),

  showDisabledNodes: false,
  setShowDisabledNodes: (v) => set({ showDisabledNodes: v }),
}));
