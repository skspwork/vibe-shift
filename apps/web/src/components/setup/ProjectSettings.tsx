"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NODE_LABELS, DEFAULT_NODE_INSTRUCTIONS } from "@vibeshift/shared";

const NODE_INSTRUCTION_TYPES = ["need", "feature", "spec"] as const;

interface Props {
  project: any;
  onClose: () => void;
}

export function ProjectSettings({ project, onClose }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
      router.push("/");
    },
  });

  useEffect(() => {
    if (!project) return;
    api.getGraph(project.id).then((graph) => {
      const overview = graph.nodes.find((n: any) => n.type === "overview");
      if (overview?.content) {
        const parsed: Record<string, string> = {};
        for (const line of overview.content.split("\n")) {
          const match = line.match(/^(.+?): (.+)$/);
          if (match) parsed[match[1]] = match[2];
        }
        setFields(parsed);
      }
    });
  }, [project]);

  const nodeInstructions = project.node_instructions || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">プロジェクト設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">システム名</label>
            <p className="text-sm">{project.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">目的・背景</label>
            <p className="text-sm whitespace-pre-wrap">{fields["目的・背景"] || "—"}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">技術的制約</label>
            <p className="text-sm whitespace-pre-wrap">{fields["技術的制約"] || "—"}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">ノード種別ごとのAI記述ルール</label>
            <div className="space-y-2">
              {NODE_INSTRUCTION_TYPES.map((lane) => (
                <div key={lane}>
                  <label className="block text-xs font-medium text-gray-400 mb-0.5">
                    {NODE_LABELS[lane]}
                  </label>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 border rounded-lg px-3 py-1.5">
                    {nodeInstructions[lane] || DEFAULT_NODE_INSTRUCTIONS[lane] || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 pt-2">
            設定の変更はMCPサーバー経由でAIエージェントから行えます。
          </p>
        </div>

        <div className="border-t mt-6 pt-4">
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm"
            >
              プロジェクトを削除
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600">
                プロジェクトと関連するすべてのデータが削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
