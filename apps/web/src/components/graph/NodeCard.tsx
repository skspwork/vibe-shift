"use client";

import { Handle, Position } from "@xyflow/react";
import { NODE_LABELS } from "@cddai/shared";

interface NodeCardData {
  label: string;
  nodeType: string;
  colors: { bg: string; border: string; text: string };
  selected: boolean;
  dimmed: boolean;
  disabled?: boolean;
}

export function NodeCard({ data }: { data: NodeCardData }) {
  const isDisabled = data.disabled ?? false;

  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[160px] max-w-[180px] transition-opacity"
      style={{
        backgroundColor: data.colors.bg,
        border: `2px ${isDisabled ? "dashed" : "solid"} ${data.selected ? "#3b82f6" : data.colors.border}`,
        color: data.colors.text,
        opacity: data.dimmed ? 0.4 : 1,
        boxShadow: data.selected ? "0 0 0 2px #3b82f6" : "none",
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="text-[10px] font-medium opacity-70 uppercase">
        {NODE_LABELS[data.nodeType] || data.nodeType}
      </div>
      <div className="text-sm font-semibold truncate">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}
