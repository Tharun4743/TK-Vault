import { 
  MessageSquare, 
  FolderClosed, 
  Trash2, 
  Plus,
  X
} from "lucide-react";

interface SidebarProps {
  selectedTab: "chat" | "library";
  onSelectTab: (tab: "chat" | "library") => void;
  onNewChat: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  activeSessionId?: string;
  sessions?: any[];
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export default function Sidebar({
  selectedTab,
  onSelectTab,
  onNewChat,
  isOpen = true,
  onClose,
  activeSessionId = "",
  sessions = [],
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {

  const navItems = [
    { id: "chat", label: "AI Chat", icon: MessageSquare },
    { id: "library", label: "Documents", icon: FolderClosed },
  ] as const;

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar-bg border-r border-border-default flex flex-col text-text-secondary transform transition-transform duration-200 md:translate-x-0 md:static ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-border-default flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div id="app-logo-slot" className="logo-container shrink-0" aria-label="Company Logo Slot">
            <img 
              src="/logo.jpg" 
              alt="TK-Vault Logo" 
              className="w-8 h-8 rounded-xl object-cover border border-border-default shadow-xs" 
            />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight font-display leading-none">
              TK-Vault
            </h1>
            <p className="text-[10px] text-text-muted font-medium mt-1">
              Sovereign Document Intelligence
            </p>
          </div>
        </div>
        
        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            className="md:hidden text-text-muted hover:text-text-primary p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Action: New Chat */}
      <div className="p-3 select-none">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-sm active:scale-98 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="px-3 select-none">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = selectedTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose?.();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                  isActive
                    ? "text-white bg-primary shadow-sm"
                    : "text-text-secondary hover:bg-header-bg hover:text-text-primary"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-white" : "text-text-muted"}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Recent Chats Section */}
      <div className="flex-1 overflow-y-auto px-3 py-4 select-none border-t border-border-default/50 mt-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Conversations ({sessions.length})
          </span>
        </div>

        <div className="space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-text-muted italic px-2 py-2">
              No recent chats.
            </p>
          ) : (
            sessions.map((s: any) => {
              const isActive = activeSessionId === s.sessionId;
              return (
                <div
                  key={s.sessionId}
                  onClick={() => {
                    onSelectSession?.(s.sessionId);
                    onSelectTab("chat");
                    onClose?.();
                  }}
                  className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "text-primary-light bg-primary/10 font-bold"
                      : "text-text-secondary hover:bg-header-bg hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span className="truncate flex-1 text-left" title={s.title}>
                      {s.title || "Chat session"}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession?.(s.sessionId);
                    }}
                    className="p-1 rounded text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
