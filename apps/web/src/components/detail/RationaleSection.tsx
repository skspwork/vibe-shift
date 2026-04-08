"use client";

import { HistoryTimeline } from "./HistoryTimeline";

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
  return (
    <div className="border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">変遷</p>

      {convDataList.length > 0 ? (
        <HistoryTimeline entries={convDataList} />
      ) : node.created_by === "ai" ? (
        <div className="text-xs text-gray-400 italic">
          AI生成（記録なし）
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">
          変遷なし
        </div>
      )}
    </div>
  );
}
