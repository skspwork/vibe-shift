"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateProjectSchema } from "@cddai/shared";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ProjectFormFields, type ProjectFormValues } from "./ProjectFormFields";

export function ProjectSetup({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: "",
      purpose: "",
      scope: "",
      stakeholders: "",
      constraints: "",
      active_lanes: ["need", "req", "spec", "basic_design", "detail_design", "code"],
      node_instructions: {},
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
  const nodeInstructions = watch("node_instructions");

  const toggleLane = (lane: string) => {
    const current = activeLanes || [];
    if (current.includes(lane)) {
      setValue("active_lanes", current.filter((l) => l !== lane));
    } else {
      setValue("active_lanes", [...current, lane]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-bold mb-6">新しいプロジェクトを作成</h1>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <ProjectFormFields
            register={register}
            errors={errors}
            activeLanes={activeLanes}
            nodeInstructions={nodeInstructions}
            onToggleLane={toggleLane}
            onChangeNodeInstruction={(lane, value) => {
              setValue("node_instructions", { ...nodeInstructions, [lane]: value });
            }}
            isCreate
          />

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
