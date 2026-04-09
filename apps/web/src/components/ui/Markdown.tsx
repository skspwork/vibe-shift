"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useId } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default" });

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      try {
        const { svg } = await mermaid.render(`mermaid${id}`, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.textContent = code;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  return <div ref={ref} className="my-3 flex justify-center" />;
}

interface Props {
  children: string;
  className?: string;
}

export function Markdown({ children, className = "" }: Props) {
  return (
    <div
      className={`prose prose-sm max-w-none
        prose-headings:font-bold prose-headings:tracking-tight prose-headings:mt-4 prose-headings:mb-1.5
        prose-h3:text-sm prose-h4:text-xs
        prose-p:my-1.5 prose-p:leading-relaxed
        prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
        prose-strong:font-semibold
        prose-pre:bg-[var(--bg-muted)] prose-pre:text-[var(--text-primary)] prose-pre:text-xs prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:border prose-pre:border-[var(--border-default)]
        prose-code:text-xs prose-code:font-mono prose-code:bg-[var(--bg-muted)] prose-code:text-[var(--text-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
        prose-table:border-collapse prose-table:text-xs
        prose-th:border prose-th:border-[var(--border-default)] prose-th:px-2.5 prose-th:py-1.5 prose-th:bg-[var(--bg-muted)] prose-th:font-semibold prose-th:text-left
        prose-td:border prose-td:border-[var(--border-default)] prose-td:px-2.5 prose-td:py-1.5
        prose-a:text-[var(--brand-primary)] prose-a:no-underline hover:prose-a:underline
        ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children: preChildren, ...rest }) {
            const child = preChildren as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
            if (child?.props?.className?.includes("language-mermaid")) {
              return (
                <MermaidBlock
                  code={String(child.props.children).replace(/\n$/, "")}
                />
              );
            }
            return <pre {...rest}>{preChildren}</pre>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
