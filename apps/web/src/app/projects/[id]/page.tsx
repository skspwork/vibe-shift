"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TraceGraph } from "@/components/graph/TraceGraph";
import { ViewToolbar } from "@/components/graph/ViewToolbar";
import { NodeDetail } from "@/components/detail/NodeDetail";
import { ProjectSettings } from "@/components/setup/ProjectSettings";
import { useAppStore } from "@/lib/store";
import { Settings, Download } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });

  const showDisabledNodes = useAppStore((s) => s.showDisabledNodes);

  const { data: graph, refetch: refetchGraph } = useQuery({
    queryKey: ["graph", projectId, showDisabledNodes],
    queryFn: () => api.getGraph(projectId, showDisabledNodes),
    refetchInterval: 3000,
  });

  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const [showSettings, setShowSettings] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);

  useEffect(() => {
    const saved = localStorage.getItem("vibeshift:panelWidth");
    if (saved) setPanelWidth(Number(saved) || 320);
  }, []);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(window.innerWidth * 0.5, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
      localStorage.setItem("vibeshift:panelWidth", String(newWidth));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b bg-white flex items-center px-4 shrink-0">
        <a href="/" className="font-bold text-lg mr-4">
          VibeShift
        </a>
        {project && (
          <>
            <span className="text-gray-500">{project.name}</span>
            <button
              onClick={() => api.exportProject(projectId)}
              className="ml-2 text-gray-400 hover:text-gray-600 transition"
              title="HTMLエクスポート"
            >
              <Download size={16} />
            </button>
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
        <div className="flex-1 flex flex-col">
          <ViewToolbar projectId={projectId} />
          <div className="flex-1 relative">
            {graph ? (
              <TraceGraph
                nodes={graph.nodes}
                edges={graph.edges}
                projectId={projectId}
              />
            ) : null}
          </div>
        </div>

        <div
          className="w-2 hover:bg-blue-400 bg-gray-200 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={startResize}
        />
        <div className="border-l bg-white overflow-y-auto shrink-0" style={{ width: panelWidth }}>
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
