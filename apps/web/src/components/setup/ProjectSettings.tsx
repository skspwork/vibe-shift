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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="max-w-lg w-full bg-[var(--bg-surface)] rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto border border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold tracking-tight">プロジェクト設定</h2>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">システム名</label>
            <p className="text-sm text-[var(--text-primary)]">{project.name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">目的・背景</label>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{fields["目的・背景"] || "—"}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">技術的制約</label>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{fields["技術的制約"] || "—"}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">AI記述ルール</label>
            <div className="space-y-2">
              {NODE_INSTRUCTION_TYPES.map((lane) => (
                <div key={lane}>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-0.5">
                    {NODE_LABELS[lane]}
                  </label>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--bg-muted)] border border-[var(--border-default)] rounded-lg px-3 py-2 leading-relaxed">
                    {nodeInstructions[lane] || DEFAULT_NODE_INSTRUCTIONS[lane] || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] pt-1">
            設定の変更はMCPサーバー経由でAIエージェントから行えます。
          </p>
        </div>

        <div className="border-t border-[var(--border-default)] mt-6 pt-4">
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-2 text-[var(--danger)] border border-red-200 rounded-lg hover:bg-[var(--danger-bg)] transition-colors text-sm font-medium"
            >
              プロジェクトを削除
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--danger)]">
                プロジェクトと関連するすべてのデータが削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 bg-[var(--danger)] text-[var(--text-inverse)] rounded-lg hover:bg-[var(--danger-hover)] transition-colors text-sm font-medium disabled:opacity-50"
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
