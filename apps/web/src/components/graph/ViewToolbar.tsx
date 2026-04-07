"use client";

import { SearchPanel } from "./SearchPanel";

export function ViewToolbar({ projectId }: { projectId: string }) {
  return (
    <div className="bg-white border-b px-3 py-1.5 flex items-center gap-4 shrink-0">
      <SearchPanel projectId={projectId} />
    </div>
  );
}
