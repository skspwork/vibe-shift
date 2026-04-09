"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TraceGraph } from "@/components/graph/TraceGraph";
import { ViewToolbar } from "@/components/graph/ViewToolbar";
import { NodeDetail } from "@/components/detail/NodeDetail";
import { ProjectSettings } from "@/components/setup/ProjectSettings";
import { useAppStore } from "@/lib/store";
import { Settings } from "lucide-react";
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
      <header className="h-12 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center px-5 shrink-0">
        <a href="/" className="font-bold text-base tracking-tight mr-1">
          Vibe<span className="text-[var(--brand-primary)]">Shift</span>
        </a>
        {project && (
          <>
            <span className="text-[var(--text-muted)] mx-2">/</span>
            <span className="text-[var(--text-secondary)] text-sm font-medium">{project.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                title="プロジェクト設定"
              >
                <Settings size={15} />
              </button>
            </div>
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
          className="w-1.5 hover:bg-[var(--brand-primary)] bg-[var(--border-default)] cursor-col-resize shrink-0 transition-colors duration-150"
          onMouseDown={startResize}
        />
        <div className="border-l border-[var(--border-default)] bg-[var(--bg-surface)] overflow-y-auto shrink-0" style={{ width: panelWidth }}>
          {selectedNodeId ? (
            <NodeDetail
              nodeId={selectedNodeId}
              projectId={projectId}
              onUpdate={refetchGraph}
            />
          ) : (
            <div className="p-6 text-[var(--text-muted)] text-sm flex items-center justify-center h-full">
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
