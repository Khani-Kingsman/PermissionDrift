import React, { useState } from 'react';
import { GitCommit, FolderOpen, CheckCircle2, AlertCircle, ArrowRight, File, Cpu, Puzzle, GitBranch } from 'lucide-react';
import type { TreeItem } from '../types/drift';

interface MondayVsFridayProps {
  baselineTree: TreeItem[];
  currentTree: TreeItem[];
  baselineLabel?: string;
  currentLabel?: string;
  theme?: 'black' | 'white';
}

const typeIcon = (type: TreeItem['type'], isBlack: boolean) => {
  switch (type) {
    case 'process':
      return <Cpu className={`w-3.5 h-3.5 flex-shrink-0 ${isBlack ? 'text-neutral-300' : 'text-neutral-800'}`} />;
    case 'pipe':
      return <GitBranch className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    case 'extension':
      return <Puzzle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />;
    default:
      return <File className={`w-3.5 h-3.5 flex-shrink-0 ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`} />;
  }
};

function TreeNode({ node, depth = 0, isBlack = false }: { node: TreeItem; depth?: number; isBlack?: boolean }) {
  const [open, setOpen] = useState(depth < 1);
  const isAdded = node.status === 'added';
  const isRevoked = node.status === 'revoked';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="font-geist-mono text-xs">
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
          isAdded
            ? isBlack
              ? 'bg-red-950/40 border border-red-800/60 text-red-300 font-medium'
              : 'bg-red-50 border border-red-200 text-red-800 font-medium'
            : isRevoked
            ? isBlack
              ? 'text-neutral-600 line-through'
              : 'text-neutral-400 line-through'
            : isBlack
            ? 'text-neutral-300 hover:bg-neutral-800/60'
            : 'text-neutral-700 hover:bg-neutral-100/70'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          {typeIcon(node.type, isBlack)}
          <span className="truncate" title={node.name}>
            {isAdded ? '+ ' : ''}
            {node.name}
          </span>
        </span>
        {node.detail && (
          <span
            className={`ml-2 text-[10px] flex-shrink-0 ${
              isAdded
                ? isBlack ? 'text-red-400 font-semibold' : 'text-red-600 font-semibold'
                : isBlack ? 'text-neutral-500' : 'text-neutral-400'
            }`}
          >
            {node.detail}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className={`border-l ml-4 pl-0 ${isBlack ? 'border-neutral-800' : 'border-neutral-200'}`}>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} isBlack={isBlack} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message, isBlack }: { message: string; isBlack: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <FolderOpen className={`w-7 h-7 ${isBlack ? 'text-neutral-700' : 'text-neutral-300'}`} />
      <p className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>{message}</p>
    </div>
  );
}

export const MondayVsFriday: React.FC<MondayVsFridayProps> = ({
  baselineTree,
  currentTree,
  baselineLabel = 'CLEAN BASELINE',
  currentLabel = 'CURRENT RUNTIME AUDIT',
  theme = 'white',
}) => {
  const isBlack = theme === 'black';
  const addedCount = currentTree.reduce((n, node) => {
    const countAdded = (t: TreeItem): number =>
      (t.status === 'added' ? 1 : 0) + (t.children?.reduce((s, c) => s + countAdded(c), 0) ?? 0);
    return n + countAdded(node);
  }, 0);

  return (
    <div className={`rounded-2xl border backdrop-blur-md p-6 transition-all ${
      isBlack
        ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
        : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm hover:shadow-md'
    }`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b gap-2 ${
        isBlack ? 'border-neutral-800/80' : 'border-neutral-100'
      }`}>
        <div>
          <h3 className={`text-base font-bold flex items-center gap-2 tracking-tight ${
            isBlack ? 'text-white' : 'text-neutral-900'
          }`}>
            <GitCommit className={`w-4 h-4 ${isBlack ? 'text-white' : 'text-black'}`} />
            Privilege Graph Mutation
          </h3>
          <p className={`font-geist-mono text-xs mt-0.5 ${isBlack ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Differential comparison of active IDE &amp; tool handles against baseline.
          </p>
        </div>
        <div className="flex items-center gap-2 font-geist-mono text-[11px]">
          <span className={`px-2.5 py-0.5 rounded-full border ${
            isBlack
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            Clean Baseline
          </span>
          <ArrowRight className="w-3 h-3 text-neutral-400" />
          <span className={`px-2.5 py-0.5 rounded-full border font-semibold ${
            isBlack
              ? 'bg-red-950/40 text-red-300 border-red-800/60'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {addedCount > 0 ? `+${addedCount} Dangerous Handles` : 'Zero Mutation'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline column */}
        <div className={`rounded-xl border p-4 ${
          isBlack
            ? 'border-neutral-800/80 bg-[#141822]/70'
            : 'border-neutral-200/70 bg-neutral-50/80'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 mb-3 ${
            isBlack ? 'border-neutral-800' : 'border-neutral-200/60'
          }`}>
            <span className={`font-geist-mono text-xs font-semibold flex items-center gap-1.5 ${
              isBlack ? 'text-emerald-400' : 'text-emerald-700'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {baselineLabel}
            </span>
            <span className={`font-geist-mono text-[10px] ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {baselineTree.length} registered nodes
            </span>
          </div>
          {baselineTree.length === 0 ? (
            <EmptyState message="Click 'Set as baseline' on any snapshot to activate" isBlack={isBlack} />
          ) : (
            <div className="space-y-1">
              {baselineTree.map((node) => (
                <TreeNode key={node.id} node={node} isBlack={isBlack} />
              ))}
            </div>
          )}
        </div>

        {/* Current column */}
        <div className={`rounded-xl border p-4 ${
          isBlack
            ? 'border-red-900/40 bg-red-950/20'
            : 'border-red-200/70 bg-red-50/20'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 mb-3 ${
            isBlack ? 'border-red-900/50' : 'border-red-100'
          }`}>
            <span className={`font-geist-mono text-xs font-semibold flex items-center gap-1.5 ${
              isBlack ? 'text-red-400' : 'text-red-700'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              {currentLabel}
            </span>
            <span className={`font-geist-mono text-[10px] font-semibold ${
              isBlack ? 'text-red-400' : 'text-red-600'
            }`}>
              {addedCount > 0 ? `+${addedCount} exposed handles` : 'Nominal'}
            </span>
          </div>
          {currentTree.length === 0 ? (
            <EmptyState message="Run a posture scan to inspect runtime handles" isBlack={isBlack} />
          ) : (
            <div className="space-y-1">
              {currentTree.map((node) => (
                <TreeNode key={node.id} node={node} isBlack={isBlack} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
