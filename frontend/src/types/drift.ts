export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftEvent {
  event_id: string;
  detected_at: string;
  category:
    | 'credential_access'
    | 'extension_permission'
    | 'cli_tool'
    | 'process_handle'
    | 'ai_agent'
    | 'workspace_isolation'
    | 'ipc_exposure';
  resource: string;
  accessor: string;
  change_type: 'gained_access' | 'lost_access' | 'permission_widened';
  previous_state: string;
  current_state: string;
  severity: Severity;
  impact_statement: string;
  remediation: string;
  is_heuristic?: boolean;
}

export interface TreeItem {
  id: string;
  name: string;
  type: 'process' | 'resource' | 'pipe' | 'extension';
  status: 'baseline' | 'added' | 'revoked';
  detail?: string;
  children?: TreeItem[];
}

export interface SnapshotSummary {
  scan_id: string;
  timestamp: string;
  host: string;
  blast_radius_score: number;
  is_baseline: boolean;
  partial_scan: boolean;
}

export interface SensitivePath {
  name: string;
  path: string;
  exists: boolean;
  permissions: string | null;
  accessed_by_processes: string[];
}

export interface ProcessEntry {
  pid: number;
  ppid: number;
  name: string;
  cmdline: string;
  workspace_path: string | null;
  is_ai_agent: boolean;
  parent_name: string | null;
}

export interface ProcessHandle {
  process_name: string;
  pid: number;
  is_ai_agent: boolean;
  open_handles: string[];
}

export interface BrowserExtension {
  browser: string;
  profile: string;
  id: string;
  name: string;
  version: string;
  permissions: string[];
  host_permissions: string[];
  has_all_urls: boolean;
}

export interface ListeningPort {
  port: number;
  ip: string;
  pid: number;
  process_name: string;
  is_risky: boolean;
  description: string;
}

export interface FullSnapshot {
  scan_id: string;
  timestamp: string;
  host: string;
  partial_scan: boolean;
  scan_duration_ms: number;
  blast_radius_score: number;
  sensitive_paths: SensitivePath[];
  process_handles: ProcessHandle[];
  process_tree: ProcessEntry[];
  browser_extensions: BrowserExtension[];
  cli_tools: string[];
  docker_socket_accessible_by: string[];
  listening_ports: ListeningPort[];
  cross_workspace_access: string[];
}

export interface DriftResult {
  baseline_id: string | null;
  current_id: string | null;
  blast_radius_score: number;
  events: DriftEvent[];
}

export interface JobResult {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: FullSnapshot;
  error?: string;
}
