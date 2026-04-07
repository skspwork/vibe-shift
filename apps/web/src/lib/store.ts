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

}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  focusNodeId: null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),

  panToNodeId: null,
  setPanToNodeId: (id) => set({ panToNodeId: id }),
}));
