"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TraceGraph } from "@/components/graph/TraceGraph";
import { MatrixView } from "@/components/graph/MatrixView";
import { ViewToolbar } from "@/components/graph/ViewToolbar";
import { NodeDetail } from "@/components/detail/NodeDetail";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ProjectSettings } from "@/components/setup/ProjectSettings";
import { useAppStore } from "@/lib/store";
import { Settings } from "lucide-react";
import { useState } from "react";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });

  const { data: graph, refetch: refetchGraph } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: () => api.getGraph(projectId),
    refetchInterval: 3000,
  });

  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const viewMode = useAppStore((s) => s.viewMode);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b bg-white flex items-center px-4 shrink-0">
        <a href="/" className="font-bold text-lg mr-4">
          CddAI
        </a>
        {project && (
          <>
            <span className="text-gray-500">{project.name}</span>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-2 text-gray-400 hover:text-gray-600 transition"
              title="プロジェクト設定"
            >
              <Settings size={16} />
            </button>
          </>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[270px] border-r bg-white flex flex-col shrink-0">
          <ChatPanel projectId={projectId} onNodesCreated={refetchGraph} />
        </div>

        <div className="flex-1 flex flex-col">
          <ViewToolbar />
          <div className="flex-1 relative">
            {graph && viewMode === "matrix" ? (
              <MatrixView nodes={graph.nodes} edges={graph.edges} />
            ) : graph ? (
              <TraceGraph
                nodes={graph.nodes}
                edges={graph.edges}
                projectId={projectId}
              />
            ) : null}
          </div>
        </div>

        <div className="w-[320px] border-l bg-white overflow-y-auto shrink-0">
          {selectedNodeId ? (
            <NodeDetail
              nodeId={selectedNodeId}
              projectId={projectId}
              onUpdate={refetchGraph}
            />
          ) : (
            <div className="p-4 text-gray-400 text-sm">
              ノードをクリックして詳細を表示
            </div>
          )}
        </div>
      </div>

      {showSettings && project && (
        <ProjectSettings
          project={project}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
