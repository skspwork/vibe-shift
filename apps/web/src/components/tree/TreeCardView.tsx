"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NODE_LABELS } from "@vibeshift/shared";
import { useAppStore } from "@/lib/store";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Node {
  id: string;
  type: string;
  title: string;
  content: string;
  disabled_at?: string | null;
  requirement_category?: string | null;
  user_name?: string | null;
}

interface Edge {
  from_node_id: string;
  to_node_id: string;
  link_type: string;
}

interface TreeNode {
  node: Node;
  children: TreeNode[];
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  projectId: string;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  overview: { bg: "var(--node-overview-bg)", border: "var(--node-overview-border)", text: "var(--node-overview-text)" },
  need: { bg: "var(--node-need-bg)", border: "var(--node-need-border)", text: "var(--node-need-text)" },
  feature: { bg: "var(--node-feature-bg)", border: "var(--node-feature-border)", text: "var(--node-feature-text)" },
  spec: { bg: "var(--node-spec-bg)", border: "var(--node-spec-border)", text: "var(--node-spec-text)" },
};

function buildTree(nodes: Node[], edges: Edge[]): TreeNode | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (e.link_type !== "derives") continue;
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  function build(id: string): TreeNode | null {
    const node = nodeMap.get(id);
    if (!node) return null;
    const childIds = childMap.get(id) || [];
    const children = childIds
      .map((cid) => build(cid))
      .filter((c): c is TreeNode => c !== null);
    return { node, children };
  }

  const overview = nodes.find((n) => n.type === "overview");
  if (!overview) return null;
  return build(overview.id);
}

function buildVisibleSet(
  matchedIds: Set<string>,
  edges: Edge[],
  nodes: Node[],
): Set<string> {
  const parentMap = new Map<string, string>();
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (e.link_type !== "derives") continue;
    parentMap.set(e.to_node_id, e.from_node_id);
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const overviewIds = new Set(nodes.filter((n) => n.type === "overview").map((n) => n.id));
  const visible = new Set<string>();

  for (const id of matchedIds) {
    // Ancestors
    let cur: string | undefined = id;
    while (cur && !visible.has(cur)) {
      visible.add(cur);
      cur = parentMap.get(cur);
    }
    // Descendants (skip if overview — would expand entire tree)
    if (!overviewIds.has(id)) {
      const queue = [id];
      while (queue.length > 0) {
        const nid = queue.shift()!;
        visible.add(nid);
        for (const child of childMap.get(nid) || []) {
          queue.push(child);
        }
      }
    }
  }

  return visible;
}

function filterTree(treeNode: TreeNode, visibleIds: Set<string>): TreeNode | null {
  if (!visibleIds.has(treeNode.node.id)) return null;
  const children = treeNode.children
    .map((c) => filterTree(c, visibleIds))
    .filter((c): c is TreeNode => c !== null);
  return { node: treeNode.node, children };
}

function CardBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.need;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {NODE_LABELS[type] || type}
    </span>
  );
}

interface TreeCardProps {
  treeNode: TreeNode;
  depth: number;
  matchedIds: Set<string> | null;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
}

