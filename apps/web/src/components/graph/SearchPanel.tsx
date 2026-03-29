"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { NODE_LABELS } from "@cddai/shared";
import { Search, X } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  overview: "#1a2a3a",
  need: "#378ADD",
  req: "#1D9E75",
  spec: "#7F77DD",
  basic_design: "#EF9F27",
  detail_design: "#D4880E",
  code: "#639922",
  task: "#D85A30",
  test: "#D4537E",
};

interface Props {
  projectId: string;
}

export function SearchPanel({ projectId }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSelectedNodeId, setFocusNodeId } = useAppStore();

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results } = useQuery({
    queryKey: ["search", projectId, debouncedQuery],
    queryFn: () => api.searchNodes(projectId, debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const showDropdown = open && debouncedQuery.length > 0;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setFocusNodeId(nodeId);
      setOpen(false);
      setQuery("");
      setDebouncedQuery("");
    },
    [setSelectedNodeId, setFocusNodeId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1 border rounded px-2 py-0.5 bg-gray-50 text-sm">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="ノード検索..."
          className="bg-transparent outline-none w-40 text-sm"
        />
        {query && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded shadow-lg z-50 max-h-80 overflow-y-auto">
          {results && results.length > 0 ? (
            results.map((node: any) => (
              <button
                key={node.id}
                onClick={() => handleSelect(node.id)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 transition"
                style={{ borderLeftWidth: 3, borderLeftColor: NODE_COLORS[node.type] || "#999" }}
              >
                <div className="text-sm font-medium truncate">{node.title}</div>
                {node.path_types && (
                  <div className="text-xs text-gray-400 truncate">{node.path_types}</div>
                )}
              </button>
            ))
          ) : results && results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">該当なし</div>
          ) : (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">検索中...</div>
          )}
        </div>
      )}
    </div>
  );
}
