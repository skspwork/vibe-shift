"use client";

import { useAppStore } from "@/lib/store";
import { SearchPanel } from "./SearchPanel";

export function ViewToolbar({ projectId }: { projectId: string }) {
  const { graphColumns, setGraphColumns, showDisabledNodes, setShowDisabledNodes } = useAppStore();

  return (
    <div className="bg-white border-b px-3 py-1.5 flex items-center gap-4 shrink-0">
      <SearchPanel projectId={projectId} />
      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
        <input
          type="checkbox"
          checked={showDisabledNodes}
          onChange={(e) => setShowDisabledNodes(e.target.checked)}
          className="rounded"
        />
        非活性ノード
      </label>
      <div className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
        <span>列数</span>
        <input
          type="number"
          min={1}
          max={10}
          value={graphColumns}
          onChange={(e) => setGraphColumns(Number(e.target.value))}
          className="w-12 border rounded px-1.5 py-0.5 text-center text-xs"
        />
      </div>
    </div>
  );
}
