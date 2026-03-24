"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateProjectSchema, LANE_TYPES, NODE_LABELS } from "@cddai/shared";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { z } from "zod";

type FormData = z.infer<typeof CreateProjectSchema>;

export function ProjectSetup({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: "",
      purpose: "",
      scope: "",
      stakeholders: "",
      constraints: "",
      active_lanes: ["need", "req", "spec", "design", "task"],
    },
  });

  const mutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${data.id}`);
    },
  });

  const activeLanes = watch("active_lanes");

  const toggleLane = (lane: string) => {
    const current = activeLanes || [];
    if (current.includes(lane as any)) {
      setValue(
        "active_lanes",
        current.filter((l) => l !== lane) as any
      );
    } else {
      setValue("active_lanes", [...current, lane] as any);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-bold mb-6">新しいプロジェクトを作成</h1>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              システム名 <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name")}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="例: ECサイト管理システム"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              目的・背景 <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("purpose")}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="このプロジェクトの目的や背景を記述してください"
            />
            {errors.purpose && (
              <p className="text-red-500 text-sm mt-1">{errors.purpose.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              スコープ（任意）
            </label>
            <textarea
              {...register("scope")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              ステークホルダー（任意）
            </label>
            <input
              {...register("stakeholders")}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              技術的制約（任意）
            </label>
            <textarea
              {...register("constraints")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              使用するレーン
            </label>
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
              onClick={onCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {mutation.isPending ? "作成中..." : "作成する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
