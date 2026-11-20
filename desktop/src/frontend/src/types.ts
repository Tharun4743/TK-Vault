export interface SourceCitation {
  docId: string;
  docName: string;
  pageNumber: number;
  excerpt: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: SourceCitation[];
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  pageCount: number;
}
