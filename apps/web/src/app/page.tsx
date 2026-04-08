"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FolderTree, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [showHelp, setShowHelp] = useState(false);
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

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
          onClick={() => setShowHelp(!showHelp)}
          className="w-full mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600"
        >
          <MessageSquare size={20} />
          プロジェクトを作成するには？
        </button>

        {showHelp && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-blue-800">AIエージェント経由でプロジェクトを作成します</p>
            <p>MCP対応のAIエージェントに VibeShift MCPサーバーを接続し、以下のように依頼してください：</p>
            <div className="bg-white border rounded p-3 font-mono text-xs text-gray-600">
              「VibeShiftに新しいプロジェクトを作成してください。システム名は○○で、目的は○○です。」
            </div>
            <p className="text-gray-500">AIが <code className="bg-white px-1 rounded">create_project</code> ツールでプロジェクトを作成し、要求の洗い出しまでサポートします。</p>
          </div>
        )}

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
