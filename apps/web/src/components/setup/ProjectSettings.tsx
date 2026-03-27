"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LANE_TYPES, NODE_LABELS } from "@cddai/shared";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  project: any;
  onClose: () => void;
}

export function ProjectSettings({ project, onClose }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
      router.push("/");
    },
  });

  // Parse overview node content to extract fields
  const parseOverviewContent = (content: string) => {
    const fields: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^(.+?): (.+)$/);
      if (match) fields[match[1]] = match[2];
    }
    return fields;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm({
    defaultValues: {
      name: "",
      purpose: "",
      scope: "",
      stakeholders: "",
      constraints: "",
      active_lanes: [] as string[],
    },
  });

  useEffect(() => {
    if (!project) return;
    // Fetch overview node to get purpose/scope/etc
    api.getGraph(project.id).then((graph) => {
      const overview = graph.nodes.find((n: any) => n.type === "overview");
      const fields = overview ? parseOverviewContent(overview.content || "") : {};
      reset({
        name: project.name,
        purpose: fields["目的・背景"] || "",
        scope: fields["スコープ"] || "",
        stakeholders: fields["ステークホルダー"] || "",
        constraints: fields["技術的制約"] || "",
        active_lanes: project.active_lanes || [],
      });
    });
  }, [project, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.updateProject(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["graph", project.id] });
      onClose();
    },
  });

  const activeLanes = watch("active_lanes");

  const toggleLane = (lane: string) => {
    const current = activeLanes || [];
    if (current.includes(lane as any)) {
      setValue("active_lanes", current.filter((l) => l !== lane) as any, { shouldDirty: true });
    } else {
      setValue("active_lanes", [...current, lane] as any, { shouldDirty: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">プロジェクト設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              システム名 <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name", { required: "システム名は必須です" })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">目的・背景</label>
            <textarea
              {...register("purpose")}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">スコープ</label>
            <textarea
              {...register("scope")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ステークホルダー</label>
            <input
              {...register("stakeholders")}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">技術的制約</label>
            <textarea
              {...register("constraints")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">使用するレーン</label>
            <div className="flex flex-wrap gap-2">
              {LANE_TYPES.map((lane) => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => toggleLane(lane)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    activeLanes?.includes(lane as any)
                      ? "bg-blue-50 border-blue-400 text-blue-700"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  {NODE_LABELS[lane]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !isDirty}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {mutation.isPending ? "保存中..." : "保存する"}
            </button>
          </div>
        </form>

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