function TreeCard({ treeNode, depth, matchedIds, collapsedIds, toggleCollapse }: TreeCardProps) {
  const { node, children } = treeNode;
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);

  const isFiltering = matchedIds !== null;
  const collapsed = !isFiltering && collapsedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isDisabled = !!node.disabled_at;
  const isMatch = matchedIds?.has(node.id);
  const colors = TYPE_COLORS[node.type] || TYPE_COLORS.need;
  const hasChildren = children.length > 0;
  const isSection = node.type === "need";

  return (
    <div
      id={`node-${node.id}`}
      className={isDisabled ? "opacity-50" : ""}
    >
      <div
        onClick={() => setSelectedNodeId(node.id)}
        onDoubleClick={() => { if (hasChildren && !isFiltering) toggleCollapse(node.id); }}
        className={`
          rounded-lg border cursor-pointer transition-all duration-150
          ${isSection ? "p-4" : "p-3"}
          ${isSelected ? "ring-2 ring-[var(--brand-primary)] shadow-sm" : "hover:shadow-sm"}
          ${isFiltering && !isMatch ? "opacity-50" : ""}
        `}
        style={{
          borderColor: isSelected ? "var(--brand-primary)" : colors.border,
          borderLeftWidth: isSection ? 4 : 1,
          backgroundColor: isSection ? `color-mix(in srgb, ${colors.bg} 30%, white)` : "var(--bg-surface)",
        }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && !isFiltering && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-muted)] shrink-0"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <CardBadge type={node.type} />
          {isDisabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--danger-bg)] text-[var(--danger-text)]">
              非活性
            </span>
          )}
          <span className={`font-medium truncate ${isSection ? "text-sm" : "text-xs"}`}>
            {node.title}
          </span>
          {node.type === "need" && node.requirement_category === "non_functional" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-muted)] text-[var(--text-muted)]">非機能</span>
          )}
        </div>
      </div>

      {hasChildren && !collapsed && (
        <div className={`mt-2 space-y-2 ${isSection ? "ml-2" : "ml-4"}`}>
          {children.map((child) => (
            <TreeCard
              key={child.node.id}
              treeNode={child}
              depth={depth + 1}
              matchedIds={matchedIds}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeCardView({ nodes, edges, projectId }: Props) {
  const showDisabledNodes = useAppStore((s) => s.showDisabledNodes);
  const columns = useAppStore((s) => s.columns);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const collapseAll = useAppStore((s) => s.collapseAll);
  const expandAll = useAppStore((s) => s.expandAll);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.link_type === "derives") ids.add(e.from_node_id);
    }
    return ids;
  }, [edges]);

  useEffect(() => {
    if (collapseAll > 0) setCollapsedIds(new Set(parentIds));
  }, [collapseAll, parentIds]);

  useEffect(() => {
    if (expandAll > 0) setCollapsedIds(new Set());
  }, [expandAll]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredNodes = useMemo(
    () => showDisabledNodes ? nodes : nodes.filter((n) => !n.disabled_at),
    [nodes, showDisabledNodes]
  );

  const tree = useMemo(
    () => buildTree(filteredNodes, edges),
    [filteredNodes, edges]
  );

  const { data: searchResults } = useQuery({
    queryKey: ["search-filter", projectId, searchQuery, showDisabledNodes],
    queryFn: () => api.searchNodes(projectId, searchQuery, undefined, showDisabledNodes),
    enabled: searchQuery.length > 0,
  });

  const matchedIds = useMemo<Set<string> | null>(() => {
    if (!searchQuery || !searchResults) return null;
    return new Set(searchResults.map((n: any) => n.id));
  }, [searchQuery, searchResults]);

  const displayTree = useMemo(() => {
    if (!tree) return null;
    if (!matchedIds || matchedIds.size === 0) return searchQuery ? null : tree;
    const visibleIds = buildVisibleSet(matchedIds, edges, filteredNodes);
    return filterTree(tree, visibleIds);
  }, [tree, matchedIds, edges, searchQuery]);

  if (!displayTree) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-[var(--text-muted)] text-sm bg-[var(--bg-base)]">
        {searchQuery ? "該当するノードがありません" : "ノードがありません"}
      </div>
    );
  }

  const overview = displayTree.node;
  const needs = displayTree.children;

  return (
    <div className="h-full overflow-y-auto p-5 bg-[var(--bg-base)]">
      <div className="mb-4">
        <OverviewCard node={overview} isMatch={matchedIds?.has(overview.id) ?? false} isFiltering={matchedIds !== null} />
      </div>

      <div
        className="gap-4"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          alignItems: "start",
        }}
      >
        {needs.map((need) => (
          <TreeCard
            key={need.node.id}
            treeNode={need}
            depth={0}
            matchedIds={matchedIds}
            collapsedIds={collapsedIds}
            toggleCollapse={toggleCollapse}
          />
        ))}
      </div>
    </div>
  );
}

function OverviewCard({ node, isMatch, isFiltering }: { node: Node; isMatch: boolean; isFiltering: boolean }) {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const isSelected = selectedNodeId === node.id;

  return (
    <div
      id={`node-${node.id}`}
      onClick={() => setSelectedNodeId(node.id)}
      className={`
        rounded-lg p-4 cursor-pointer transition-all duration-150
        ${isSelected ? "ring-2 ring-[var(--brand-primary)]" : "hover:opacity-90"}
        ${isFiltering && !isMatch ? "opacity-50" : ""}
      `}
      style={{
        backgroundColor: "var(--node-overview-bg)",
        color: "var(--node-overview-text)",
      }}
    >
      <div className="flex items-center gap-2">
        <CardBadge type="overview" />
        <span className="font-bold text-sm">{node.title}</span>
      </div>
    </div>
  );
}
