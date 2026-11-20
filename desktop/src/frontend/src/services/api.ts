import { DocumentInfo } from "../types";

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export function uploadDocument(file: File, onProgress?: (pct: number) => void): Promise<{ id: string; name: string; pageCount: number; status: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          resolve(xhr.responseText as any);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || "Failed to upload and index document"));
        } catch (e) {
          reject(new Error("Failed to upload and index document"));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error during file upload"));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function fetchSessions(): Promise<any[]> {
  const res = await fetch("/api/chats/sessions");
  if (!res.ok) throw new Error("Failed to load chat sessions");
  return res.json();
}

export async function fetchSessionChats(sessionId: string): Promise<any[]> {
  const res = await fetch(`/api/chats/session/${sessionId}`);
  if (!res.ok) throw new Error("Failed to load session history");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/chats/session/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete chat session");
}

export async function fetchStats(): Promise<any> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to load system stats");
  return res.json();
}

export async function fetchModelStatus(): Promise<any> {
  const res = await fetch("/api/model/status");
  if (!res.ok) throw new Error("Failed to load model status");
  return res.json();
}

export async function startModelTraining(config: any): Promise<any> {
  const res = await fetch("/api/model/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to trigger model training");
  return res.json();
}

export async function stopModelTraining(): Promise<any> {
  const res = await fetch("/api/model/stop", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to stop model training");
  return res.json();
}

export async function fetchCheckpoints(): Promise<any[]> {
  const res = await fetch("/api/model/checkpoints");
  if (!res.ok) return [];
  return res.json();
}
