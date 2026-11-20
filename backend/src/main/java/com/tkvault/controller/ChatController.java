package com.tkvault.controller;

import com.tkvault.dto.ChatRequest;
import com.tkvault.dto.ChatResponse;
import com.tkvault.dto.SourceCitation;
import com.tkvault.model.Chat;
import com.tkvault.repository.ChatRepository;
import com.tkvault.repository.DocumentRepository;
import com.tkvault.retrieval.BM25Engine;
import com.tkvault.service.AuditLogService;
import com.tkvault.service.PythonAiClient;
import com.tkvault.service.SettingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Tag(name = "Chat API", description = "Endpoints for document-grounded RAG query sessions using scratch Transformer")
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final BM25Engine bm25Engine;
    private final PythonAiClient pythonAiClient;
    private final ChatRepository chatRepository;
    private final DocumentRepository documentRepository;
    private final SettingService settingService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatController(BM25Engine bm25Engine,
                          PythonAiClient pythonAiClient,
                          ChatRepository chatRepository,
                          DocumentRepository documentRepository,
                          SettingService settingService,
                          AuditLogService auditLogService) {
        this.bm25Engine = bm25Engine;
        this.pythonAiClient = pythonAiClient;
        this.chatRepository = chatRepository;
        this.documentRepository = documentRepository;
        this.settingService = settingService;
        this.auditLogService = auditLogService;
    }

    @Operation(summary = "Submit query for RAG Retrieval", description = "Executes native Okapi BM25 search, constructs context, and queries the local custom Transformer model")
    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        try {
            String queryText = request.getMessage();
            if (queryText == null || queryText.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        ChatResponse.builder().text("Query cannot be empty").build()
                );
            }

            int topK = 5;
            try {
                topK = Integer.parseInt(settingService.getSetting("top_k", "5"));
            } catch (Exception ignored) {}

            String filterDocId = request.getFilterDocId();
            List<SourceCitation> citations = new ArrayList<>();
            String responseText;

            // 1. Native Okapi BM25 Retrieval
            List<BM25Engine.ScoredResult> bm25Results = bm25Engine.search(queryText, topK, filterDocId);

            boolean hasEvidence = !bm25Results.isEmpty() && bm25Results.get(0).score > 0.05;

            if (hasEvidence) {
                StringBuilder contextBuilder = new StringBuilder();
                for (BM25Engine.ScoredResult r : bm25Results) {
                    contextBuilder.append("[").append(r.chunk.docName)
                            .append(" (Page ").append(r.chunk.pageNumber).append(")] ")
                            .append(r.chunk.text).append("\n\n");

                    citations.add(SourceCitation.builder()
                            .docId(r.chunk.docId)
                            .docName(r.chunk.docName)
                            .pageNumber(r.chunk.pageNumber)
                            .excerpt(r.chunk.text)
                            .score(Math.round(r.score * 100.0) / 100.0)
                            .build());
                }

                String context = contextBuilder.toString().trim();
                String systemPrompt = "You are TK-Vault - Sovereign Document Intelligence Assistant. Answer STRICTLY based on the provided document context. Cite document name and page number.";

                // 2. Query Dedicated Local Python AI Service (Custom Scratch Transformer)
                String generatedAnswer = pythonAiClient.generateAnswer(queryText, context, systemPrompt);

                if (generatedAnswer != null && !generatedAnswer.isBlank()) {
                    responseText = generatedAnswer;
                } else {
                    responseText = "Based on the retrieved document evidence:\n\n" + context;
                }
            } else {
                // Grounded Refusal when no relevant documents exist
                responseText = "I couldn't find sufficient information in the uploaded documents to answer this question accurately.";
            }

            // 3. Persist conversation in SQLite
            String sourcesJson = "[]";
            try {
                sourcesJson = objectMapper.writeValueAsString(citations);
            } catch (Exception ignored) {}

            Chat chat = Chat.builder()
                    .question(queryText)
                    .answer(responseText)
                    .model("Custom-ZeroPretrained-Transformer")
                    .createdAt(LocalDateTime.now())
                    .sources(sourcesJson)
                    .sessionId(request.getSessionId() != null && !request.getSessionId().isEmpty() ? request.getSessionId() : "default")
                    .build();
            chatRepository.save(chat);

            auditLogService.logEvent(
                    "CHAT",
                    "BM25 + Custom Transformer query: \"" + queryText.substring(0, Math.min(queryText.length(), 40)) + "...\"",
                    "Success"
            );

            return ResponseEntity.ok(ChatResponse.builder()
                    .text(responseText)
                    .sources(citations)
                    .build());

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                    ChatResponse.builder().text("Error: " + e.getMessage()).build()
            );
        }
    }
}
