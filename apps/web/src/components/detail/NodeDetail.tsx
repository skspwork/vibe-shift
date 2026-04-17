"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@vibeshift/shared";
import { ExternalLink, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { RationaleSection } from "./RationaleSection";
import { PreviewModal } from "./PreviewModal";
import { Markdown } from "../ui/Markdown";

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  overview: { bg: "var(--node-overview-bg)", text: "var(--node-overview-text)" },
  need: { bg: "var(--node-need-bg)", text: "var(--node-need-text)" },
  feature: { bg: "var(--node-feature-bg)", text: "var(--node-feature-text)" },
  spec: { bg: "var(--node-spec-bg)", text: "var(--node-spec-text)" },
};

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

  if (!node) return <div className="p-6 text-[var(--text-muted)] text-sm">読み込み中...</div>;

  const isDisabled = !!node.disabled_at;
  const badgeColors = TYPE_BADGE_COLORS[node.type] || TYPE_BADGE_COLORS.need;

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ backgroundColor: badgeColors.bg, color: badgeColors.text }}
          >
            {NODE_LABELS[node.type] || node.type}
          </span>
          {isDisabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--danger-bg)] text-[var(--danger-text)]">
              非活性
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPreviewModal(true)}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
          title="プレビュー"
        >
          <Eye size={14} />
        </button>
      </div>

      <h2 className="font-bold text-lg tracking-tight leading-snug">{node.title}</h2>

      {node.user_name && (
        <div className="text-xs text-[var(--text-muted)]">作成者: {node.user_name}</div>
      )}

      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--brand-primary)] hover:underline"
        >
          <ExternalLink size={13} />
          <span className="truncate">{node.url}</span>
        </a>
      )}

      <Markdown className="text-sm text-[var(--text-secondary)]">
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
        <div className="border-t border-[var(--border-default)] pt-5">
          {!showPurgeConfirm ? (
            <button
              type="button"
              onClick={() => setShowPurgeConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-[var(--danger)] border border-red-200 rounded-lg hover:bg-[var(--danger-bg)] transition-colors text-sm font-medium"
            >
              <Trash2 size={14} />
              完全に削除
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--danger)]">
                このノードと配下の全データが完全に削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirm(false)}
                  className="flex-1 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => purgeMutation.mutate()}
                  disabled={purgeMutation.isPending}
                  className="flex-1 px-4 py-2 bg-[var(--danger)] text-[var(--text-inverse)] rounded-lg hover:bg-[var(--danger-hover)] transition-colors text-sm font-medium disabled:opacity-50"
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
