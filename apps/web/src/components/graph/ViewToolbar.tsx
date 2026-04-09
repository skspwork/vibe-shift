"use client";

import { useAppStore } from "@/lib/store";
import { SearchPanel } from "./SearchPanel";

export function ViewToolbar({ projectId }: { projectId: string }) {
  const { graphColumns, setGraphColumns, showDisabledNodes, setShowDisabledNodes } = useAppStore();

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 py-1.5 flex items-center gap-4 shrink-0">
      <SearchPanel projectId={projectId} />
      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-secondary)] transition-colors">
        <input
          type="checkbox"
          checked={showDisabledNodes}
          onChange={(e) => setShowDisabledNodes(e.target.checked)}
          className="rounded accent-[var(--brand-primary)]"
        />
        非活性ノード
      </label>
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ml-auto">
        <span className="text-[var(--text-muted)]">列数</span>
        <input
          type="number"
          min={1}
          max={10}
          value={graphColumns}
          onChange={(e) => setGraphColumns(Number(e.target.value))}
          className="w-12 border border-[var(--border-default)] rounded-md px-1.5 py-0.5 text-center text-xs bg-[var(--bg-base)] focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] outline-none"
        />
      </div>
    </div>
  );
}
