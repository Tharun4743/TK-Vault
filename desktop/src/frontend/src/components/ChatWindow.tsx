import { useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble";
import { Cpu, FileText, CheckCircle2 } from "lucide-react";

interface ChatWindowProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export default function ChatWindow({ messages, isStreaming, onSelectPrompt }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-app-bg py-6 px-4 md:px-8 scroll-smooth"
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        
        {messages.length === 0 ? (
          /* Empty / Initial Welcome State */
          <div className="flex flex-col items-center justify-center text-center mt-8 md:mt-12 select-none">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-light mb-5 shadow-xl shadow-primary/5">
              <Cpu className="w-7 h-7" />
            </div>
            
            <h2 className="font-display text-2xl font-black text-text-primary tracking-tight mb-2">
              Grounded Document RAG Assistant
            </h2>
            <p className="text-xs text-text-secondary max-w-lg mb-8 leading-relaxed font-sans">
              Ask natural-language questions grounded strictly in your uploaded PDF, DOCX, and TXT documents.
              Zero pretrained models — answers cite exact document names and page numbers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full text-left font-sans">
              <div 
                onClick={() => onSelectPrompt?.("Summarize the key findings and conclusions in the uploaded document.")}
                className="border border-border-default p-4 rounded-xl bg-card-bg hover:border-primary/50 transition-all duration-200 shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5 text-primary-light">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Executive Summary</span>
                </div>
                <p className="text-xs text-text-primary font-semibold leading-snug">
                  Summarize Key Findings
                </p>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  Extract core takeaways, conclusions, and action items.
                </p>
              </div>

              <div 
                onClick={() => onSelectPrompt?.("Extract all technical definitions, formulas, and specifications mentioned.")}
                className="border border-border-default p-4 rounded-xl bg-card-bg hover:border-primary/50 transition-all duration-200 shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Technical Audit</span>
                </div>
                <p className="text-xs text-text-primary font-semibold leading-snug">
                  Definitions & Formulas
                </p>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  Retrieve verified formulas, parameters, and citations.
                </p>
              </div>

              <div 
                onClick={() => onSelectPrompt?.("What are the limitations, trade-offs, and methodology described?")}
                className="border border-border-default p-4 rounded-xl bg-card-bg hover:border-primary/50 transition-all duration-200 shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5 text-purple-500">
                  <Cpu className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Methodology</span>
                </div>
                <p className="text-xs text-text-primary font-semibold leading-snug">
                  Methodology & Constraints
                </p>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  Inspect constraints, assumptions, and validation metrics.
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

      </div>
    </div>
  );
}
