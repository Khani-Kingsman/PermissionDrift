import React, { useState } from 'react';
import { GitCommit, FolderOpen, CheckCircle2, AlertCircle, ArrowRight, File, Cpu, Puzzle, GitBranch } from 'lucide-react';
import type { TreeItem } from '../types/drift';

interface MondayVsFridayProps {
  baselineTree: TreeItem[];
  currentTree: TreeItem[];
  baselineLabel?: string;
  currentLabel?: string;
}

const typeIcon = (type: TreeItem['type']) => {
  switch (type) {
    case 'process':
      return <Cpu className="w-3.5 h-3.5 text-neutral-800 flex-shrink-0" />;
    case 'pipe':
      return <GitBranch className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />;
    case 'extension':
      return <Puzzle className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />;
  }
};

function TreeNode({ node, depth = 0 }: { node: TreeItem; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isAdded = node.status === 'added';
  const isRevoked = node.status === 'revoked';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="font-geist-mono text-xs">
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
          isAdded
            ? 'bg-red-50 border border-red-200 text-red-800 font-medium'
            : isRevoked
            ? 'text-neutral-400 line-through'
            : 'text-neutral-700 hover:bg-neutral-100/70'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          {typeIcon(node.type)}
          <span className="truncate" title={node.name}>
            {isAdded ? '+ ' : ''}
            {node.name}
          </span>
        </span>
        {node.detail && (
          <span
            className={`ml-2 text-[10px] flex-shrink-0 ${
              isAdded ? 'text-red-600 font-semibold' : 'text-neutral-400'
            }`}
          >
            {node.detail}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className="border-l ml-4 pl-0 border-neutral-200">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <FolderOpen className="w-7 h-7 text-neutral-300" />
      <p className="font-geist-mono text-xs text-neutral-400">{message}</p>
    </div>
  );
}

export const MondayVsFriday: React.FC<MondayVsFridayProps> = ({
  baselineTree,
  currentTree,
  baselineLabel = 'CLEAN BASELINE',
  currentLabel = 'CURRENT RUNTIME AUDIT',
}) => {
  const addedCount = currentTree.reduce((n, node) => {
    const countAdded = (t: TreeItem): number =>
      (t.status === 'added' ? 1 : 0) + (t.children?.reduce((s, c) => s + countAdded(c), 0) ?? 0);
    return n + countAdded(node);
  }, 0);

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-neutral-100 gap-2">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 tracking-tight">
            <GitCommit className="w-4 h-4 text-black" />
            Privilege Graph Mutation
          </h3>
          <p className="font-geist-mono text-xs text-neutral-500 mt-0.5">
            Differential comparison of active IDE &amp; tool handles against baseline.
          </p>
        </div>
        <div className="flex items-center gap-2 font-geist-mono text-[11px]">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Clean Baseline
          </span>
          <ArrowRight className="w-3 h-3 text-neutral-400" />
          <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">
            {addedCount > 0 ? `+${addedCount} Dangerous Handles` : 'Zero Mutation'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline column */}
        <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4">
          <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2 mb-3">
            <span className="font-geist-mono text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {baselineLabel}
            </span>
            <span className="font-geist-mono text-[10px] text-neutral-400">
              {baselineTree.length} registered nodes
            </span>
          </div>
          {baselineTree.length === 0 ? (
            <EmptyState message="Click 'Set as baseline' on any snapshot to activate" />
          ) : (
            <div className="space-y-1">
              {baselineTree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>

        {/* Current column */}
        <div className="rounded-xl border border-red-200/70 bg-red-50/20 p-4">
          <div className="flex items-center justify-between border-b border-red-100 pb-2 mb-3">
            <span className="font-geist-mono text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              {currentLabel}
            </span>
            <span className="font-geist-mono text-[10px] text-red-600 font-semibold">
              {addedCount > 0 ? `+${addedCount} exposed handles` : 'Nominal'}
            </span>
          </div>
          {currentTree.length === 0 ? (
            <EmptyState message="Run a posture scan to inspect runtime handles" />
          ) : (
            <div className="space-y-1">
              {currentTree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
