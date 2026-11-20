import { useState } from "react";
import { DocumentInfo } from "../types";
import { 
  FileText, 
  Search, 
  Trash2, 
  Upload, 
  CheckCircle2,
  Calendar
} from "lucide-react";
import { PageLayout } from "./layout/PageLayout";
import { Table, THead, TBody, TR, TH, TD } from "./ui/Table";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

interface LibraryViewProps {
  documents: DocumentInfo[];
  onDeleteDocument: (id: string) => void;
  onTriggerUpload: () => void;
  onError: (msg: string) => void;
}

export default function LibraryView({
  documents,
  onDeleteDocument,
  onTriggerUpload,
}: LibraryViewProps) {
  const [docSearch, setDocSearch] = useState("");
  const [docFilter, setDocFilter] = useState<"ALL" | "PDF" | "DOCX" | "TXT">("ALL");
  const [docSort, setDocSort] = useState<"name" | "size" | "pages">("name");

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFormatBadge = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() || "DOC";
    if (ext === "PDF") return <Badge variant="danger">PDF</Badge>;
    if (ext === "DOCX" || ext === "DOC") return <Badge variant="info">DOCX</Badge>;
    return <Badge variant="success">TXT</Badge>;
  };

  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(docSearch.toLowerCase());
      const ext = doc.name.split(".").pop()?.toUpperCase() || "";
      let matchesFilter = true;
      if (docFilter === "PDF") matchesFilter = ext === "PDF";
      else if (docFilter === "DOCX") matchesFilter = ext === "DOCX" || ext === "DOC";
      else if (docFilter === "TXT") matchesFilter = ext === "TXT" || ext === "MD";
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (docSort === "name") return a.name.localeCompare(b.name);
      if (docSort === "size") return b.size - a.size;
      if (docSort === "pages") return (b.pageCount || 0) - (a.pageCount || 0);
      return 0;
    });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0b0e] select-none">
      <PageLayout>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="neutral">Knowledge Base</Badge>
              <Badge variant="success">Okapi BM25 Indexed</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Document Library
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage uploaded PDF, DOCX, and TXT files. All texts are chunked with preserved page references.
            </p>
          </div>

          <Button variant="primary" onClick={onTriggerUpload}>
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </Button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#141418] p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              placeholder="Search documents by name..."
              className="pl-10 h-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 bg-zinc-50 dark:bg-[#101014]">
              {(["ALL", "PDF", "DOCX", "TXT"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDocFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    docFilter === filter
                      ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <Select
              value={docSort}
              onChange={(e) => setDocSort(e.target.value as any)}
              className="w-36 h-10 text-xs"
            >
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
              <option value="pages">Sort: Pages</option>
            </Select>
          </div>
        </div>

        {/* Documents Table */}
        {filteredDocs.length === 0 ? (
          <Card className="py-16 text-center flex flex-col items-center justify-center border-dashed">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
              No documents found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
              Upload PDF, DOCX, or TXT documents to extract text and make them searchable via local BM25.
            </p>
            <Button variant="primary" onClick={onTriggerUpload}>
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </Button>
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Document Name</TH>
                <TH>Format</TH>
                <TH>File Size</TH>
                <TH>Page Count</TH>
                <TH>Indexing Status</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </THead>
            <TBody>
              {filteredDocs.map((doc) => (
                <TR key={doc.id}>
                  <TD className="font-semibold text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="truncate max-w-[280px] md:max-w-[360px]" title={doc.name}>
                        {doc.name}
                      </span>
                    </div>
                  </TD>
                  <TD>{getFormatBadge(doc.name)}</TD>
                  <TD className="font-mono text-xs">{formatBytes(doc.size)}</TD>
                  <TD className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                    {doc.pageCount ? `${doc.pageCount} pages` : "1 page"}
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </span>
                  </TD>
                  <TD className="text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(doc.id)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

      </PageLayout>
    </div>
  );
}
