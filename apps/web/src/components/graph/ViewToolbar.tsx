"use client";

import { useAppStore } from "@/lib/store";
import { NODE_LABELS } from "@cddai/shared";
import { SearchPanel } from "./SearchPanel";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  overview: { bg: "#2E4057", border: "#1a2a3a", text: "#ffffff" },
  need: { bg: "#E6F1FB", border: "#378ADD", text: "#1a3a5c" },
  feature: { bg: "#E1F5EE", border: "#1D9E75", text: "#0d4a36" },
  spec: { bg: "#EEEDFE", border: "#7F77DD", text: "#3a356a" },
};

const LANE_ORDER = ["overview", "need", "feature", "spec"];

export function ViewToolbar({ projectId }: { projectId: string }) {
  const { hiddenLanes, toggleLane } = useAppStore();

  return (
    <div className="bg-white border-b px-3 py-1.5 flex items-center gap-4 shrink-0">
      <SearchPanel projectId={projectId} />
      <div className="flex items-center gap-1 text-xs">
        {LANE_ORDER.map((lane) => {
          const colors = NODE_COLORS[lane];
          const hidden = hiddenLanes.has(lane);
          return (
            <button
              key={lane}
              onClick={() => toggleLane(lane)}
              className={`px-2 py-0.5 rounded border transition ${
                hidden ? "opacity-40 bg-gray-50" : ""
              }`}
              style={{
                borderColor: colors.border,
                backgroundColor: hidden ? undefined : colors.bg,
                color: colors.text,
              }}
            >
              {NODE_LABELS[lane] || lane}
            </button>
          );
        })}
      </div>
    </div>
  );
}
