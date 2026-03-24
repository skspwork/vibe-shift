import { create } from "zustand";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionNodeInfo {
  id: string;
  type: string;
  title: string;
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
  sessionNodeInfo: SessionNodeInfo | null;
  sessionType: "overview" | "node_session";
  convId: string | null;
  chatHistory: ChatMessage[];
  setSession: (
    nodeId: string | null,
    type: "overview" | "node_session",
    nodeInfo?: SessionNodeInfo | null
  ) => void;
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
  sessionNodeInfo: null,
  sessionType: "overview",
  convId: null,
  chatHistory: [],
  setSession: (nodeId, type, nodeInfo = null) =>
    set({
      sessionNodeId: nodeId,
      sessionNodeInfo: nodeInfo,
      sessionType: type,
      convId: null,
      chatHistory: [],
    }),
  setConvId: (id) => set({ convId: id }),
  addChatMessage: (msg) =>
    set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  clearChat: () =>
    set({
      sessionNodeId: null,
      sessionNodeInfo: null,
      sessionType: "overview",
      convId: null,
      chatHistory: [],
    }),
}));
