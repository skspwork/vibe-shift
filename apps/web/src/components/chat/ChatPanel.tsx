"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Send, X, MessageCircle, StopCircle } from "lucide-react";
import { NODE_LABELS } from "@cddai/shared";
import { Markdown } from "../ui/Markdown";

interface Props {
  projectId: string;
  onNodesCreated: () => void;
}

export function ChatPanel({ projectId, onNodesCreated }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    sessionNodeId,
    sessionNodeInfo,
    sessionType,
    conversationId,
    chatHistory,
    setConversationId,
    addChatMessage,
    clearChat,
  } = useAppStore();

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.chat({
        project_id: projectId,
        message,
        session_type: sessionType,
        node_id: sessionNodeId,
        conversation_id: conversationId,
        history: chatHistory,
      }),
    onSuccess: (data) => {
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }
      addChatMessage({ role: "assistant", content: data.response });
      if (data.created_nodes?.length > 0) {
        onNodesCreated();
      }
    },
    onError: (error) => {
      addChatMessage({
        role: "assistant",
        content: `エラーが発生しました: ${error.message}`,
      });
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

  const isNodeSession = sessionNodeId && sessionType === "node_session";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b bg-gray-50">
        {isNodeSession && sessionNodeInfo ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">
                セッション中
              </span>
              <button
                onClick={clearChat}
                title="セッションを終了"
                className="text-gray-400 hover:text-red-500 transition"
              >
                <StopCircle size={16} />
              </button>
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">
                {NODE_LABELS[sessionNodeInfo.type] || sessionNodeInfo.type}
              </span>
              : {sessionNodeInfo.title}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">
              {chatHistory.length > 0 ? "コンサルタント" : "新規会話"}
            </span>
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                title="会話をリセット"
                className="ml-auto text-gray-400 hover:text-red-500 transition"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8 space-y-2">
            <MessageCircle size={24} className="mx-auto opacity-50" />
            <p>
              {isNodeSession
                ? "このノードについてAIと対話を開始してください"
                : "要望や質問を入力してコンサルタントと会話を開始"}
            </p>
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
              <Markdown className="text-xs leading-relaxed">
                {formatMessage(msg.content)}
              </Markdown>
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="text-left">
            <div className="inline-block bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="animate-pulse">●</span> 考え中...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Created nodes notification */}

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
            placeholder={
              isNodeSession
                ? `${NODE_LABELS[sessionNodeInfo?.type || ""] || "ノード"}について質問...`
                : "要望や質問を入力..."
            }
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

/** Strip ```json blocks from display and show a cleaner message */
function formatMessage(content: string): string {
  // Replace JSON code blocks with a summary
  return content.replace(
    /```json\s*\{[\s\S]*?"nodes"\s*:\s*\[([\s\S]*?)\][\s\S]*?\}[\s\S]*?```/g,
    (_, nodesContent) => {
      try {
        const nodesPart = `[${nodesContent}]`;
        const nodes = JSON.parse(nodesPart);
        const summary = nodes
          .map(
            (n: any) =>
              `  ✅ [${NODE_LABELS[n.type] || n.type}] ${n.title}`
          )
          .join("\n");
        return `\n📋 以下のノードを登録しました:\n${summary}\n`;
      } catch {
        return content;
      }
    }
  );
}
