import { create } from "zustand";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AppState {
  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Focus mode
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;

  // Chat session
  sessionNodeId: string | null;
  sessionType: "overview" | "node_session";
  convId: string | null;
  chatHistory: ChatMessage[];
  setSession: (nodeId: string | null, type: "overview" | "node_session") => void;
  setConvId: (id: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  focusNodeId: null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),

  sessionNodeId: null,
  sessionType: "overview",
  convId: null,
  chatHistory: [],
  setSession: (nodeId, type) =>
    set({ sessionNodeId: nodeId, sessionType: type, convId: null, chatHistory: [] }),
  setConvId: (id) => set({ convId: id }),
  addChatMessage: (msg) =>
    set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  clearChat: () =>
    set({ sessionNodeId: null, sessionType: "overview", convId: null, chatHistory: [] }),
}));
