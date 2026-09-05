import React, { useState } from 'react';
import {
  Shield,
  Power,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Square,
  Sparkles,
  Laptop
} from 'lucide-react';
import {
  EngineStatus,
  apiToggleEngine,
  apiToggleAutostart,
  apiTestNotification
} from '../lib/api';

interface EngineControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: EngineStatus | null;
  onStatusChange: (status: EngineStatus) => void;
  theme?: 'black' | 'white';
}

export const EngineControlModal: React.FC<EngineControlModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
  theme = 'white',
}) => {
  const [loading, setLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [error, setError] = useState('');
  const isBlack = theme === 'black';

  if (!isOpen) return null;

  const isRunning = status?.running ?? false;
  const isAutostart = status?.autostart_enabled ?? false;

  const handleToggleEngine = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await apiToggleEngine(isRunning ? 'stop' : 'start');
      onStatusChange(next);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle engine');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutostart = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiToggleAutostart(!isAutostart);
      if (res.success && status) {
        onStatusChange({ ...status, autostart_enabled: res.enabled });
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle autostart');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setTestSuccess('');
    setError('');
    try {
      await apiTestNotification();
      setTestSuccess('Windows Toast Notification sent to desktop!');
      setTimeout(() => setTestSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to send alert');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isBlack
            ? 'bg-[#090b10] border-neutral-800 text-neutral-200'
            : 'bg-white border-neutral-300 text-neutral-800'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 border-b flex items-center justify-between ${
            isBlack ? 'border-neutral-800/80 bg-neutral-900/40' : 'border-neutral-200 bg-neutral-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isBlack
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Background Security Engine</h2>
              <p className="text-xs text-neutral-500">
                Silent continuous drift detection & Windows boot autostart
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isBlack ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-200 text-neutral-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {testSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{testSuccess}</span>
            </div>
          )}

          {/* Master Engine Toggle Card */}
          <div
            className={`p-5 rounded-xl border flex items-center justify-between transition-all ${
              isRunning
                ? isBlack
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-emerald-50/70 border-emerald-300'
                : isBlack
                ? 'bg-neutral-900/50 border-neutral-800'
                : 'bg-neutral-50 border-neutral-200'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
                  }`}
                />
                <span className="text-sm font-semibold tracking-wide">
                  {isRunning ? 'ENGINE ACTIVE (BACKGROUND)' : 'ENGINE STOPPED'}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {isRunning
                  ? 'Silently scanning process handles & ports every 5 minutes in background.'
                  : 'Engine is idle. Background scans and automated toast alerts are paused.'}
              </p>
            </div>

            <button
              onClick={handleToggleEngine}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all ${
                isRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              {isRunning ? 'Stop Engine' : 'Start Engine'}
            </button>
          </div>

          {/* Autostart on PC Boot */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              isBlack ? 'bg-neutral-900/30 border-neutral-800/80' : 'bg-white border-neutral-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg border mt-0.5 ${
                  isBlack ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-700'
                }`}
              >
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">Autostart on Windows Boot</div>
                <div className="text-[11px] text-neutral-500 leading-relaxed max-w-sm">
                  Automatically launches PermissionDrift invisibly when your PC powers on. No terminal window will ever open.
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleAutostart}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isAutostart
                  ? isBlack
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-amber-100 border-amber-300 text-amber-800'
                  : isBlack
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {isAutostart ? 'Enabled (ON)' : 'Disabled (OFF)'}
            </button>
          </div>

          {/* Windows Desktop Notifications */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              isBlack ? 'bg-neutral-900/30 border-neutral-800/80' : 'bg-white border-neutral-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg border mt-0.5 ${
                  isBlack ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-700'
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">Windows Toast Notifications</div>
                <div className="text-[11px] text-neutral-500 leading-relaxed max-w-sm">
                  Sends native desktop alerts when permission drift or unauthorized credential handles are discovered.
                </div>
              </div>
            </div>

            <button
              onClick={handleTestAlert}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isBlack
                  ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                  : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
              }`}
            >
              Test Alert
            </button>
          </div>

          {/* Zero-Terminal Silent Launcher Details */}
          <div
            className={`p-3.5 rounded-xl border text-[11px] font-mono leading-relaxed ${
              isBlack ? 'bg-neutral-950/60 border-neutral-800 text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-600'
            }`}
          >
            <div className="font-semibold text-neutral-400 mb-1 flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Headless Operation (Zero CLI Window):
            </div>
            <div>• Silent Runner: <span className="text-amber-500">scripts/start_silent.vbs</span></div>
            <div>• Stop Daemon: <span className="text-neutral-500">scripts/stop_silent.bat</span></div>
            <div className="mt-1 text-neutral-500 font-sans">
              Runs in background with Windows Script Host (wscript) and pythonw.exe. The black command box will never appear.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex justify-end ${
            isBlack ? 'border-neutral-800/80 bg-neutral-900/30' : 'border-neutral-200 bg-neutral-50'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isBlack
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
