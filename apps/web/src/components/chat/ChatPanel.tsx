"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Send, X, MessageCircle } from "lucide-react";
import { NODE_LABELS } from "@cddai/shared";

interface Props {
  projectId: string;
  onNodesCreated: () => void;
}

export function ChatPanel({ projectId, onNodesCreated }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    sessionNodeId,
    sessionType,
    convId,
    chatHistory,
    setConvId,
    addChatMessage,
    clearChat,
    setSession,
  } = useAppStore();

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.chat({
        project_id: projectId,
        message,
        session_type: sessionType,
        node_id: sessionNodeId,
        conv_id: convId,
        history: chatHistory,
      }),
    onSuccess: (data) => {
      if (data.conv_id && !convId) {
        setConvId(data.conv_id);
      }
      addChatMessage({ role: "assistant", content: data.response });
      if (data.created_nodes?.length > 0) {
        onNodesCreated();
      }
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const message = input.trim();
    setInput("");
    addChatMessage({ role: "user", content: message });
    chatMutation.mutate(message);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b bg-gray-50">
        {sessionNodeId && sessionType === "node_session" ? (
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium text-blue-600">セッション中</span>
            </div>
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">新規会話</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8">
            メッセージを入力してAIと会話を開始
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap text-xs">{msg.content}</div>
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="text-left">
            <div className="inline-block bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-400">
              考え中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            disabled={chatMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
