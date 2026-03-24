"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TraceGraph } from "@/components/graph/TraceGraph";
import { NodeDetail } from "@/components/detail/NodeDetail";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useAppStore } from "@/lib/store";

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

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b bg-white flex items-center px-4 shrink-0">
        <a href="/" className="font-bold text-lg mr-4">
          CddAI
        </a>
        {project && (
          <span className="text-gray-500">{project.name}</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[270px] border-r bg-white flex flex-col shrink-0">
          <ChatPanel projectId={projectId} onNodesCreated={refetchGraph} />
        </div>

        <div className="flex-1 relative">
          {graph && (
            <TraceGraph
              nodes={graph.nodes}
              edges={graph.edges}
              projectId={projectId}
            />
          )}
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
    </div>
  );
}
