"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FolderTree, MessageSquare, ArrowRight } from "lucide-react";
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Vibe<span className="text-[var(--brand-primary)]">Shift</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-base leading-relaxed">
            つくる速さはそのまま、壊れない開発へ
          </p>
        </div>

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-full mb-8 p-4 border-2 border-dashed border-[var(--border-default)] rounded-xl hover:border-[var(--brand-primary)] hover:bg-[var(--bg-accent)] transition-all duration-200 flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
        >
          <MessageSquare size={18} />
          <span className="text-sm font-medium">プロジェクトを作成するには？</span>
        </button>

        {showHelp && (
          <div className="mb-8 p-5 bg-[var(--bg-accent)] border border-blue-200 rounded-xl text-sm space-y-3 animate-in fade-in duration-200">
            <p className="font-semibold text-[var(--brand-primary)]">AIエージェント経由でプロジェクトを作成します</p>
            <p className="text-[var(--text-secondary)] leading-relaxed">MCP対応のAIエージェントに VibeShift MCPサーバーを接続し、以下のように依頼してください：</p>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 font-mono text-xs text-[var(--text-secondary)] leading-relaxed">
              「VibeShiftに新しいプロジェクトを作成してください。システム名は○○で、目的は○○です。」
            </div>
            <p className="text-[var(--text-muted)] text-xs">AIが <code className="bg-[var(--bg-muted)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] font-mono">create_project</code> ツールでプロジェクトを作成し、要求の洗い出しまでサポートします。</p>
          </div>
        )}

        {isLoading && (
          <p className="text-center text-[var(--text-muted)] text-sm">読み込み中...</p>
        )}

        <div className="space-y-3">
          {projects?.map((p: any) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group block p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] hover:border-[var(--border-hover)] hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center">
                    <FolderTree size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm tracking-tight">{p.name}</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(p.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
