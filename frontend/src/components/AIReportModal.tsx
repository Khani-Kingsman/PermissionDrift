import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Shield,
  Loader2,
  Key,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { apiGetAIStatus, apiSetAIKey, apiGetAIReport } from '../lib/api';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId?: string | null;
}

export const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  snapshotId,
}) => {
  const [configured, setConfigured] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    try {
      const status = await apiGetAIStatus();
      setConfigured(status.configured);
      if (status.configured && !report) {
        generateReport();
      }
    } catch {
      setConfigured(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setError('');
    try {
      await apiSetAIKey(apiKeyInput.trim());
      setConfigured(true);
      setApiKeyInput('');
      generateReport();
    } catch (e: any) {
      setError(e.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const generateReport = async () => {
    setLoadingReport(true);
    setError('');
    try {
      const res = await apiGetAIReport(snapshotId || undefined);
      setReport(res);
    } catch (e: any) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoadingReport(false);
    }
  };

  const copyReport = () => {
    const text = report?.report_markdown || report?.summary || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-amber-400 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Gemini AI Cyber-Forensic Posture Report
                <span className="text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 font-normal">
                  gemini-2.5-flash
                </span>
              </h3>
              <p className="font-geist-mono text-xs text-neutral-500">
                In-depth automated threat modeling &amp; security architecture analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Configuration Banner if not configured */}
          {!configured && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 font-geist-mono">
                <Key className="w-4 h-4 text-amber-600" />
                <span>Configure Google Gemini API Key</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-geist-mono">
                Enter your Google Gemini API key to activate deep neural threat analysis.
                Your key will be stored securely in your local environment (.env ignored by git) and will never be shared or pushed to GitHub.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste GEMINI_API_KEY here..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 font-geist-mono text-xs px-3.5 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-400 outline-none focus:border-black"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={savingKey || !apiKeyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-black text-white font-medium text-xs hover:bg-neutral-800 disabled:opacity-50 transition-all font-geist-mono cursor-pointer"
                >
                  {savingKey ? 'Saving...' : 'Activate AI'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 font-geist-mono text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Spinner */}
          {loadingReport && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Loader2 className="w-8 h-8 text-neutral-800 animate-spin" />
              <p className="font-geist-mono text-xs text-neutral-600 font-medium">
                Gemini is synthesizing forensic audit data across process handles, tokens, and loopback sockets...
              </p>
            </div>
          )}

          {/* Report Output */}
          {!loadingReport && report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 font-geist-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Report Generated for {report.host || 'Local Host'}</span>
                </div>
                <button
                  onClick={copyReport}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 hover:text-black transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              </div>

              {report.report_markdown ? (
                <div className="prose prose-neutral max-w-none text-xs leading-relaxed font-sans bg-neutral-50/60 p-5 rounded-2xl border border-neutral-200 whitespace-pre-line">
                  {report.report_markdown}
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-700 space-y-2 font-geist-mono">
                  <p>{report.summary || report.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/60 flex items-center justify-between">
          <span className="font-geist-mono text-xs text-neutral-500">
            PermissionDrift AI Engine · Zero raw secrets transmitted
          </span>
          <div className="flex items-center gap-2">
            {configured && (
              <button
                onClick={generateReport}
                disabled={loadingReport}
                className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-white text-neutral-800 font-geist-mono text-xs font-medium transition-colors"
              >
                Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-black text-white font-geist-mono text-xs font-medium hover:bg-neutral-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
