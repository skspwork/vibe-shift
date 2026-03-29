"use client";

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { LANE_TYPES, NODE_LABELS, DEFAULT_NODE_INSTRUCTIONS } from "@cddai/shared";

export interface ProjectFormValues {
  name: string;
  purpose: string;
  scope: string;
  stakeholders: string;
  constraints: string;
  active_lanes: string[];
  node_instructions: Record<string, string>;
}

interface Props {
  register: UseFormRegister<ProjectFormValues>;
  errors: FieldErrors<ProjectFormValues>;
  activeLanes: string[];
  nodeInstructions: Record<string, string>;
  onToggleLane: (lane: string) => void;
  onChangeNodeInstruction: (lane: string, value: string) => void;
  /** Show required markers and placeholders for create mode */
  isCreate?: boolean;
}

export function ProjectFormFields({
  register,
  errors,
  activeLanes,
  nodeInstructions,
  onToggleLane,
  onChangeNodeInstruction,
  isCreate,
}: Props) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          システム名 <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name", { required: "システム名は必須です" })}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder={isCreate ? "例: ECサイト管理システム" : undefined}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          目的・背景{isCreate && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          {...register("purpose", isCreate ? { required: "目的・背景は必須です" } : undefined)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          placeholder={isCreate ? "このプロジェクトの目的や背景を記述してください" : undefined}
        />
        {errors.purpose && (
          <p className="text-red-500 text-sm mt-1">{errors.purpose.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          スコープ{isCreate && "（任意）"}
        </label>
        <textarea
          {...register("scope")}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          ステークホルダー{isCreate && "（任意）"}
        </label>
        <input
          {...register("stakeholders")}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          技術的制約{isCreate && "（任意）"}
        </label>
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
              onClick={() => onToggleLane(lane)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                activeLanes?.includes(lane)
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              {NODE_LABELS[lane]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          ノード種別ごとのAI記述ルール
        </label>
        <p className="text-xs text-gray-500 mb-3">
          未指定の場合デフォルト値が使われます
        </p>
        <div className="space-y-2">
          {(activeLanes || []).map((lane) => (
            <div key={lane}>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                {NODE_LABELS[lane]}
              </label>
              <textarea
                value={nodeInstructions?.[lane] || ""}
                onChange={(e) => onChangeNodeInstruction(lane, e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder={DEFAULT_NODE_INSTRUCTIONS[lane] || ""}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
