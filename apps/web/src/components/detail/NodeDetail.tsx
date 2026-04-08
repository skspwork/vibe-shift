"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@cddai/shared";
import { ExternalLink, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { RationaleSection } from "./RationaleSection";
import { PreviewModal } from "./PreviewModal";
import { Markdown } from "../ui/Markdown";

interface Props {
  nodeId: string;
  projectId: string;
  onUpdate: () => void;
}

export function NodeDetail({ nodeId, projectId, onUpdate }: Props) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: node } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.getNode(nodeId),
  });

  const { data: changelogList } = useQuery({
    queryKey: ["node-changelogs", nodeId],
    queryFn: () => api.getNodeChangelogs(nodeId),
  });

  const purgeMutation = useMutation({
    mutationFn: () => api.purgeNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph", projectId] });
      onUpdate();
    },
  });

  if (!node) return <div className="p-4 text-gray-400">読み込み中...</div>;

  const isDisabled = !!node.disabled_at;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          {isDisabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
              非活性
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPreviewModal(true)}
          className="text-gray-400 hover:text-gray-600"
          title="プレビュー"
        >
          <Eye size={14} />
        </button>
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

      {showPreviewModal && (
        <PreviewModal
          node={node}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      <RationaleSection
        node={node}
        changelogList={changelogList || []}
      />

      {isDisabled && (
        <div className="border-t pt-4">
          {!showPurgeConfirm ? (
            <button
              type="button"
              onClick={() => setShowPurgeConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm"
            >
              <Trash2 size={14} />
              完全に削除
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600">
                このノードと配下の全データが完全に削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => purgeMutation.mutate()}
                  disabled={purgeMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50"
                >
                  {purgeMutation.isPending ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
