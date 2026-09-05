import React, { useState } from 'react';
import {
  GitCommit, FolderOpen, CheckCircle2, AlertCircle,
  ArrowRight, File, Cpu, Puzzle, GitBranch
} from 'lucide-react';
import type { TreeItem } from '../types/drift';

interface MondayVsFridayProps {
  baselineTree: TreeItem[];
  currentTree: TreeItem[];
  baselineLabel?: string;
  currentLabel?: string;
}

const typeIcon = (type: TreeItem['type']) => {
  switch (type) {
    case 'process':   return <Cpu className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />;
    case 'pipe':      return <GitBranch className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    case 'extension': return <Puzzle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
    default:          return <File className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
  }
};

function TreeNode({ node, depth = 0 }: { node: TreeItem; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isAdded = node.status === 'added';
  const isRevoked = node.status === 'revoked';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="font-mono text-xs">
      <div
        className={`flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition-colors ${
          isAdded
            ? 'bg-red-950/30 border border-red-900/40 text-red-300'
            : isRevoked
            ? 'text-slate-600 line-through'
            : 'text-slate-400 hover:bg-slate-900/40'
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          {typeIcon(node.type)}
          <span className="truncate" title={node.name}>
            {isAdded ? '+ ' : ''}{node.name}
          </span>
        </span>
        {node.detail && (
          <span className={`ml-2 text-[10px] flex-shrink-0 ${isAdded ? 'text-red-400 font-semibold' : 'text-slate-600'}`}>
            {node.detail}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className="border-l ml-4 pl-0" style={{ borderColor: isAdded ? '#7f1d1d80' : '#1e293b' }}>
          {node.children!.map(child => (
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
      <FolderOpen className="w-8 h-8 text-slate-700" />
      <p className="font-mono text-xs text-slate-600">{message}</p>
    </div>
  );
}

export const MondayVsFriday: React.FC<MondayVsFridayProps> = ({
  baselineTree,
  currentTree,
  baselineLabel = 'BASELINE POSTURE',
  currentLabel = 'CURRENT AUDIT',
}) => {
  const addedCount = currentTree.reduce((n, node) => {
    const countAdded = (t: TreeItem): number =>
      (t.status === 'added' ? 1 : 0) + (t.children?.reduce((s, c) => s + countAdded(c), 0) ?? 0);
    return n + countAdded(node);
  }, 0);

  return (
    <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
        <div>
          <h3
            className="text-base font-bold text-slate-100 flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <GitCommit className="w-4 h-4 text-cyan-400" />
            Privilege Graph Mutation
          </h3>
          <p className="font-mono text-xs text-slate-400 mt-0.5">
            Visual diff of running handles against the clean baseline.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            Clean baseline
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className="px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-800/40">
            {addedCount > 0 ? `+${addedCount} new handles` : 'Current audit'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline column */}
        <div className="rounded-lg border border-slate-800/70 bg-[#090b10] p-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3">
            <span className="font-mono text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {baselineLabel}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {baselineTree.length} entries
            </span>
          </div>
          {baselineTree.length === 0
            ? <EmptyState message="Set a baseline snapshot to see the comparison" />
            : (
              <div className="space-y-1">
                {baselineTree.map(node => (
                  <TreeNode key={node.id} node={node} />
                ))}
              </div>
            )
          }
        </div>

        {/* Current column */}
        <div className="rounded-lg border border-red-950/40 bg-[#090b10] p-3.5 shadow-[inset_0_0_20px_rgba(239,68,68,0.03)]">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3">
            <span className="font-mono text-xs font-semibold text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {currentLabel}
            </span>
            <span className="font-mono text-[10px] text-red-400 font-semibold">
              {addedCount > 0 ? `+${addedCount} exposed handles` : 'No new handles'}
            </span>
          </div>
          {currentTree.length === 0
            ? <EmptyState message="Run a scan to populate the current posture tree" />
            : (
              <div className="space-y-1">
                {currentTree.map(node => (
                  <TreeNode key={node.id} node={node} />
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
};
