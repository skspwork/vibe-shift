"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS, getAllowedChildTypeMap } from "@cddai/shared";
import { useAppStore } from "@/lib/store";
import { Pencil, Plus, MessageCircle, X, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { RationaleSection } from "./RationaleSection";
import { NodeCreateForm } from "../node/NodeCreateForm";

interface Props {
  nodeId: string;
  projectId: string;
  onUpdate: () => void;
}

export function NodeDetail({ nodeId, projectId, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const queryClient = useQueryClient();
  const setSession = useAppStore((s) => s.setSession);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const setFocusNodeId = useAppStore((s) => s.setFocusNodeId);

  const { data: node } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.getNode(nodeId),
  });

  const { data: convData } = useQuery({
    queryKey: ["node-conv", nodeId],
    queryFn: () => api.getNodeConv(nodeId),
    enabled: !!node && node.created_by === "ai",
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateNode(nodeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["node", nodeId] });
      onUpdate();
      setEditing(false);
    },
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

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });

  const methodology = project?.methodology || "strict";

  if (!node) return <div className="p-4 text-gray-400">読み込み中...</div>;

  const allowedMap = getAllowedChildTypeMap(methodology);
  const childTypes = allowedMap[node.type] || [];
  const canCreateChild = childTypes.length > 0;

  const startEdit = () => {
    setEditTitle(node.title);
    setEditContent(node.content);
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({ title: editTitle, content: editContent });
  };

  const startSession = () => {
    setSession(
      nodeId,
      node.type === "overview" ? "overview" : "node_session",
      { id: node.id, type: node.type, title: node.title }
    );
  };

  if (showCreateChild) {
    return (
      <NodeCreateForm
        parentNode={node}
        projectId={projectId}
        methodology={methodology}
        onCreated={() => {
          setShowCreateChild(false);
          onUpdate();
        }}
        onCancel={() => setShowCreateChild(false)}
      />
    );
  }

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
        {!editing && (
          <button
            onClick={startEdit}
            className="text-gray-400 hover:text-gray-600"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm font-semibold"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
            className="w-full border rounded px-2 py-1 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Check size={14} /> 保存
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-sm px-3 py-1 border rounded hover:bg-gray-50"
            >
              <X size={14} /> キャンセル
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-bold text-lg">{node.title}</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {node.content}
          </p>
        </>
      )}

      <RationaleSection
        node={node}
        convData={convData}
        onUpdate={(note) =>
          updateMutation.mutate({ rationale_note: note })
        }
      />

      <div className="border-t pt-4 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">
          アクション
        </p>
        {canCreateChild && (
          <button
            onClick={() => setShowCreateChild(true)}
            className="w-full flex items-center gap-2 text-sm px-3 py-2 border rounded-lg hover:bg-gray-50 transition"
          >
            <Plus size={16} /> 子ノードを手動で作成
          </button>
        )}
        <button
          onClick={startSession}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-blue-600"
        >
          <MessageCircle size={16} /> AIとセッションを開始
        </button>

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
