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

  return <div ref={ref} className="my-2 flex justify-center" />;
}

interface Props {
  children: string;
  className?: string;
}

export function Markdown({ children, className = "" }: Props) {
  return (
    <div
      className={`prose prose-sm prose-gray max-w-none
        prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
        prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-pre:text-xs prose-pre:rounded prose-pre:overflow-x-auto
        prose-code:text-xs prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
        prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:px-2 prose-th:py-1 prose-th:bg-gray-50
        prose-td:border prose-td:border-gray-300 prose-td:px-2 prose-td:py-1
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
