"use client";

import { useState } from "react";
import { MessageCircle, ChevronDown, ChevronUp, User, Bot } from "lucide-react";

interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  conversation: {
    id: string;
    title: string;
    created_at: string;
  };
  messages: ConvMessage[];
}

export function ConvLogViewer({ conversation, messages }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
      {/* Summary header */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-blue-700 font-medium text-xs mb-1">
          <MessageCircle size={13} />
          AIセッション「{conversation.title}」
        </div>
        <div className="text-[11px] text-gray-500 mb-1.5">
          {new Date(conversation.created_at).toLocaleString("ja-JP")}
        </div>

        {/* Preview: first 2 messages */}
        {!expanded &&
          messages.slice(0, 2).map((msg, i) => (
            <p key={i} className="text-gray-600 text-[11px] truncate leading-4">
              <span className="font-medium">
                {msg.role === "user" ? "ユーザー" : "AI"}:
              </span>{" "}
              {msg.content.substring(0, 80)}
              {msg.content.length > 80 ? "..." : ""}
            </p>
          ))}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-blue-500 text-[11px] mt-1.5 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> 閉じる
            </>
          ) : (
            <>
              <ChevronDown size={12} /> 全文を見る（{messages.length}件）
            </>
          )}
        </button>
      </div>

      {/* Full conversation log */}
      {expanded && (
        <div className="border-t border-blue-200 bg-white max-h-80 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`px-3 py-2 text-xs ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {msg.role === "user" ? (
                  <User size={12} className="text-blue-500" />
                ) : (
                  <Bot size={12} className="text-green-600" />
                )}
                <span className="font-medium text-gray-700">
                  {msg.role === "user" ? "ユーザー" : "AI"}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-gray-600 leading-relaxed pl-5">
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
