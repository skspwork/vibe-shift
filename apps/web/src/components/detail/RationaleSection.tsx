"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { ConvLogViewer } from "./ConvLogViewer";
import { Markdown } from "../ui/Markdown";

interface Props {
  node: any;
  convData: any;
  onUpdate: (note: string) => void;
}

export function RationaleSection({ node, convData, onUpdate }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(node.rationale_note || "");

  const isAiGenerated = node.created_by === "ai";

  // Sync noteText when node changes
  useEffect(() => {
    setNoteText(node.rationale_note || "");
    setEditingNote(false);
  }, [node.id, node.rationale_note]);

  const saveNote = () => {
    onUpdate(noteText);
    setEditingNote(false);
  };

  return (
    <div className="border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">生成経緯</p>

      {isAiGenerated && convData ? (
        <div className="space-y-3">
          {/* AI conversation log viewer */}
          <ConvLogViewer
            conversation={convData.conversation}
            messages={convData.messages}
          />

          {/* Supplementary note */}
          <div>
            <p className="text-xs text-gray-500 mb-1">補足メモ:</p>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full border rounded px-2 py-1 text-sm resize-none"
                  placeholder="補足メモを追加..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNote}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Check size={12} /> 保存
                  </button>
                  <button
                    onClick={() => {
                      setNoteText(node.rationale_note || "");
                      setEditingNote(false);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    <X size={12} /> キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingNote(true)}
                className="text-sm text-gray-500 cursor-pointer hover:bg-gray-50 rounded p-1.5 border border-dashed border-gray-200"
              >
                {node.rationale_note || "クリックして補足メモを追加..."}
              </div>
            )}
          </div>
        </div>
      ) : isAiGenerated && !convData ? (
        <div className="text-xs text-gray-400 italic">
          AI生成（会話ログなし）
        </div>
      ) : (
        <div>
          {editingNote ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="w-full border rounded px-2 py-1 text-sm resize-none"
                placeholder="経緯を記述してください..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNote}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Check size={12} /> 保存
                </button>
                <button
                  onClick={() => {
                    setNoteText(node.rationale_note || "");
                    setEditingNote(false);
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                >
                  <X size={12} /> キャンセル
                </button>
              </div>
            </div>
          ) : node.rationale_note ? (
            <div>
              <Markdown className="text-sm text-gray-600">
                {node.rationale_note}
              </Markdown>
              <button
                onClick={() => setEditingNote(true)}
                className="text-xs text-blue-500 mt-1 hover:underline"
              >
                編集
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-sm text-gray-400 flex items-center gap-1 hover:text-gray-600 border border-dashed border-gray-200 rounded p-2 w-full"
            >
              <Pencil size={12} /> 経緯を記述する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
