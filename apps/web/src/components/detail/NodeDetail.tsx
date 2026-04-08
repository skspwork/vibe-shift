"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@cddai/shared";
import { ExternalLink, Eye } from "lucide-react";
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

  const { data: node } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.getNode(nodeId),
  });

  const { data: changelogList } = useQuery({
    queryKey: ["node-changelogs", nodeId],
    queryFn: () => api.getNodeChangelogs(nodeId),
  });

  if (!node) return <div className="p-4 text-gray-400">読み込み中...</div>;

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
    </div>
  );
}
