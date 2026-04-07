"use client";

import { Handle, Position } from "@xyflow/react";
import { NODE_LABELS } from "@cddai/shared";

interface NodeCardData {
  label: string;
  nodeType: string;
  colors: { bg: string; border: string; text: string };
  selected: boolean;
  dimmed: boolean;
  isSubNode?: boolean;
}

export function NodeCard({ data }: { data: NodeCardData }) {
  const isSubNode = data.isSubNode ?? false;

  return (
    <div
      className={`rounded-lg transition-opacity ${
        isSubNode
          ? "px-2 py-1.5 min-w-[120px] max-w-[140px]"
          : "px-3 py-2 min-w-[160px] max-w-[180px]"
      }`}
      style={{
        backgroundColor: data.colors.bg,
        border: `2px solid ${data.selected ? "#3b82f6" : data.colors.border}`,
        color: data.colors.text,
        opacity: data.dimmed ? 0.4 : 1,
        boxShadow: data.selected ? "0 0 0 2px #3b82f6" : "none",
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className={`font-medium opacity-70 uppercase ${isSubNode ? "text-[9px]" : "text-[10px]"}`}>
        {NODE_LABELS[data.nodeType] || data.nodeType}
      </div>
      <div className={`font-semibold truncate ${isSubNode ? "text-xs" : "text-sm"}`}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}
