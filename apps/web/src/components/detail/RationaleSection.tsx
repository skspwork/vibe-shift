"use client";

import { useState } from "react";
import { MessageCircle, Pencil, Check, X } from "lucide-react";

interface Props {
  node: any;
  convData: any;
  onUpdate: (note: string) => void;
}

export function RationaleSection({ node, convData, onUpdate }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(node.rationale_note || "");
  const [showFullConv, setShowFullConv] = useState(false);

  const isAiGenerated = node.created_by === "ai";

  const saveNote = () => {
    onUpdate(noteText);
    setEditingNote(false);
  };

  return (
    <div className="border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">生成経緯</p>

      {isAiGenerated && convData ? (
        <div className="space-y-2">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-1 text-blue-600 font-medium mb-1">
              <MessageCircle size={14} />
              AIセッション「{convData.conv_node.title}」
            </div>
            {convData.messages.slice(0, 2).map((msg: any, i: number) => (
              <p key={i} className="text-gray-600 text-xs truncate">
                &gt; {msg.role === "user" ? "ユーザー" : "AI"}: {msg.content.substring(0, 60)}...
              </p>
            ))}
            <button
              onClick={() => setShowFullConv(!showFullConv)}
              className="text-blue-500 text-xs mt-1 hover:underline"
            >
              {showFullConv ? "閉じる" : "全文を見る →"}
            </button>
          </div>

          {showFullConv && (
            <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {convData.messages.map((msg: any, i: number) => (
                <div key={i} className="text-xs">
                  <span className="font-medium">
                    {msg.role === "user" ? "ユーザー" : "AI"}:
                  </span>
                  <p className="whitespace-pre-wrap text-gray-600">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-1">補足メモ:</p>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full border rounded px-2 py-1 text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={saveNote} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingNote(false)} className="text-xs px-2 py-1 border rounded">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingNote(true)}
                className="text-sm text-gray-500 cursor-pointer hover:bg-gray-50 rounded p-1"
              >
                {node.rationale_note || "クリックして補足メモを追加..."}
              </div>
            )}
          </div>
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
              />
              <div className="flex gap-2">
                <button onClick={saveNote} className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded">
                  <Check size={12} /> 保存
                </button>
                <button onClick={() => setEditingNote(false)} className="flex items-center gap-1 text-xs px-2 py-1 border rounded">
                  <X size={12} /> キャンセル
                </button>
              </div>
            </div>
          ) : node.rationale_note ? (
            <div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {node.rationale_note}
              </p>
              <button
                onClick={() => {
                  setNoteText(node.rationale_note || "");
                  setEditingNote(true);
                }}
                className="text-xs text-blue-500 mt-1 hover:underline"
              >
                編集
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-sm text-gray-400 flex items-center gap-1 hover:text-gray-600"
            >
              <Pencil size={12} /> 経緯を記述する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
