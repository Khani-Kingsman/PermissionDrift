import React, { useState } from 'react';
import { 
  Key, Database, Globe, Terminal, Cpu, Network,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle,
  ShieldAlert, Lock, AlertTriangle, ExternalLink
} from 'lucide-react';

export default function PostureTree({ snapshot }) {
  const [expandedCategories, setExpandedCategories] = useState({
    credentials: true,
    docker: true,
    extensions: false,
    cli: false,
    ai_agents: true,
    ports: false
  });

  if (!snapshot) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
        No snapshot loaded. Trigger a scan above to view posture tree.
      </div>
    );
  }

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const sensitivePaths = snapshot.sensitive_paths || [];
  const dockerAccessors = snapshot.docker_socket_accessible_by || [];
  const extensions = snapshot.browser_extensions || [];
  const cliTools = snapshot.cli_tools || [];
  const processTree = snapshot.process_tree || [];
  const aiAgents = processTree.filter(p => p.is_ai_agent);
  const listeningPorts = snapshot.listening_ports || [];

  return (
    <div className="space-y-4">
      {/* Monday vs Friday posture comparison visual cue */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Active Posture State Snapshot:</span>
          <span className="font-mono text-cyan-300 font-semibold">{snapshot.scan_id?.slice(0, 8)}</span>
          <span>({snapshot.timestamp})</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Duration: {snapshot.scan_duration_ms}ms | Priority: BELOW_NORMAL
        </div>
      </div>

      {/* 1. Credentials & Sensitive Files */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('credentials')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Credentials & Sensitive Directories</h4>
              <p className="text-xs text-slate-400">SSH keys, AWS, Azure, Kubeconfig, GCloud metadata</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {sensitivePaths.filter(p => p.exists && p.name !== 'docker_pipe').length} present
            </span>
            {expandedCategories.credentials ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.credentials && (
          <div className="px-5 pb-4 pt-1 divide-y divide-slate-800/60">
            {sensitivePaths.filter(p => p.name !== 'docker_pipe').map((p, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {p.exists ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        EXISTS
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        ABSENT
                      </span>
                    )}
                    <span className="font-mono text-slate-200">{p.path}</span>
                    {p.permissions && (
                      <span className="text-[10px] font-mono text-slate-500">mode: {p.permissions}</span>
                    )}
                  </div>
                  {p.accessed_by_processes?.length > 0 && (
                    <div className="pl-6 text-[11px] text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Active handle held by: <span className="font-mono font-semibold">{p.accessed_by_processes.join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  {p.last_modified ? `mtime: ${p.last_modified.slice(0, 10)}` : 'zero reads'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Docker Named Pipe */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('docker')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Docker Engine Named Pipe</h4>
              <p className="text-xs text-slate-400">\\\\.\\pipe\\docker_engine (Root-equivalent access on Windows)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {dockerAccessors.length} process accessors
            </span>
            {expandedCategories.docker ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.docker && (
          <div className="px-5 pb-4 pt-2 text-xs">
            {dockerAccessors.length === 0 ? (
              <div className="text-slate-500 py-1">
                No active Docker process accessors detected (docker.exe, com.docker.backend.exe, or wsl.exe).
              </div>
            ) : (
              <div className="space-y-2">
                {dockerAccessors.map((proc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-red-300">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <span>Process <strong className="font-mono">{proc}</strong> has active access to Docker Engine.</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-200">
                      CRITICAL PRIVILEGE
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. AI Agents & MCP Processes */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('ai_agents')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">AI Agents & MCP Subprocesses</h4>
              <p className="text-xs text-slate-400">Process tree attribution for Claude, Cursor, Ollama, MCP servers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {aiAgents.length} detected
            </span>
            {expandedCategories.ai_agents ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.ai_agents && (
          <div className="px-5 pb-4 pt-2 text-xs space-y-2">
            {aiAgents.length === 0 ? (
              <div className="text-slate-500 py-1">No AI agents or MCP subprocesses currently running.</div>
            ) : (
              aiAgents.map((agent, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-300 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      {agent.name} (PID: {agent.pid})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Parent: {agent.parent_name ? `${agent.parent_name} (${agent.ppid})` : `PID ${agent.ppid}`}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate bg-slate-900 px-2 py-1 rounded">
                    {agent.cmdline || 'No cmdline available'}
                  </div>
                  {agent.workspace_path && (
                    <div className="text-[11px] text-cyan-400 font-mono">
                      Bound Workspace: {agent.workspace_path}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. Browser Extensions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('extensions')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Browser Extensions</h4>
              <p className="text-xs text-slate-400">Chrome & Edge profiles, permission widening monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {extensions.length} extensions ({extensions.filter(e => e.has_all_urls).length} &lt;all_urls&gt;)
            </span>
            {expandedCategories.extensions ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.extensions && (
          <div className="px-5 pb-4 pt-2 text-xs space-y-2 max-h-80 overflow-y-auto pr-1">
            {extensions.map((ext, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{ext.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">({ext.browser})</span>
                    {ext.has_all_urls && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-mono font-semibold">
                        &lt;all_urls&gt;
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    ID: {ext.id} | v{ext.version}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {ext.permissions?.length + ext.host_permissions?.length} permissions
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. CLI Tools on PATH */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('cli')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Developer CLI Tools on PATH</h4>
              <p className="text-xs text-slate-400">Detection of newly appeared CLI agents or tooling</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {cliTools.length} binaries
            </span>
            {expandedCategories.cli ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.cli && (
          <div className="px-5 pb-4 pt-2 text-xs flex flex-wrap gap-2">
            {cliTools.map((tool, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700/60">
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 6. Listening Local Ports */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => toggleCategory('ports')}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Passive Localhost Listening Ports</h4>
              <p className="text-xs text-slate-400">127.0.0.1 sockets passively enumerated from connection table</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {listeningPorts.length} open
            </span>
            {expandedCategories.ports ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expandedCategories.ports && (
          <div className="px-5 pb-4 pt-2 text-xs divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
            {listeningPorts.map((p, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.is_risky ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  <span className="text-white font-semibold">{p.ip}:{p.port}</span>
                  <span className="text-slate-400 text-[11px]">({p.process_name})</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {p.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
