"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Search, X } from "lucide-react";

interface Props {
  projectId: string;
}

export function SearchPanel({ projectId }: Props) {
  const { searchQuery, setSearchQuery } = useAppStore();
  const [input, setInput] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input, setSearchQuery]);

  const handleClear = useCallback(() => {
    setInput("");
    setSearchQuery("");
  }, [setSearchQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
      }
    },
    [handleClear]
  );

  return (
    <div className="flex items-center gap-1.5 border border-[var(--border-default)] rounded-md px-2.5 py-1 bg-[var(--bg-base)] text-sm focus-within:ring-1 focus-within:ring-[var(--brand-primary)] focus-within:border-[var(--brand-primary)] transition-colors">
      <Search size={14} className="text-[var(--text-muted)] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="フィルタ..."
        className="bg-transparent outline-none w-40 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      />
      {input && (
        <button onClick={handleClear} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
