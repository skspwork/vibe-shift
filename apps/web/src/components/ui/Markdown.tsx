"use client";

import ReactMarkdown from "react-markdown";

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
        prose-pre:bg-gray-100 prose-pre:text-xs prose-pre:rounded
        prose-code:text-xs prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
        ${className}`}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
