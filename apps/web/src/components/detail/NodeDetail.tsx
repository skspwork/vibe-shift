"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@cddai/shared";
import { useAppStore } from "@/lib/store";
import { Pencil, Trash2, ExternalLink, Eye } from "lucide-react";
import { useState } from "react";
import { RationaleSection } from "./RationaleSection";
import { EditModal } from "./EditModal";
import { PreviewModal } from "./PreviewModal";
import { Markdown } from "../ui/Markdown";

interface Props {
  nodeId: string;
  projectId: string;
  onUpdate: () => void;
}

export function NodeDetail({ nodeId, projectId, onUpdate }: Props) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const setFocusNodeId = useAppStore((s) => s.setFocusNodeId);

  const { data: node } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.getNode(nodeId),
  });

  const { data: convDataList } = useQuery({
    queryKey: ["node-conv", nodeId],
    queryFn: () => api.getNodeConv(nodeId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteNode(nodeId),
    onSuccess: () => {
      setSelectedNodeId(null);
      setFocusNodeId(null);
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      onUpdate();
    },
  });

  if (!node) return <div className="p-4 text-gray-400">読み込み中...</div>;

  const handleEditSave = () => {
    queryClient.invalidateQueries({ queryKey: ["node", nodeId] });
    onUpdate();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            backgroundColor:
              node.type === "overview" ? "#2E4057" : undefined,
            color: node.type === "overview" ? "#fff" : undefined,
          }}
        >
          {NODE_LABELS[node.type] || node.type}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="text-gray-400 hover:text-gray-600"
            title="プレビュー"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="text-gray-400 hover:text-gray-600"
            title="編集"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      <h2 className="font-bold text-lg">{node.title}</h2>
      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink size={14} />
          {node.url}
        </a>
      )}
      <Markdown className="text-sm text-gray-600">
        {node.content}
      </Markdown>

      {showEditModal && (
        <EditModal
          node={node}
          onSave={handleEditSave}
          onClose={() => setShowEditModal(false)}
        />
      )}
      {showPreviewModal && (
        <PreviewModal
          node={node}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      <RationaleSection
        node={node}
        convDataList={convDataList || []}
      />



      <div className="border-t pt-4 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">
          アクション
        </p>
        {node.type !== "overview" && (
          <>
            {confirmDelete ? (
              <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-red-700">
                  このノードと子孫ノードがすべて削除されます。元に戻せません。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {deleteMutation.isPending ? "削除中..." : "削除する"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 text-sm px-3 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition text-red-500"
              >
                <Trash2 size={16} /> このノードを削除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
