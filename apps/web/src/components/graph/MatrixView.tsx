"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

interface Props {
  nodes: any[];
  edges: any[];
}

export function MatrixView({ nodes, edges }: Props) {
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);

  const reqNodes = useMemo(() => nodes.filter((n) => n.type === "req"), [nodes]);
  const testNodes = useMemo(() => nodes.filter((n) => n.type === "test"), [nodes]);

  // Build a mapping: for each req, find all connected test nodes (downstream via any path)
  const coverageMap = useMemo(() => {
    const adjDown = new Map<string, string[]>();
    for (const e of edges) {
      const list = adjDown.get(e.from_node_id) || [];
      list.push(e.to_node_id);
      adjDown.set(e.from_node_id, list);
    }

    const map = new Map<string, Set<string>>();
    for (const req of reqNodes) {
      const reachable = new Set<string>();
      const queue = [req.id];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const children = adjDown.get(current) || [];
        for (const child of children) {
          const childNode = nodes.find((n) => n.id === child);
          if (childNode?.type === "test") reachable.add(child);
          queue.push(child);
        }
      }
      map.set(req.id, reachable);
    }
    return map;
  }, [reqNodes, nodes, edges]);

  // Coverage stats
  const coveredReqs = reqNodes.filter((r) => (coverageMap.get(r.id)?.size || 0) > 0);
  const coverageRate = reqNodes.length > 0
    ? Math.round((coveredReqs.length / reqNodes.length) * 100)
    : 0;

  if (reqNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        要件（req）ノードがありません
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="font-medium">要件 x テスト カバレッジ</span>
        <span className="text-gray-500">
          {coveredReqs.length}/{reqNodes.length} 要件カバー済み ({coverageRate}%)
        </span>
        <div className="flex items-center gap-2 ml-auto text-xs text-gray-400">
          <span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-400" /> カバー済み
          <span className="inline-block w-4 h-4 rounded bg-gray-50 border border-gray-200" /> 未カバー
        </div>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r px-3 py-2 text-left font-medium text-gray-600 min-w-[180px]">
                要件 (req)
              </th>
              {testNodes.map((t) => (
                <th
                  key={t.id}
                  className="border-b border-r px-2 py-2 text-center font-medium text-gray-600 min-w-[100px] cursor-pointer hover:bg-gray-100"
                  onClick={() => setSelectedNodeId(t.id)}
                  title={t.content}
                >
                  {t.title}
                </th>
              ))}
              {testNodes.length === 0 && (
                <th className="border-b px-3 py-2 text-center text-gray-400">
                  テストノードなし
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {reqNodes.map((req) => {
              const covered = coverageMap.get(req.id) || new Set();
              return (
                <tr key={req.id} className="hover:bg-blue-50/30">
                  <td
                    className="sticky left-0 z-10 bg-white border-b border-r px-3 py-2 font-medium cursor-pointer hover:text-blue-600"
                    onClick={() => setSelectedNodeId(req.id)}
                    title={req.content}
                  >
                    {req.title}
                  </td>
                  {testNodes.map((t) => {
                    const isCovered = covered.has(t.id);
                    return (
                      <td
                        key={t.id}
                        className={`border-b border-r text-center ${
                          isCovered
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-50 text-gray-300"
                        }`}
                      >
                        {isCovered ? "●" : "—"}
                      </td>
                    );
                  })}
                  {testNodes.length === 0 && (
                    <td className="border-b text-center text-gray-300 py-2">—</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
