import React, { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadDocument } from "../services/api";

interface FileUploaderProps {
  onUploadSuccess: (filename: string, type: string) => void;
  onError: (msg: string) => void;
}

export default function FileUploader({ onUploadSuccess, onError }: FileUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [currentAction, setCurrentAction] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isDoc = ext === "pdf" || ext === "docx" || ext === "doc" || ext === "txt" || ext === "md";

    if (!isDoc) {
      onError("Unsupported file format. Please upload PDF, DOCX, or TXT documents.");
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setProgress(0);

    let fakeInterval: any = null;
    const startFakeTicks = (actionText: string) => {
      setCurrentAction(actionText);
      let current = 90;
      fakeInterval = setInterval(() => {
        if (current < 98) {
          current += 1;
          setProgress(current);
        } else {
          clearInterval(fakeInterval);
        }
      }, 700);
    };

    const handleProgress = (pct: number) => {
      if (pct < 100) {
        setCurrentAction("Uploading document to local server...");
        setProgress(Math.round((pct * 90) / 100));
      } else {
        setProgress(90);
        startFakeTicks("Extracting text and indexing into BM25 engine...");
      }
    };

    try {
      const uploadPromise = uploadDocument(file, handleProgress);
      await uploadPromise;
      if (fakeInterval) clearInterval(fakeInterval);
      setProgress(100);
      setStatus("success");
      onUploadSuccess(file.name, "document");

      setTimeout(() => {
        setStatus("idle");
        setProgress(0);
        setFileName("");
        setCurrentAction("");
      }, 2500);

    } catch (err: any) {
      if (fakeInterval) clearInterval(fakeInterval);
      console.error("Document indexing failed:", err);
      setStatus("error");
      onError(err.message || "Failed to process and index document.");
      setTimeout(() => setStatus("idle"), 3500);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.doc,.txt,.md"
        onChange={handleFileChange}
      />

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={status === "idle" ? () => fileInputRef.current?.click() : undefined}
        className={`border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[160px] text-center select-none ${
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-border-default hover:border-primary/60 hover:bg-card-bg/50"
        } ${status !== "idle" ? "pointer-events-none" : ""}`}
      >
        {status === "idle" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary-light flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-sans text-sm font-bold text-text-primary">
              Drag & drop documents here, or click to browse
            </p>
            <p className="font-sans text-xs text-text-muted mt-1">
              Supports PDF, DOCX, and TXT (Preserves page boundaries)
            </p>
          </>
        )}

        {status === "uploading" && (
          <div className="w-full max-w-sm flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-primary-light animate-spin mb-3" />
            <span className="font-mono text-xs font-bold text-text-secondary uppercase tracking-wider mb-1 select-text">
              {currentAction}
            </span>
            <p className="font-sans text-xs text-text-muted truncate w-full max-w-xs mb-3">
              Document: <span className="font-semibold text-text-primary">{fileName}</span>
            </p>
            
            <div className="w-full bg-app-bg h-1.5 rounded-full overflow-hidden mb-2 border border-border-default">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-text-muted font-bold">
              {progress}%
            </span>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 animate-bounce" />
            <p className="font-sans text-sm font-bold text-text-primary">
              Document Successfully Indexed!
            </p>
            <p className="font-sans text-xs text-text-secondary mt-1 select-text">
              {fileName} is now active in the BM25 retrieval index.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
            <p className="font-sans text-sm font-bold text-text-primary">
              Indexing Failed
            </p>
            <p className="font-sans text-xs text-red-400 mt-1">
              Please check document format and try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
