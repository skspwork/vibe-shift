"use client";

import { ConvLogViewer } from "./ConvLogViewer";

interface ConvEntry {
  conversation: { id: string; title: string; created_at: string };
  purpose: string;
  linked_at: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

interface Props {
  node: any;
  convDataList: ConvEntry[];
}

export function RationaleSection({ node, convDataList }: Props) {
  const hasConversations = convDataList.length > 0;

  return (
    <div className="border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">生成経緯</p>

      {hasConversations ? (
        <div className="space-y-3">
          {convDataList.map((entry) => (
            <div key={entry.conversation.id + entry.linked_at} className="space-y-1">
              <p className="text-xs text-gray-400">{entry.purpose}</p>
              <ConvLogViewer
                conversation={entry.conversation}
                messages={entry.messages}
              />
            </div>
          ))}
        </div>
      ) : node.created_by === "ai" ? (
        <div className="text-xs text-gray-400 italic">
          AI生成（会話ログなし）
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">
          経緯なし
        </div>
      )}
    </div>
  );
}
