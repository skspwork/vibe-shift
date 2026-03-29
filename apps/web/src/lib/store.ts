import { create } from "zustand";

interface AppState {
  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Focus mode
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;

  // Lane filter
  hiddenLanes: Set<string>;
  toggleLane: (lane: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  focusNodeId: null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),

  hiddenLanes: new Set<string>(),
  toggleLane: (lane) =>
    set((state) => {
      const next = new Set(state.hiddenLanes);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return { hiddenLanes: next };
    }),
}));
