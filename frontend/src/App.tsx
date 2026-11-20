import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import LibraryView from "./components/LibraryView";
import FileUploader from "./components/FileUploader";
import ThemeToggle from "./components/layout/ThemeToggle";
import { DocumentInfo, ChatMessage, SourceCitation } from "./types";
import { fetchDocuments, deleteDocument, fetchSessions, fetchSessionChats, deleteSession } from "./services/api";
import { useWebSocket } from "./hooks/useWebSocket";
import { 
  Paperclip, 
  Send, 
  X, 
  AlertCircle,
  Menu,
  CheckCircle2,
  Info
} from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<"chat" | "library">(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "library") {
      return "library";
    }
    return "chat";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat & WebSocket State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Toasts state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadLibrary();
    loadSessions();

    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "chat" || hash === "library") {
        setSelectedTab(hash as any);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    window.location.hash = selectedTab;
  }, [selectedTab]);

  const loadLibrary = async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.error("Library sync failed:", err);
    }
  };

  const loadSessions = async () => {
    try {
      const s = await fetchSessions();
      setSessions(s);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const addToast = (type: "success" | "error" | "warning" | "info", title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // WebSocket for Chat Streaming
  const { isConnected, sendMessage } = useWebSocket({
    onToken: (token: string) => {
      setIsStreaming(true);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, text: lastMsg.text + token }
          ];
        } else {
          return [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: "assistant",
              text: token,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];
        }
      });
    },
    onDone: (sources?: SourceCitation[]) => {
      setIsStreaming(false);
      if (sources && sources.length > 0) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastMsg = prev[prev.length - 1];
          if (lastMsg.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, sources }
            ];
          }
          return prev;
        });
      }
      loadSessions();
    },
    onError: (errorMsg: string) => {
      setIsStreaming(false);
      addToast("error", "Retrieval Error", errorMsg);
    }
  });

  const handleDeleteDocument = async (id: string) => {
    try {
      const targetDoc = documents.find(d => d.id === id);
      const name = targetDoc ? targetDoc.name : "Document";
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      addToast("success", "Deleted", `"${name}" removed from index.`);
    } catch (err: any) {
      console.error(err);
      addToast("error", "Error", "Could not delete document.");
    }
  };

  const handleUploadSuccess = async (filename: string) => {
    setIsUploadOpen(false);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      addToast("success", "Indexed", `"${filename}" ready for questions.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(`session-${Date.now()}`);
    setMessages([]);
    setSelectedTab("chat");
  };

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSelectedTab("chat");
    try {
      const chats = await fetchSessionChats(sessionId);
      const msgs: ChatMessage[] = [];
      chats.forEach((c: any) => {
        msgs.push({
          id: `q-${c.id}`,
          role: "user",
          text: c.question,
          timestamp: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
        });
        let sources: SourceCitation[] = [];
        try {
          if (c.sources) sources = JSON.parse(c.sources);
        } catch (e) {}
        msgs.push({
          id: `a-${c.id}`,
          role: "assistant",
          text: c.answer,
          timestamp: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
          sources
        });
      });
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s: any) => (typeof s === 'string' ? s !== sessionId : s.sessionId !== sessionId)));
      if (activeSessionId === sessionId) {
        setMessages([]);
        setActiveSessionId(`session-${Date.now()}`);
      }
      addToast("success", "Deleted", "Chat cleared.");
    } catch (err) {
      addToast("error", "Error", "Could not delete chat.");
    }
  };

  const handleSend = () => {
    if (!inputVal.trim() || isStreaming) return;
    const userQuery = inputVal.trim();
    setInputVal("");

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);

    sendMessage(userQuery, activeSessionId, true, selectedDocId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const tabTitles: Record<string, string> = {
    dashboard: "Dashboard",
    chat: "AI Chat Workspace",
    library: "Document Library",
    training: "Model Training Studio",
    settings: "System Settings",
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-text-primary antialiased font-sans">
      
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
        onNewChat={handleNewChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeSessionId={activeSessionId}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Clean Header Bar */}
        <header className="h-16 border-b border-border-default px-6 flex items-center justify-between shrink-0 bg-header-bg/60 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-card-bg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-sm font-bold text-text-primary">
                {tabTitles[selectedTab] || "TK-Vault"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Dynamic Center View */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedTab === "chat" && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ChatWindow 
                  messages={messages} 
                  isStreaming={isStreaming} 
                  onSelectPrompt={(p) => {
                    setInputVal(p);
                    textareaRef.current?.focus();
                  }}
                />
              </div>

              {/* Minimal Chat Input Bar */}
              <div className="p-3 md:p-4 bg-header-bg/80 backdrop-blur-md border-t border-border-default shrink-0 select-none">
                <div className="flex gap-2.5 items-end max-w-3xl mx-auto">
                  
                  {/* Attachment Clip */}
                  <button 
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="w-10 h-10 border border-border-default rounded-xl flex items-center justify-center hover:bg-card-bg text-text-muted hover:text-primary-light transition-all shrink-0 active:scale-95 cursor-pointer"
                    title="Upload document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  
                  {/* Input container */}
                  <div className="flex-1 bg-card-bg border border-border-default rounded-2xl p-2 px-3 flex flex-col justify-between transition-all focus-within:border-primary shadow-xs">
                    {documents.length > 0 && (
                      <div className="flex items-center gap-2 mb-1">
                        <select
                          value={selectedDocId || "all"}
                          onChange={(e) => setSelectedDocId(e.target.value === "all" ? null : e.target.value)}
                          className="bg-header-bg border border-border-default rounded-md px-2 py-0.5 text-[10px] font-semibold text-text-secondary focus:outline-none focus:border-primary max-w-[220px] truncate cursor-pointer"
                        >
                          <option value="all">Search: All Documents ({documents.length})</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <textarea
                      ref={textareaRef}
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      className="bg-transparent border-none focus:ring-0 text-xs md:text-sm resize-none w-full py-1 text-text-primary focus:outline-none placeholder:text-text-muted select-text max-h-32"
                      placeholder={
                        documents.length === 0 
                          ? "Upload PDF, DOCX, or TXT documents to begin..." 
                          : "Ask a question about your documents..."
                      }
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isStreaming || !inputVal.trim()}
                    className={`w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-hover shadow-xs transition-all shrink-0 active:scale-95 cursor-pointer ${
                      isStreaming || !inputVal.trim() ? "opacity-30 pointer-events-none" : ""
                    }`}
                    title="Send query"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedTab === "library" && (
            <LibraryView
              documents={documents}
              onDeleteDocument={handleDeleteDocument}
              onTriggerUpload={() => setIsUploadOpen(true)}
              onError={(msg) => addToast("error", "Warning", msg)}
            />
          )}
        </div>

        {/* Clean Stacked Toasts */}
        <div className="fixed top-5 right-5 max-w-sm w-full z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => {
            const isErr = toast.type === "error";
            const isSucc = toast.type === "success";
            return (
              <div 
                key={toast.id}
                className={`p-3 border rounded-xl flex items-start gap-2.5 pointer-events-auto shadow-lg backdrop-blur-md ${
                  isErr 
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : isSucc
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-card-bg/95 border-border-default text-text-primary"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {isErr ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold">{toast.title}</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">{toast.message}</p>
                </div>
                <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

      </div>

      {/* Clean Document Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card-bg border border-border-default rounded-3xl p-6 max-w-lg w-full shadow-2xl relative select-none">
            <div className="flex items-center justify-between pb-3 border-b border-border-default mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-text-primary">
                  Upload Documents
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Select PDF, DOCX, or TXT files to add to your knowledge base.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <FileUploader
              onUploadSuccess={handleUploadSuccess}
              onError={(msg) => addToast("error", "Error", msg)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
