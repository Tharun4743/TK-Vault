package com.tkvault.service;

import com.tkvault.model.Document;
import com.tkvault.repository.DocumentRepository;
import com.tkvault.retrieval.BM25Engine;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AsyncDocumentProcessor {

    private static final Logger log = LoggerFactory.getLogger(AsyncDocumentProcessor.class);

    private final DocumentRepository   documentRepository;
    private final ChunkingService      chunkingService;
    private final EmbeddingService     embeddingService;
    private final ChromaDBService      chromaDBService;
    private final BM25Engine           bm25Engine;
    private final AuditLogService      auditLogService;
    private final SettingService       settingService;
    private final IndexingJobService   jobService;

    public AsyncDocumentProcessor(DocumentRepository documentRepository,
                                   ChunkingService chunkingService,
                                   EmbeddingService embeddingService,
                                   ChromaDBService chromaDBService,
                                   BM25Engine bm25Engine,
                                   AuditLogService auditLogService,
                                   SettingService settingService,
                                   IndexingJobService jobService) {
        this.documentRepository = documentRepository;
        this.chunkingService = chunkingService;
        this.embeddingService = embeddingService;
        this.chromaDBService = chromaDBService;
        this.bm25Engine = bm25Engine;
        this.auditLogService = auditLogService;
        this.settingService = settingService;
        this.jobService = jobService;
    }

    @Async("documentIndexingExecutor")
    public void processDocument(String filename,
                                 String contentType,
                                 byte[] fileBytes,
                                 long fileSize,
                                 IndexingJobService.IndexingJob job) {
        log.info("[TK-VAULT INDEXER] Starting async indexing job {} for file: {}", job.jobId, filename);
        jobService.markProcessing(job, "Extracting text from document...");

        try {
            // ── Step 1: Text extraction (PDF, DOCX, TXT) ──────────────────
            List<String> pagesText = extractTextByPage(filename, fileBytes);
            int pageCount = pagesText.size();
            log.info("[TK-VAULT INDEXER] Job {} — extracted {} pages from '{}'", job.jobId, pageCount, filename);

            // ── Step 2: Persist document metadata to SQLite ──────────────
            Document document = Document.builder()
                    .name(filename)
                    .type(contentType)
                    .size(fileSize)
                    .uploadedAt(LocalDateTime.now())
                    .pageCount(pageCount)
                    .build();
            document = documentRepository.save(document);
            final String docId = document.getId();

            // ── Step 3: Chunking + BM25 and Vector Indexing ───────────────
            int chunkSize   = parseInt(settingService.getSetting("chunk_size", "500"));
            int overlapSize = parseInt(settingService.getSetting("overlap", "100"));

            List<String>              ids       = new ArrayList<>();
            List<String>              texts     = new ArrayList<>();
            List<float[]>             embeddings = new ArrayList<>();
            List<Map<String, Object>> metadatas  = new ArrayList<>();

            int chunkCounter = 0;

            for (int p = 0; p < pageCount; p++) {
                String pageText = pagesText.get(p);
                if (pageText == null || pageText.isBlank()) continue;

                List<String> chunks = chunkingService.overlappingChunk(pageText, chunkSize, overlapSize);
                jobService.markProcessing(job,
                    String.format("Indexing page %d / %d (%d chunks)...", p + 1, pageCount, chunks.size()));

                for (int c = 0; c < chunks.size(); c++) {
                    String chunkText = chunks.get(c);
                    String chunkId   = "chunk-" + docId + "-" + p + "-" + c;

                    // 1. Index into Java BM25 probabilistic retrieval engine (Primary zero-pretrained RAG)
                    bm25Engine.indexChunk(chunkId, docId, filename, p + 1, chunkText);

                    // 2. Optional dense vector generation
                    try {
                        float[] embedding = embeddingService.embed(chunkText);
                        if (embedding != null && embedding.length > 0) {
                            ids.add(chunkId);
                            texts.add(chunkText);
                            embeddings.add(embedding);

                            Map<String, Object> meta = new HashMap<>();
                            meta.put("docId", docId);
                            meta.put("docName", filename);
                            meta.put("pageNumber", p + 1);
                            metadatas.add(meta);
                        }
                    } catch (Exception ex) {
                        log.debug("[TK-VAULT] Vector sidecar skipped: {}", ex.getMessage());
                    }

                    chunkCounter++;
                }

                if (ids.size() >= 100) {
                    try {
                        chromaDBService.createCollection("tkvault-documents");
                        chromaDBService.addChunks("tkvault-documents", ids, texts, embeddings, metadatas);
                    } catch (Exception ignored) {}
                    ids.clear(); texts.clear(); embeddings.clear(); metadatas.clear();
                }
            }

            if (!ids.isEmpty()) {
                try {
                    chromaDBService.createCollection("tkvault-documents");
                    chromaDBService.addChunks("tkvault-documents", ids, texts, embeddings, metadatas);
                } catch (Exception ignored) {}
            }

            // ── Step 4: Mark job complete ────────────────────────────────
            jobService.markDone(job, pageCount, chunkCounter);
            auditLogService.logEvent("UPLOAD",
                "Indexing complete for \"" + filename + "\": " + chunkCounter + " chunks from " + pageCount + " pages.",
                "Success");

            log.info("[TK-VAULT INDEXER] Job {} — DONE: {} chunks indexed for '{}'",
                job.jobId, chunkCounter, filename);

        } catch (Exception e) {
            log.error("[TK-VAULT INDEXER] Job {} — FAILED for '{}': {}", job.jobId, filename, e.getMessage(), e);
            jobService.markFailed(job, e.getMessage());
            auditLogService.logEvent("UPLOAD_ERROR",
                "Async indexing FAILED for \"" + filename + "\": " + e.getMessage(), "Failed");
        }
    }

    private List<String> extractTextByPage(String filename, byte[] fileBytes) throws Exception {
        List<String> pagesText = new ArrayList<>();
        if (filename != null && filename.toLowerCase().endsWith(".pdf")) {
            try (PDDocument pdDoc = Loader.loadPDF(fileBytes)) {
                int pages = pdDoc.getNumberOfPages();
                PDFTextStripper stripper = new PDFTextStripper();
                for (int i = 1; i <= pages; i++) {
                    stripper.setStartPage(i);
                    stripper.setEndPage(i);
                    String pageText = stripper.getText(pdDoc);
                    pagesText.add(pageText != null ? pageText.trim() : "");
                }
            }
        } else if (filename != null && filename.toLowerCase().endsWith(".docx")) {
            try (ByteArrayInputStream bais = new ByteArrayInputStream(fileBytes);
                 XWPFDocument docx = new XWPFDocument(bais)) {
                StringBuilder docxText = new StringBuilder();
                for (XWPFParagraph p : docx.getParagraphs()) {
                    docxText.append(p.getText()).append("\n");
                }
                for (XWPFTable t : docx.getTables()) {
                    for (XWPFTableRow r : t.getRows()) {
                        for (XWPFTableCell c : r.getTableCells()) {
                            docxText.append(c.getText()).append(" | ");
                        }
                        docxText.append("\n");
                    }
                }
                pagesText.add(docxText.toString().trim());
            }
        } else {
            // Plain text / markdown — single page
            pagesText.add(new String(fileBytes, StandardCharsets.UTF_8));
        }
        return pagesText;
    }

    private int parseInt(String val) {
        try { return Integer.parseInt(val); } catch (NumberFormatException e) { return 500; }
    }
}
