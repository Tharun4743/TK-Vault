import React, { useState } from "react";
import { ChatMessage } from "../types";
import { ChevronDown, ChevronRight, FileCheck, User, Sparkles } from "lucide-react";
import SourceCard from "./SourceCard";

interface MessageBubbleProps {
  message: ChatMessage;
  key?: React.Key;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showSources, setShowSources] = useState(true);
  const isUser = message.role === "user";

  const renderContent = (content: string) => {
    if (!content) return null;
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      
      // Highlight source citations like [Doc (Page X)]
      if (trimmed.startsWith("[") && trimmed.includes("]")) {
        const endBracket = trimmed.indexOf("]");
        const citation = trimmed.substring(0, endBracket + 1);
        const rest = trimmed.substring(endBracket + 1);
        return (
          <div key={idx} className="my-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
              {citation}
            </span>
            <span className="text-xs md:text-sm text-text-primary font-medium">{rest}</span>
          </div>
        );
      }

      // Key-value pairs (e.g. "Name : John")
      if (trimmed.includes(":") && !trimmed.startsWith("http")) {
        const parts = trimmed.split(":");
        const label = parts[0];
        const val = parts.slice(1).join(":");
        return (
          <div key={idx} className="my-0.5 text-xs md:text-sm leading-relaxed flex flex-wrap">
            <span className="font-semibold text-text-primary mr-1.5">{label}:</span>
            <span className="text-text-secondary">{val}</span>
          </div>
        );
      }

      return (
        <p key={idx} className="text-xs md:text-sm leading-relaxed text-text-primary my-0.5">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className={`flex gap-3 md:gap-4 w-full ${isUser ? "justify-end" : "justify-start"}`}>
      
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary-light flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Sparkles className="w-4 h-4" />
        </div>
      )}

      {/* Message Body Container */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        
        <div className={`px-4 py-3 rounded-2xl border transition-all ${
          isUser
            ? "bg-primary text-white border-primary rounded-tr-xs shadow-xs"
            : "bg-card-bg text-text-primary border-border-default rounded-tl-xs shadow-xs"
        }`}>
          <div className="select-text">
            {renderContent(message.text)}
          </div>
        </div>

        {/* Source Citations with exact page references */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full mt-2.5 bg-card-bg border border-border-default rounded-xl p-3 shadow-xs">
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className="flex items-center justify-between w-full text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <span>Grounded Evidence Citations ({message.sources.length})</span>
              </div>
              {showSources ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {showSources && (
              <div className="mt-2.5 pt-2.5 border-t border-border-default space-y-2">
                {message.sources.map((source, idx) => (
                  <SourceCard key={idx} source={source} />
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-[10px] text-text-muted mt-1 px-1 font-mono">
          {message.timestamp}
        </span>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <User className="w-4 h-4" />
        </div>
      )}

    </div>
  );
}
