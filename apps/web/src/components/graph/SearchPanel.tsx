"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { NODE_LABELS } from "@vibeshift/shared";
import { Search, X } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  overview: "var(--node-overview-border)",
  need: "var(--node-need-border)",
  feature: "var(--node-feature-border)",
  spec: "var(--node-spec-border)",
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
  const { setSelectedNodeId, setFocusNodeId, setPanToNodeId, selectedNodeId, focusNodeId, showDisabledNodes } = useAppStore();
  const isSearchSelect = useRef(false);

  useEffect(() => {
    if (isSearchSelect.current) {
      isSearchSelect.current = false;
      return;
    }
    setOpen(false);
  }, [focusNodeId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results } = useQuery({
    queryKey: ["search", projectId, debouncedQuery, showDisabledNodes],
    queryFn: () => api.searchNodes(projectId, debouncedQuery, undefined, showDisabledNodes),
    enabled: debouncedQuery.length > 0,
  });

  const showDropdown = open && debouncedQuery.length > 0;

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
      isSearchSelect.current = true;
      setSelectedNodeId(nodeId);
      setFocusNodeId(nodeId);
      setPanToNodeId(nodeId);
    },
    [setSelectedNodeId, setFocusNodeId, setPanToNodeId]
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
      <div className="flex items-center gap-1.5 border border-[var(--border-default)] rounded-md px-2.5 py-1 bg-[var(--bg-base)] text-sm focus-within:ring-1 focus-within:ring-[var(--brand-primary)] focus-within:border-[var(--brand-primary)] transition-colors">
        <Search size={14} className="text-[var(--text-muted)] shrink-0" />
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
          className="bg-transparent outline-none w-40 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
        {query && (
          <button onClick={handleClear} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results && results.length > 0 ? (
            results.map((node: any) => (
              <button
                key={node.id}
                onClick={() => handleSelect(node.id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-[var(--bg-muted)] border-b border-[var(--border-default)] last:border-b-0 transition-colors ${node.id === selectedNodeId ? "bg-[var(--bg-accent)]" : ""}`}
                style={{ borderLeftWidth: 3, borderLeftColor: NODE_COLORS[node.type] || "var(--text-muted)" }}
              >
                <div className="text-sm font-medium truncate text-[var(--text-primary)]">{node.title}</div>
                {node.path_types && (
                  <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{node.path_types}</div>
                )}
              </button>
            ))
          ) : results && results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">該当なし</div>
          ) : (
            <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">検索中...</div>
          )}
        </div>
      )}
    </div>
  );
}
