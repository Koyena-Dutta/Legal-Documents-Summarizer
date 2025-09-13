"use client";

import { useEffect, useState, useRef, FormEvent, useCallback, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { buildChatPayload, ChatMessage as ChatMsg, ChatMode } from '@/lib/chat';

interface DocData {
  text: string;
  chunks: string[];
  red_flags: { chunk_index: number; keyword: string; text: string }[];
  file_hash?: string;
}

interface UploadState {
  uploading: boolean;
  error: string | null;
}

interface MultiDoc extends DocData { id: string; name: string; }

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : 'Unknown error';
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export default function DocumentPage() {
  const [documents, setDocuments] = useState<MultiDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [chatDocIds, setChatDocIds] = useState<Set<string>>(new Set());
  const docData = useMemo(() => documents.find(d => d.id === activeDocId) || null, [documents, activeDocId]);

  const [selection, setSelection] = useState({ text: '', x: 0, y: 0 });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [documentText, setDocumentText] = useState('');
  const [chatMode, setChatMode] = useState<'document' | 'general'>('document');
  const [uploadState, setUploadState] = useState<UploadState>({ uploading: false, error: null });
  const contentRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mixInputRef = useRef<HTMLInputElement | null>(null);
  const lastMsgCountRef = useRef(0);
  const [summariesByHash, setSummariesByHash] = useState<Record<string, string>>({});
  const [summaryReadyByHash, setSummaryReadyByHash] = useState<Record<string, boolean>>({});
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [riskData, setRiskData] = useState<{hasRisk: boolean; analysis: string}>({hasRisk: false, analysis: ''});
  const [isRiskLoading, setIsRiskLoading] = useState(false);

  const persistDocuments = useCallback((docs: MultiDoc[]) => {
    sessionStorage.setItem('documentsData', JSON.stringify(docs));
  }, []);

  useEffect(() => {
    const single = sessionStorage.getItem('documentData');
    const multi = sessionStorage.getItem('documentsData');
    
    if (single) {
      try {
        const d = JSON.parse(single);
        if (d && d.text) {
          const wrapped: MultiDoc = { id: crypto.randomUUID(), name: 'Document 1', ...d };
          setDocuments([wrapped]);
          setActiveDocId(wrapped.id);
          setDocumentText(wrapped.text);
          setChatDocIds(new Set([wrapped.id]));
          persistDocuments([wrapped]);
          sessionStorage.removeItem('documentData');
          return;
        }
      } catch (e) {
        console.error('Failed to parse documentData', e);
      }
    }
    if (multi) {
      try {
        const parsed: MultiDoc[] = JSON.parse(multi);
        if (Array.isArray(parsed) && parsed.length) {
          setDocuments(parsed);
          setActiveDocId(parsed[0].id);
          setDocumentText(parsed[0].text);
          setChatDocIds(new Set(parsed.map(d => d.id)));
          return;
        }
      } catch (e) {
        console.error('Failed to parse documentsData', e);
      }
    }
  }, [persistDocuments]);

  useEffect(() => {
    if (docData) setDocumentText(docData.text);
  }, [docData]);

  const updateActiveDocumentText = useCallback((text: string) => {
    if (!docData) return;
    setDocuments(prev => {
      const updated = prev.map(d => d.id === docData.id ? { ...d, text } : d);
      persistDocuments(updated);
      return updated;
    });
  }, [docData, persistDocuments]);

  useEffect(() => {
    if (chatHistory.length > lastMsgCountRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMsgCountRef.current = chatHistory.length;
  }, [chatHistory]);

  useEffect(() => {
    marked.setOptions({ breaks: true, gfm: true });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverOpen && !(e.target as Element).closest('[data-radix-popper-content-wrapper]')) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [popoverOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const currentSelection = window.getSelection();
    if (currentSelection && currentSelection.toString().trim().length > 0) {
      const selectedText = currentSelection.toString();
      
      setSelection({
        text: selectedText,
        x: e.clientX,
        y: e.clientY,
      });
      setPopoverOpen(true);
      setExplanation('');
      setRiskData({hasRisk: false, analysis: ''});
    }
  };

  const handleExplain = async () => {
    const sel = selection.text.trim();
    if (!sel) return;
    setIsLoading(true);
    setExplanation('');
    try {
      const response = await fetch("http://127.0.0.1:8000/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sel }),
      });
      const data = await response.json().catch(() => ({} as { detail?: string; explanation?: string }));
      if (!response.ok) {
        setExplanation(data?.detail || "Explanation failed.");
      } else {
        setExplanation(data.explanation || "No explanation returned.");
      }
    } catch (error: unknown) {
      console.error("Failed to get explanation:", error);
      setExplanation("Failed to get explanation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRiskAnalyze = async () => {
    const sel = selection.text.trim();
    if (!sel) return;
    setIsRiskLoading(true);
    setRiskData({hasRisk: false, analysis: ''});
    try {
      const res = await fetch('http://127.0.0.1:8000/risk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sel })
      });
      const data = await res.json().catch(() => ({} as { hasRisk?: boolean; analysis?: string; detail?: string }));
      if (!res.ok) {
        setRiskData(prev => ({ ...prev, analysis: data?.detail || 'Risk analysis failed.' }));
      } else {
        const txt = (typeof data.analysis === 'string' && data.analysis.trim().length)
          ? data.analysis
          : (data.hasRisk ? 'Risks identified but no analysis provided.' : 'No risks identified in your document.');
        setRiskData({ hasRisk: !!data.hasRisk, analysis: txt });
      }
    } catch (e) {
      console.error('Risk analysis error:', e);
      setRiskData({ hasRisk: false, analysis: 'Failed to analyze risks.' });
    } finally {
      setIsRiskLoading(false);
    }
  };

  const handleFlag = () => {
    const selectedText = selection.text.trim();
    if (!selectedText) {
      setPopoverOpen(false);
      return;
    }
    void handleRiskAnalyze();
  };

  const handleAskAboutThis = () => {
    setChatInput(selection.text);
    setPopoverOpen(false);
    const trigger = document.getElementById('chat-sheet-trigger');
    if (trigger) {
      trigger.click();
    }
  };

  const startNewConversation = (mode: 'document' | 'general') => {
    setChatMode(mode);
    setChatHistory([]);
    setChatError(null);
  };

  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({ uploading: true, error: null });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://127.0.0.1:8000/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed ${res.status}`);
      const data: DocData & { file_hash: string } = await res.json();

      if (!Array.isArray(data.chunks) || !data.chunks.length) {
        const baseChunks = data.text.split(/\n\n+/).map((c: string) => c.trim()).filter((c: string) => c.length > 0);
        data.chunks = baseChunks.length ? baseChunks : [data.text.slice(0, 1200)];
      }

      const newDoc: MultiDoc = {
        id: crypto.randomUUID(),
        name: file.name || `Doc ${documents.length + 1}`,
        text: data.text,
        chunks: data.chunks,
        red_flags: data.red_flags || [],
        file_hash: data.file_hash
      };
      setDocuments(prev => {
        const updated = [...prev, newDoc];
        persistDocuments(updated);
        return updated;
      });
      setActiveDocId(newDoc.id);
      setChatDocIds(prev => new Set([...prev, newDoc.id]));
    } catch (err: unknown) {
      setUploadState({ uploading: false, error: getErrorMessage(err) });
      return;
    }
    setUploadState({ uploading: false, error: null });
    if (mixInputRef.current) {
      mixInputRef.current.value = '';
    }
    setDocuments(prev => [...prev]);
  };

  const getChatChunks = useCallback(() => {
    let selected = documents.filter(d => chatDocIds.has(d.id));
    if (!selected.length && docData) selected = [docData];
    return selected.flatMap(d => d.chunks || []);
  }, [documents, chatDocIds, docData]);

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const availableChunks = getChatChunks();
    if (chatMode === 'document' && (!availableChunks.length)) {
      setChatError("No document loaded. Please upload a document first by clicking 'Upload Document' above.");
      return;
    }

    setChatError(null);
    const newHistory: ChatMsg[] = [...chatHistory, { role: 'user', content: trimmed }];
    setChatHistory(newHistory);
    setIsChatLoading(true);
    setChatInput('');

    try {
      const payload = buildChatPayload(newHistory, availableChunks, chatMode as ChatMode);
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.text().catch(() => '');
        throw new Error(errorData || `HTTP ${response.status}`);
      }
      
      const answerText = await response.text();
      setChatHistory([...newHistory, { role: 'assistant', content: answerText || 'No answer received.' }]);
    } catch (error: unknown) {
      const msg = `Error: ${getErrorMessage(error)}`;
      setChatHistory([...newHistory, { role: 'assistant', content: msg }]);
      setChatError(msg);
    } finally {
      setIsChatLoading(false);
    }
  };

  const selectedDocs = useMemo(() => documents.filter(d => chatDocIds.has(d.id)), [documents, chatDocIds]);
  const selectedFileHashes = useMemo(
    () => selectedDocs.map(d => d.file_hash).filter(Boolean) as string[],
    [selectedDocs]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchBatch() {
      if (!selectedFileHashes.length) {
        setSummariesByHash({});
        setSummaryReadyByHash({});
        return;
      }
      setIsSummaryLoading(true);
      try {
        const [sumRes, statusRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/summary/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHashes: selectedFileHashes })
          }),
          fetch('http://127.0.0.1:8000/summary/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(selectedFileHashes)
          })
        ]);
        const sumJson = await sumRes.json().catch(() => ({ summaries: {} }));
        const statusJson = await statusRes.json().catch(() => ({ status: {} }));
        if (!cancelled) {
          setSummariesByHash(sumJson.summaries || {});
          setSummaryReadyByHash(statusJson.status || {});
        }
      } catch (e) {
        console.error('Failed to fetch summaries/status:', e);
        if (!cancelled) {
          setSummariesByHash({});
          setSummaryReadyByHash({});
        }
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    }
    fetchBatch();
    return () => { cancelled = true; };
  }, [selectedFileHashes]);

  const handleExportSelected = async () => {
    if (!selectedFileHashes.length) return;
    setIsExporting(true);
    setExportStatus('Generating summaries & exporting...');
    try {
      const exportResponse = await fetch('http://127.0.0.1:8000/export/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileHashes: selectedFileHashes })
      });
      if (!exportResponse.ok) {
        const errorData = await exportResponse.json().catch(() => ({} as { detail?: string }));
        throw new Error(errorData?.detail || 'Failed to export summaries');
      }
      const data = await exportResponse.json();
      const results: Array<{ fileHash: string; public_url?: string }>
        = Array.isArray(data?.results) ? data.results : [];
      let opened = 0;
      for (const r of results) {
        if (r.public_url) {
          window.open(r.public_url, '_blank', 'noopener');
          opened++;
        }
      }
      setExportStatus(opened ? `Opened ${opened} PDF${opened>1?'s':''}` : 'No exports available');
      // Refresh summaries/status after export (in case generation just finished)
      try {
        const [sumRes, statusRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/summary/batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileHashes: selectedFileHashes })
          }),
          fetch('http://127.0.0.1:8000/summary/status', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedFileHashes)
          })
        ]);
        const sumJson = await sumRes.json().catch(() => ({ summaries: {} }));
        const statusJson = await statusRes.json().catch(() => ({ status: {} }));
        setSummariesByHash(sumJson.summaries || {});
        setSummaryReadyByHash(statusJson.status || {});
      } catch {}
    } catch (error: unknown) {
      console.error('Export error:', error);
      alert(`❌ Failed to export: ${getErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(''), 1200);
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    const raw = marked.parse(text, { breaks: true }) as string;
    return DOMPurify.sanitize(raw, { ADD_TAGS: ['mark'], ADD_ATTR: ['class','title'] });
  };

  const renderDocument = () => {
    if (!docData) {
      return (
        <div className="space-y-4 text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-slate-900">No Document Loaded</h3>
          <p className="text-slate-600 mb-6">Please upload a document to begin analysis.</p>
          <Button 
            onClick={() => window.location.href = '/'} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Upload Document
          </Button>
        </div>
      );
    }

    let content = documentText;
    const redFlags = docData.red_flags || [];
    
    // Highlight AI-detected legal risks
    const keywords = [...new Set(redFlags.map(rf => rf.keyword))];
    keywords.forEach(keyword => {
        const regex = new RegExp(`(\\b${keyword}\\b)`, 'gi');
        // enforce wrapping on highlights
        content = content.replace(
          regex,
          `<mark class="bg-yellow-200 px-1 py-0.5 rounded border-l-2 border-yellow-400 font-medium" style="word-break: break-word; overflow-wrap: anywhere;">$1</mark>`
        );
    });

    return (
      <div 
        className="w-full h-full min-h-[500px] p-4 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        contentEditable
        suppressContentEditableWarning={true}
        onContextMenu={handleContextMenu}
        dangerouslySetInnerHTML={{ __html: renderFormattedText(content) }}
        onInput={(e) => {
          const target = (e.target as HTMLDivElement);
            const text = target.innerText || target.textContent || '';
            setDocumentText(text);
            updateActiveDocumentText(text);
        }}
      />
    );
  };

  const closeDoc = (id: string) => {
    setDocuments(prev => {
      if (prev.length === 1) return prev;
      const filtered = prev.filter(d => d.id !== id);
      const newActive = id === activeDocId ? (filtered[0]?.id || null) : activeDocId;
      setActiveDocId(newActive);
      const newSet = new Set(chatDocIds);
      newSet.delete(id);
      setChatDocIds(newSet);
      persistDocuments(filtered);
      return filtered;
    });
  };

  const toggleChatDoc = (id: string) => {
    setChatDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 flex flex-col sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button id="chat-sheet-trigger" className="bg-blue-600 hover:bg-blue-700">
                  Chat with AI
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[560px] max-h-[90vh] bg-white flex flex-col overflow-hidden">
                <SheetHeader className="border-b pb-4">
                  <SheetTitle className="flex items-center space-x-2">
                    <span className="text-blue-600">🤖</span>
                    <span>Ask About the Document</span>
                  </SheetTitle>
                  <SheetDescription id="chat-sheet-desc">
                    Chat with AI. Switch modes or mix in another document.
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant={chatMode==='document'? 'default':'outline'} onClick={()=>startNewConversation('document')}>Document Chat</Button>
                    <Button size="sm" variant={chatMode==='general'? 'default':'outline'} onClick={()=>startNewConversation('general')}>Conversation Mode</Button>
                    <label className="relative inline-flex">
                      <input ref={mixInputRef} type="file" className="hidden" onChange={handleInlineUpload} accept=".pdf,.docx,.txt" />
                      <Button size="sm" type="button" variant="outline" onClick={()=>mixInputRef.current?.click()}>+ Mix Doc</Button>
                    </label>
                    <Button size="sm" variant="outline" onClick={()=>startNewConversation(chatMode)}>New Chat</Button>
                  </div>
                  {uploadState.uploading && <p className="text-xs text-blue-600 mt-1">Uploading & analyzing...</p>}
                  {uploadState.error && <p className="text-xs text-red-600 mt-1">{uploadState.error}</p>}
                </SheetHeader>
                <div className="flex flex-col flex-1 min-h-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {chatHistory.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'} max-w-[75%] break-words prose prose-sm`}>
                            {message.role === 'assistant' ? (
                              <div dangerouslySetInnerHTML={{ __html: message.content }} />
                            ) : (
                              <span>{message.content}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 text-slate-900 p-3 rounded-lg max-w-xs">
                            <span>✨ Thinking...</span>
                          </div>
                        </div>
                      )}
                      {chatError && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                          <p className="text-sm text-red-700">❌ {chatError}</p>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>
                  <form onSubmit={handleChatSubmit} className="p-4 border-t bg-slate-50 space-y-3 flex-shrink-0">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={chatMode==='general' ? 'General conversation...' : 'Ask about this document...'}
                      className="w-full resize-none min-h-[80px] max-h-32 overflow-y-auto"
                    />
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isChatLoading || !chatInput.trim() || (chatMode==='document' && (!docData || !docData.chunks.length))}>
                      {isChatLoading ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            <Button 
              onClick={handleExportSelected} 
              disabled={isExporting || selectedFileHashes.length === 0}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
            >
              <span>📄</span>
              <span>{isExporting ? (exportStatus || "Exporting...") : `Generate Summary${selectedFileHashes.length>1? ' (Batch)':''}`}</span>
            </Button>
            <label className="relative inline-flex">
              <input ref={mixInputRef} type="file" className="hidden" onChange={handleInlineUpload} accept=".pdf,.docx,.txt" />
              <Button type="button" onClick={() => mixInputRef.current?.click()} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700">
                <span>📁</span>
                <span>Add Document</span>
              </Button>
            </label>
          </div>
        </div>
        <div className="mt-3 flex overflow-x-auto space-x-2 pb-1 border-t pt-2">
          {documents.map(d => (
            <div key={d.id} className={`group flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm cursor-pointer border ${d.id===activeDocId? 'bg-blue-600 text-white border-blue-600':'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`} onClick={() => setActiveDocId(d.id)}>
              <span className="max-w-[140px] truncate">{d.name}</span>
              {documents.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); closeDoc(d.id); }} className={`text-xs rounded px-1 ${d.id===activeDocId? 'hover:bg-blue-500':'hover:bg-slate-200'}`}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-145px)]">
        <div className="w-56 bg-white ml-0 my-6 ml-6 rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {documents.map(d => {
              const included = chatDocIds.has(d.id);
              return (
                <div key={d.id} className={`p-2 rounded border text-xs cursor-pointer ${d.id===activeDocId? 'border-blue-500 bg-blue-50':'border-slate-200 hover:bg-slate-50'}`} onClick={() => setActiveDocId(d.id)}>
                  <div className="flex items-start justify-between">
                    <span className="font-medium truncate max-w-[90px]" title={d.name}>{d.name}</span>
                    <input type="checkbox" checked={included} onChange={(e) => { e.stopPropagation(); toggleChatDoc(d.id); }} title="Select for Chat/Summary" />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>{d.chunks.length} ch</span>
                    <span>{d.red_flags.length} ⚠️</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-500">Selected: {selectedDocs.length} | Ready summaries: {Object.values(summaryReadyByHash).filter(Boolean).length}</div>
          {selectedDocs.some(d => !d.file_hash) && (
            <div className="text-[10px] text-amber-600">Some selected docs lack file hash. Re-upload to enable summaries.</div>
          )}
        </div>

        <div className="flex-1 bg-white mx-6 my-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div ref={contentRef} className="h-full">
            <ScrollArea className="h-full">
              <div className="p-8">
                <TooltipProvider>
                  <div className="prose prose-slate max-w-none leading-relaxed break-words">
                    {renderDocument()}
                  </div>
                </TooltipProvider>
              </div>
            </ScrollArea>
          </div>
        </div>

        {docData && (
          <div className="w-80 bg-white mr-6 my-6 rounded-xl shadow-sm border border-slate-200 p-6 max-h-[calc(100vh-145px)] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-4">Document Insights</h3>
            
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Red Flags</span>
                  <span className="font-semibold text-red-600">{docData.red_flags?.length || 0}</span>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Text Chunks</span>
                  <span className="font-semibold text-blue-600">{docData.chunks?.length || 0}</span>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Word Count</span>
                  <span className="font-semibold text-slate-700">{docData.text?.split(' ').length || 0}</span>
                </div>
              </Card>
            </div>

            {/* New: Summaries for selected docs */}
            <div className="mt-6">
              <h4 className="font-medium text-slate-900 mb-3">📝 Summaries (Selected)</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {selectedDocs.length === 0 && (
                  <div className="text-xs text-slate-500">Select 1–2 documents to view summaries.</div>
                )}
                {selectedDocs.map((d) => {
                  const fh = d.file_hash;
                  const ready = fh ? summaryReadyByHash[fh] : false;
                  const sum = fh ? summariesByHash[fh] : undefined;
                  return (
                    <Card key={d.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-800 truncate pr-2" title={d.name}>{d.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${ready ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {ready ? 'Ready' : (isSummaryLoading ? 'Checking…' : 'Not ready')}
                        </span>
                      </div>
                      {fh ? (
                        sum ? (
                          <div className="text-xs prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: renderFormattedText(sum) }} />
                        ) : (
                          <div className="text-xs text-slate-600 italic">{ready ? 'Summary cached but not fetched.' : 'Summary is being generated…'}</div>
                        )
                      ) : (
                        <div className="text-xs text-amber-700">No file hash for this document. Re-upload required.</div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {docData.red_flags && docData.red_flags.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-slate-900 mb-3">⚠️ Risk Highlights</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {docData.red_flags.slice(0, 5).map((flag, index) => (
                    <div key={index} className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs break-words">
                      <span className="font-medium text-yellow-800 break-words">{flag.keyword}</span>
                      <p className="text-yellow-700 mt-1 line-clamp-2 break-words">{flag.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            style={{
              position: 'fixed',
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              width: '1px',
              height: '1px',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            aria-describedby="lens-popover-description"
          />
        </PopoverTrigger>
        <PopoverContent 
          className="w-96 p-0 bg-white shadow-xl border-slate-200 max-h-[80vh] overflow-hidden resize" 
          aria-describedby="lens-popover-description"
          side="bottom"
          align="start"
          sideOffset={5}
        >
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-md flex items-center justify-center">
                <span className="text-white text-xs">🔍</span>
              </div>
              <h4 className="font-semibold text-slate-900">AI Analysis Lens</h4>
            </div>
            <p id="lens-popover-description" className="text-sm text-slate-600 mb-4">
              Get AI insights on the selected text passage.
            </p>
            
            <div className="bg-slate-50 p-3 rounded-lg mb-4 border max-h-24 overflow-y-auto">
              <p className="text-sm text-slate-700 italic">
                &quot;{selection.text}&quot;
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Button 
                onClick={handleExplain} 
                disabled={isLoading || !selection.text.trim()}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700"
              >
                <span>💡</span>
                <span>{isLoading ? "Analyzing..." : "Explain This"}</span>
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleFlag} variant="outline" className="flex items-center justify-center space-x-1">
                  <span>🚩</span>
                  <span>{isRiskLoading ? 'Analyzing…' : 'Risk Analysis'}</span>
                </Button>
                <Button onClick={handleAskAboutThis} variant="outline" className="flex items-center justify-center space-x-1">
                  <span>💬</span>
                  <span>Discuss</span>
                </Button>
              </div>
            </div>
            
            {explanation && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg min-h-[100px] max-h-[300px] overflow-y-auto">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 mt-0.5">🤖</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">AI Explanation</p>
                    <div 
                      className="text-sm text-blue-800" 
                      dangerouslySetInnerHTML={{ __html: renderFormattedText(explanation) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {riskData.analysis && riskData.analysis.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg min-h-[100px] max-h-[300px] overflow-y-auto">
                <div className="flex items-start space-x-2">
                  <span className="text-amber-600 mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 mb-1">Risk Analysis</p>
                    <div className="text-sm text-amber-800" dangerouslySetInnerHTML={{ __html: renderFormattedText(riskData.analysis) }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

