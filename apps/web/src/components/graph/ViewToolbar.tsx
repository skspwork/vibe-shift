"use client";

import { useAppStore } from "@/lib/store";
import { NODE_LABELS } from "@cddai/shared";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  overview: { bg: "#2E4057", border: "#1a2a3a", text: "#ffffff" },
  need: { bg: "#E6F1FB", border: "#378ADD", text: "#1a3a5c" },
  req: { bg: "#E1F5EE", border: "#1D9E75", text: "#0d4a36" },
  spec: { bg: "#EEEDFE", border: "#7F77DD", text: "#3a356a" },
  design: { bg: "#FAEEDA", border: "#EF9F27", text: "#5a3d0a" },
  basic_design: { bg: "#FAEEDA", border: "#EF9F27", text: "#5a3d0a" },
  detail_design: { bg: "#FDF2E0", border: "#D4880E", text: "#5a3d0a" },
  task: { bg: "#FAECE7", border: "#D85A30", text: "#5a1f0a" },
  code: { bg: "#EAF3DE", border: "#639922", text: "#2a4a0a" },
  test: { bg: "#FBEAF0", border: "#D4537E", text: "#5a1a30" },
};

const LANE_ORDER = ["overview", "need", "req", "spec", "basic_design", "detail_design", "task", "code", "test"];
const SUMMARY_LANES = new Set(["overview", "need", "req"]);

export function ViewToolbar() {
  const { viewMode, setViewMode, hiddenLanes, toggleLane } = useAppStore();

  const toggleableLanes = viewMode === "summary"
    ? LANE_ORDER.filter((l) => SUMMARY_LANES.has(l))
    : LANE_ORDER;

  return (
    <div className="bg-white border-b px-3 py-1.5 flex items-center gap-4 shrink-0">
      <div className="flex items-center gap-1 text-xs">
        {(["flow", "summary", "matrix"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-2 py-0.5 rounded ${
              viewMode === mode
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {mode === "flow" ? "フロー" : mode === "summary" ? "サマリー" : "マトリクス"}
          </button>
        ))}
      </div>

      {viewMode !== "matrix" && (
        <div className="flex items-center gap-1 text-xs border-l pl-4">
          {toggleableLanes.map((lane) => {
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
      )}
    </div>
  );
}
