package com.tkvault.controller;

import com.tkvault.repository.DocumentRepository;
import com.tkvault.repository.AuditLogRepository;
import com.tkvault.retrieval.BM25Engine;
import com.tkvault.service.ChromaDBService;
import com.tkvault.service.PythonAiClient;
import jakarta.persistence.EntityManager;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "Stats API", description = "Endpoints for retrieving system metrics and database analytics")
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final EntityManager entityManager;
    private final ChromaDBService chromaDBService;
    private final BM25Engine bm25Engine;
    private final PythonAiClient pythonAiClient;

    public StatsController(DocumentRepository documentRepository,
                           AuditLogRepository auditLogRepository,
                           EntityManager entityManager,
                           ChromaDBService chromaDBService,
                           BM25Engine bm25Engine,
                           PythonAiClient pythonAiClient) {
        this.documentRepository = documentRepository;
        this.auditLogRepository = auditLogRepository;
        this.entityManager = entityManager;
        this.chromaDBService = chromaDBService;
        this.bm25Engine = bm25Engine;
        this.pythonAiClient = pythonAiClient;
    }

    @Operation(summary = "Get workspace stats", description = "Returns statistics on indexed document counts, vector chunks, audit logs, and local SQLite storage usage")
    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            long docCount = documentRepository.count();
            long logCount = auditLogRepository.count();

            // Native BM25 probabilistic indexed chunks
            int bm25Chunks = bm25Engine.getTotalChunks();
            long chunkCount = bm25Chunks > 0 ? bm25Chunks : chromaDBService.getCollectionSize("tkvault-documents");

            // Sum of sizes from documents table
            long storageUsed = 0;
            long totalPages = 0;
            try {
                Number sum = (Number) entityManager.createNativeQuery("SELECT SUM(size) FROM documents").getSingleResult();
                if (sum != null) {
                    storageUsed = sum.longValue();
                }
                Number pageSum = (Number) entityManager.createNativeQuery("SELECT SUM(page_count) FROM documents").getSingleResult();
                if (pageSum != null) {
                    totalPages = pageSum.longValue();
                }
            } catch (Exception e) {
                // Table empty or not loaded yet
            }

            stats.put("documentsCount", docCount);
            stats.put("totalPages", totalPages);
            stats.put("chunksCount", chunkCount);
            stats.put("auditLogsCount", logCount);
            stats.put("storageUsed", storageUsed);
            stats.put("aiServiceOnline", pythonAiClient.isServiceAlive());
            stats.put("aiStatus", pythonAiClient.getStatus());
        } catch (Exception e) {
            stats.put("error", e.getMessage());
        }
        return ResponseEntity.ok(stats);
    }
}
