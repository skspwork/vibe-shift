"use client";

import { useEffect, useCallback, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { NODE_LABELS } from "@cddai/shared";
import type { AppNode } from "@cddai/shared";
import { Markdown } from "../ui/Markdown";

interface Props {
  node: AppNode;
  onClose: () => void;
}

export function PreviewModal({ node, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const handleClose = useCallback(() => onClose(), [onClose]);

  const handleCopy = useCallback(() => {
    const text = `# ${node.title}\n\n${node.content}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node.title, node.content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={handleClose}
    >
      <div
        className="max-w-4xl w-full mx-4 max-h-[90vh] bg-white rounded-xl shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {NODE_LABELS[node.type] || node.type}
            </span>
            <h2 className="font-semibold text-lg">{node.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
              title="Markdownをコピー"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <Markdown>{node.content}</Markdown>
        </div>
      </div>
    </div>
  );
}
