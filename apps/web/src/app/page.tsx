"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, FolderTree } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProjectSetup } from "@/components/setup/ProjectSetup";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  if (showCreate) {
    return <ProjectSetup onCancel={() => setShowCreate(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">VibeShift</h1>
          <p className="text-gray-500">
            AIドリブン開発トレーサビリティ管理システム
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="w-full mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600"
        >
          <Plus size={20} />
          新しいプロジェクトを作成
        </button>

        {isLoading && (
          <p className="text-center text-gray-400">読み込み中...</p>
        )}

        <div className="space-y-3">
          {projects?.map((p: any) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block p-4 bg-white rounded-lg border hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <FolderTree size={20} className="text-gray-400" />
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-sm text-gray-400">
                    {new Date(p.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
