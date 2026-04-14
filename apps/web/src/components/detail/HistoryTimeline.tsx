"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ChangelogEntry {
  changelog: { id: string; title: string; created_at: string };
  purpose: string;
  linked_at: string;
  reason: string;
}

const PURPOSE_STYLES: Record<string, string> = {
  "作成時": "bg-green-100 text-green-700",
  "更新": "bg-blue-100 text-blue-700",
  "非活性化": "bg-gray-200 text-gray-600",
  "活性化": "bg-amber-100 text-amber-700",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryTimeline({ entries }: { entries: ChangelogEntry[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.linked_at).getTime() - new Date(b.linked_at).getTime()
  );

  return (
    <div>
      {sorted.map((entry, i) => (
        <TimelineEntry
          key={entry.changelog.id + entry.linked_at}
          entry={entry}
          isLast={i === sorted.length - 1}
        />
      ))}
    </div>
  );
}

function TimelineEntry({ entry, isLast }: { entry: ChangelogEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const badgeStyle = PURPOSE_STYLES[entry.purpose] || "bg-gray-100 text-gray-600";

  useEffect(() => {
    const el = textRef.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight);
  }, [entry.reason]);

  return (
    <div className="flex gap-2.5 items-stretch">
      <div className="flex flex-col items-center w-3 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0" />
        {!isLast && <div className="w-px flex-1 bg-gray-200" />}
      </div>

      <div className={`min-w-0 ${isLast ? "" : "pb-3"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">
            {formatDate(entry.linked_at)}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium leading-none ${badgeStyle}`}>
            {entry.purpose}
          </span>
        </div>
        <p className="text-xs font-medium text-gray-700 mt-0.5">
          {entry.changelog.title}
        </p>
        {entry.reason !== entry.changelog.title && (
          <p
            ref={textRef}
            className={`text-xs text-gray-500 mt-0.5 leading-relaxed whitespace-pre-wrap ${
              !expanded ? "line-clamp-3" : ""
            }`}
          >
            {entry.reason}
          </p>
        )}

        {clamped && entry.reason !== entry.changelog.title && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-blue-500 text-[11px] mt-0.5 hover:underline"
          >
            {expanded ? (
              <><ChevronUp size={12} /> 閉じる</>
            ) : (
              <><ChevronDown size={12} /> 詳細を表示</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
