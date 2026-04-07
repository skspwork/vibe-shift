"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save } from "lucide-react";
import type { AppNode } from "@cddai/shared";

import { Markdown } from "../ui/Markdown";
import { api } from "@/lib/api";

interface Props {
  node: AppNode;
  onSave: () => void;
  onClose: () => void;
}

export function EditModal({ node, onSave, onClose }: Props) {
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateNode(node.id, { title, content });
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={handleClose}
    >
      <div
        className="max-w-6xl w-full mx-4 max-h-[90vh] bg-white rounded-xl shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
          <h2 className="font-semibold text-lg">ノード編集</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "保存中..." : "保存"}
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
        <div className="flex-1 grid grid-cols-2 divide-x overflow-hidden min-h-0">
          {/* Left: Editor */}
          <div className="flex flex-col p-4 gap-3 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                タイトル
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                コンテンツ（Markdown）
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full border rounded-lg px-3 py-2 text-sm font-mono resize-none min-h-[300px]"
              />
            </div>
          </div>

          {/* Right: Preview */}
          <div className="overflow-y-auto p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2">
              プレビュー
            </p>
            <Markdown>{content}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
