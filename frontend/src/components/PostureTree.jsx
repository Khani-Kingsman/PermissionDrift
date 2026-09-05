import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Key, Cloud, Box, Layers,
  Puzzle, Terminal, Wifi, Lock, AlertTriangle, CheckCircle2,
  XCircle, Minus
} from 'lucide-react';

const CATEGORY_ICONS = {
  ssh_dir: Key,
  aws_credentials: Cloud,
  gcp_config: Cloud,
  azure_config: Cloud,
  docker_socket: Box,
  docker_pipe: Box,
  kube_config: Layers,
  npm_rc: Terminal,
  pypirc: Terminal,
  netrc: Terminal,
  default: Lock,
};

function statusInfo(path) {
  if (!path.exists) return { icon: Minus, color: '#334155', dot: 'dot-gray', label: 'Not Found' };
  if (path.accessed_by_processes?.length > 0) return { icon: AlertTriangle, color: '#f97316', dot: 'dot-amber', label: 'Active' };
  return { icon: CheckCircle2, color: '#10b981', dot: 'dot-green', label: 'Exists' };
}

function PathRow({ path, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const IconComp = CATEGORY_ICONS[path.name] || CATEGORY_ICONS.default;
  const status = statusInfo(path);
  const StatusIcon = status.icon;
  const hasProcs = path.accessed_by_processes?.length > 0;

  return (
    <div className={`border-b last:border-b-0 transition-colors ${hasProcs ? 'hover:bg-amber-500/5' : 'hover:bg-white/[0.02]'}`}
         style={{ borderColor: 'var(--border)' }}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
        onClick={() => hasProcs && setExpanded(e => !e)}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />

        {/* Icon */}
        <IconComp size={14} style={{ color: hasProcs ? '#f97316' : path.exists ? '#10b981' : '#334155' }} className="flex-shrink-0" />

        {/* Name */}
        <span className="flex-1 text-sm mono" style={{ color: path.exists ? 'var(--text)' : 'var(--muted)' }}>
          {path.name}
        </span>

        {/* Proc count badge */}
        {hasProcs && (
          <span className="text-xs px-1.5 py-0.5 rounded-full badge-high mono">
            {path.accessed_by_processes.length} proc{path.accessed_by_processes.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Expand chevron */}
        {hasProcs && (
          <span style={{ color: 'var(--muted)' }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </div>

      {/* Expanded process list */}
      {expanded && hasProcs && (
        <div className="px-9 pb-3 animate-slide-in">
          <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Accessing processes</div>
          <div className="flex flex-wrap gap-1.5">
            {path.accessed_by_processes.map((proc, i) => (
              <span key={i} className="text-xs mono px-2 py-1 rounded"
                    style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                {proc}
              </span>
            ))}
          </div>
          {path.path && (
            <div className="mt-2 text-xs mono text-slate-600 truncate" title={path.path}>
              {path.path}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  {
    id: 'ssh',
    label: 'SSH Keys',
    icon: Key,
    filter: p => p.name === 'ssh_dir' || p.name.startsWith('ssh'),
  },
  {
    id: 'cloud',
    label: 'Cloud CLIs',
    icon: Cloud,
    filter: p => ['aws_credentials', 'gcp_config', 'azure_config', 'gcp_application_credentials'].includes(p.name),
  },
  {
    id: 'container',
    label: 'Docker / Kube',
    icon: Box,
    filter: p => p.name.includes('docker') || p.name.includes('kube'),
  },
  {
    id: 'dev',
    label: 'Dev Configs',
    icon: Terminal,
    filter: p => ['npm_rc', 'pypirc', 'netrc', 'gitconfig'].includes(p.name),
  },
];

function sectionStatus(paths) {
  if (paths.some(p => p.accessed_by_processes?.length > 0)) return 'dot-amber';
  if (paths.some(p => p.exists)) return 'dot-green';
  return 'dot-gray';
}

export default function PostureTree({ snapshot }) {
  const [openSections, setOpenSections] = useState(new Set(['ssh', 'cloud']));

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: 'var(--muted)' }}>
        <Lock size={24} style={{ opacity: 0.3 }} />
        <span className="text-sm">No snapshot data</span>
      </div>
    );
  }

  const allPaths = snapshot.sensitive_paths || [];

  const toggleSection = (id) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col divide-y" style={{ divideColor: 'var(--border)' }}>
      {SECTIONS.map(section => {
        const paths = allPaths.filter(section.filter);
        const dotClass = sectionStatus(paths);
        const isOpen = openSections.has(section.id);
        const SectionIcon = section.icon;

        return (
          <div key={section.id}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              onClick={() => toggleSection(section.id)}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
              <SectionIcon size={15} style={{ color: 'var(--muted)' }} className="flex-shrink-0" />
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
                {section.label}
              </span>
              <span className="text-xs mono" style={{ color: 'var(--muted)' }}>
                {paths.filter(p => p.exists).length}/{paths.length}
              </span>
              <span style={{ color: 'var(--muted)' }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {isOpen && paths.length > 0 && (
              <div className="animate-slide-in" style={{ background: 'rgba(0,0,0,0.15)' }}>
                {paths.map((path, i) => (
                  <PathRow key={path.name + i} path={path} isLast={i === paths.length - 1} />
                ))}
              </div>
            )}

            {isOpen && paths.length === 0 && (
              <div className="px-10 py-2 text-xs" style={{ color: 'var(--muted)' }}>
                Nothing detected
              </div>
            )}
          </div>
        );
      })}

      {/* CLI Tools row */}
      {snapshot.cli_tools?.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full dot-green flex-shrink-0" />
            <Terminal size={15} style={{ color: 'var(--muted)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>CLI Tools</span>
            <span className="text-xs mono ml-auto" style={{ color: 'var(--muted)' }}>
              {snapshot.cli_tools.length} found
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-9">
            {snapshot.cli_tools.map(tool => (
              <span key={tool} className="text-xs mono px-2 py-0.5 rounded"
                    style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Listening Ports */}
      {snapshot.listening_ports?.filter(p => p.is_risky).length > 0 && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full dot-amber flex-shrink-0" />
            <Wifi size={15} style={{ color: '#f59e0b' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Risky Ports</span>
            <span className="text-xs mono ml-auto badge-high px-1.5 py-0.5 rounded-full">
              {snapshot.listening_ports.filter(p => p.is_risky).length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-9">
            {snapshot.listening_ports.filter(p => p.is_risky).map(port => (
              <span key={port.port} className="text-xs mono px-2 py-0.5 rounded"
                    style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                :{port.port} {port.process_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
