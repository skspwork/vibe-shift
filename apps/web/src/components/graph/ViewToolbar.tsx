"use client";

import { useAppStore } from "@/lib/store";
import { SearchPanel } from "./SearchPanel";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

export function ViewToolbar({ projectId }: { projectId: string }) {
  const { columns, setColumns, showDisabledNodes, setShowDisabledNodes, triggerCollapseAll, triggerExpandAll } = useAppStore();

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 py-1.5 flex items-center gap-4 shrink-0">
      <SearchPanel projectId={projectId} />
      <div className="flex items-center gap-1">
        <button
          onClick={triggerExpandAll}
          className="p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          title="すべて展開"
        >
          <ChevronsUpDown size={14} />
        </button>
        <button
          onClick={triggerCollapseAll}
          className="p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          title="すべて折りたたむ"
        >
          <ChevronsDownUp size={14} />
        </button>
      </div>
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
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => setColumns(n)}
            className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
              columns === n
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-default)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
