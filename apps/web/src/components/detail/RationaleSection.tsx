"use client";

import { HistoryTimeline } from "./HistoryTimeline";

interface ChangelogEntry {
  changelog: { id: string; title: string; created_at: string };
  purpose: string;
  linked_at: string;
  reason: string;
}

interface Props {
  node: any;
  changelogList: ChangelogEntry[];
}

export function RationaleSection({ node, changelogList }: Props) {
  return (
    <div className="border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">変更履歴</p>

      {changelogList.length > 0 ? (
        <HistoryTimeline entries={changelogList} />
      ) : node.created_by === "ai" ? (
        <div className="text-xs text-gray-400 italic">
          AI生成（記録なし）
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">
          変更履歴なし
        </div>
      )}
    </div>
  );
}
