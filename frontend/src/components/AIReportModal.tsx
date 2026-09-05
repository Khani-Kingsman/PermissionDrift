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
  theme?: 'black' | 'white';
}

export const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  snapshotId,
  theme = 'white',
}) => {
  const isBlack = theme === 'black';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden ${
        isBlack ? 'border-neutral-800 bg-[#0e1219] text-white' : 'border-neutral-200 bg-white text-neutral-900'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isBlack ? 'border-neutral-800 bg-[#0e1219]' : 'border-neutral-100 bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
              isBlack ? 'bg-neutral-800 text-amber-400 border border-neutral-700' : 'bg-neutral-900 text-amber-400'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${
                isBlack ? 'text-white' : 'text-neutral-900'
              }`}>
                Gemini AI Cyber-Forensic Posture Report
                <span className={`text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full border font-normal ${
                  isBlack
                    ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                }`}>
                  gemini-3.7-flash
                </span>
              </h3>
              <p className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-400' : 'text-neutral-500'}`}>
                In-depth automated threat modeling &amp; security architecture analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 transition-colors ${isBlack ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Configuration Banner if not configured */}
          {!configured && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isBlack
                ? 'border-amber-800/60 bg-amber-950/30 text-amber-200'
                : 'border-amber-200 bg-amber-50/70 text-amber-900'
            }`}>
              <div className="flex items-center gap-2 text-xs font-semibold font-geist-mono">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Configure Google Gemini API Key</span>
              </div>
              <p className={`text-xs leading-relaxed font-geist-mono ${isBlack ? 'text-amber-300/90' : 'text-amber-800'}`}>
                Enter your Google Gemini API key to activate deep neural threat analysis.
                Your key will be stored securely in your local environment (.env ignored by git) and will never be shared or pushed to GitHub.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste GEMINI_API_KEY here..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className={`flex-1 font-geist-mono text-xs px-3.5 py-2 rounded-xl outline-none ${
                    isBlack
                      ? 'bg-[#151922] border border-neutral-700 text-white placeholder-neutral-500 focus:border-white'
                      : 'bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-black'
                  }`}
                />
                <button
                  onClick={handleSaveKey}
                  disabled={savingKey || !apiKeyInput.trim()}
                  className={`px-4 py-2 rounded-xl font-medium text-xs disabled:opacity-50 transition-all font-geist-mono cursor-pointer ${
                    isBlack
                      ? 'bg-white text-black hover:bg-neutral-200 font-semibold'
                      : 'bg-black text-white hover:bg-neutral-800'
                  }`}
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
              <Loader2 className={`w-8 h-8 animate-spin ${isBlack ? 'text-white' : 'text-neutral-800'}`} />
              <p className={`font-geist-mono text-xs font-medium ${isBlack ? 'text-neutral-300' : 'text-neutral-600'}`}>
                Gemini is synthesizing forensic audit data across process handles, tokens, and loopback sockets...
              </p>
            </div>
          )}

          {/* Report Output */}
          {!loadingReport && report && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between pb-3 border-b font-geist-mono text-xs ${
                isBlack ? 'border-neutral-800' : 'border-neutral-100'
              }`}>
                <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Report Generated for {report.host || 'Local Host'}</span>
                </div>
                <button
                  onClick={copyReport}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    isBlack
                      ? 'border-neutral-700 bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700'
                      : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600 hover:text-black'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-medium">Copied</span>
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
                <div className={`max-w-none text-xs leading-relaxed font-sans p-5 rounded-2xl border whitespace-pre-line ${
                  isBlack
                    ? 'bg-[#141822] text-neutral-200 border-neutral-800'
                    : 'bg-neutral-50/60 text-neutral-800 border-neutral-200'
                }`}>
                  {report.report_markdown}
                </div>
              ) : (
                <div className={`p-5 rounded-2xl border text-xs space-y-2 font-geist-mono ${
                  isBlack
                    ? 'bg-[#141822] text-neutral-300 border-neutral-800'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                }`}>
                  <p>{report.summary || report.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isBlack ? 'border-neutral-800 bg-[#0c0f15]' : 'border-neutral-100 bg-neutral-50/60'
        }`}>
          <span className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-500' : 'text-neutral-500'}`}>
            PermissionDrift AI Engine · Zero raw secrets transmitted
          </span>
          <div className="flex items-center gap-2">
            {configured && (
              <button
                onClick={generateReport}
                disabled={loadingReport}
                className={`px-4 py-2 rounded-xl border font-geist-mono text-xs font-medium transition-colors cursor-pointer ${
                  isBlack
                    ? 'border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl font-geist-mono text-xs font-medium transition-colors cursor-pointer ${
                isBlack
                  ? 'bg-white text-black hover:bg-neutral-200 font-semibold'
                  : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
