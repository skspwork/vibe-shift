"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@cddai/shared";
import { Pencil, ExternalLink, Eye } from "lucide-react";
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
  const queryClient = useQueryClient();

  const { data: node } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.getNode(nodeId),
  });

  const { data: convDataList } = useQuery({
    queryKey: ["node-conv", nodeId],
    queryFn: () => api.getNodeConv(nodeId),
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



    </div>
  );
}
