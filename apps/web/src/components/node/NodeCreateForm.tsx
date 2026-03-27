"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getAllowedChildTypeMap, NODE_LABELS } from "@cddai/shared";
import { X } from "lucide-react";

interface Props {
  parentNode: any;
  projectId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function NodeCreateForm({ parentNode, projectId, onCreated, onCancel }: Props) {
  const allowedMap = getAllowedChildTypeMap();
  const childTypes = allowedMap[parentNode.type] || [];
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      type: childTypes[0] || "need",
      title: "",
      content: "",
      url: "",
      rationale_note: "",
    },
  });

  const selectedType = watch("type");

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.createNode({
        ...data,
        project_id: projectId,
        parent_id: parentNode.id,
        created_by: "user",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
      onCreated();
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">子ノードを作成</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-gray-500">
        親: {NODE_LABELS[parentNode.type]} 「{parentNode.title}」
      </p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">種別</label>
          <select
            {...register("type")}
            className="w-full border rounded px-2 py-1.5 text-sm"
          >
            {childTypes.map((t: string) => (
              <option key={t} value={t}>
                {NODE_LABELS[t]} ({t})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            {...register("title", { required: "タイトルは必須です" })}
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="10文字程度で簡潔に"
          />
          {errors.title && (
            <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
          )}
        </div>

        {selectedType === "task" || selectedType === "code" ? (
          <div>
            <label className="block text-xs font-medium mb-1">URL（任意）</label>
            <input
              {...register("url")}
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="https://..."
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium mb-1">内容</label>
            <textarea
              {...register("content")}
              rows={4}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none"
              placeholder="詳細を記述"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1">経緯（任意）</label>
          <textarea
            {...register("rationale_note")}
            rows={2}
            className="w-full border rounded px-2 py-1.5 text-sm resize-none"
            placeholder="なぜこのノードが必要か"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? "作成中..." : "作成"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
