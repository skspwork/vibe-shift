"use client";

import { Handle, Position } from "@xyflow/react";
import { NODE_LABELS } from "@vibeshift/shared";

interface NodeCardData {
  label: string;
  nodeType: string;
  colors: { bg: string; border: string; text: string };
  selected: boolean;
  dimmed: boolean;
  disabled?: boolean;
  requirementCategory?: string;
}

export function NodeCard({ data }: { data: NodeCardData }) {
  const isDisabled = data.disabled ?? false;
  const isNonFunctional = data.nodeType === "need" && data.requirementCategory === "non_functional";

  return (
    <div
      className="rounded-lg px-3 py-2.5 min-w-[160px] max-w-[180px] transition-all duration-150"
      style={{
        backgroundColor: data.colors.bg,
        border: `2px ${isDisabled ? "dashed" : "solid"} ${data.selected ? "var(--border-active)" : data.colors.border}`,
        color: data.colors.text,
        opacity: data.dimmed ? 0.35 : 1,
        boxShadow: data.selected ? "0 0 0 2px var(--border-active)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-none !w-0 !h-0" />
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1 mb-0.5">
        {NODE_LABELS[data.nodeType] || data.nodeType}
        {isNonFunctional && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-black/10 normal-case tracking-normal">
            非機能
          </span>
        )}
      </div>
      <div className="text-[13px] font-semibold leading-snug truncate">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-none !w-0 !h-0" />
    </div>
  );
}
