package com.tkvault.websocket;

import com.tkvault.model.Chat;
import com.tkvault.model.SearchResult;
import com.tkvault.repository.ChatRepository;
import com.tkvault.repository.DocumentRepository;
import com.tkvault.retrieval.BM25Engine;
import com.tkvault.service.AuditLogService;
import com.tkvault.service.ChromaDBService;
import com.tkvault.service.EmbeddingService;
import com.tkvault.service.OllamaService;
import com.tkvault.service.PythonAiClient;
import com.tkvault.service.SettingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;
import java.util.*;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final EmbeddingService embeddingService;
    private final ChromaDBService chromaDBService;
    private final BM25Engine bm25Engine;
    private final PythonAiClient pythonAiClient;
    private final OllamaService ollamaService;
    private final ChatRepository chatRepository;
    private final DocumentRepository documentRepository;
    private final SettingService settingService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatWebSocketHandler(EmbeddingService embeddingService,
                                 ChromaDBService chromaDBService,
                                 BM25Engine bm25Engine,
                                 PythonAiClient pythonAiClient,
                                 OllamaService ollamaService,
                                 ChatRepository chatRepository,
                                 DocumentRepository documentRepository,
                                 SettingService settingService,
                                 AuditLogService auditLogService) {
        this.embeddingService = embeddingService;
        this.chromaDBService = chromaDBService;
        this.bm25Engine = bm25Engine;
        this.pythonAiClient = pythonAiClient;
        this.ollamaService = ollamaService;
        this.chatRepository = chatRepository;
        this.documentRepository = documentRepository;
        this.settingService = settingService;
        this.auditLogService = auditLogService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("[TK-VAULT WS] Connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        Map<?, ?> requestMap = objectMapper.readValue(payload, Map.class);

        Object msgObj = requestMap.get("message");
        String messageText = null;
        if (msgObj instanceof String s) {
            messageText = s;
        } else if (msgObj instanceof Map<?, ?> m) {
            Object inner = m.get("text") != null ? m.get("text") : m.get("message");
            if (inner != null) messageText = inner.toString();
        }
        if (messageText == null && requestMap.get("text") != null) {
            messageText = requestMap.get("text").toString();
        }
        if (messageText == null && requestMap.get("question") != null) {
            messageText = requestMap.get("question").toString();
        }

        String filterDocId = null;
        if (requestMap.get("filterDocId") != null) {
            filterDocId = requestMap.get("filterDocId").toString();
        } else if (requestMap.get("docId") != null) {
            filterDocId = requestMap.get("docId").toString();
        } else if (msgObj instanceof Map<?, ?> m && m.get("docId") != null) {
            filterDocId = m.get("docId").toString();
        }

        int topK = 5;
        try {
            topK = Integer.parseInt(settingService.getSetting("top_k", "5"));
        } catch (Exception ignored) {}

        if (messageText == null || messageText.trim().isEmpty()) {
            return;
        }

        StringBuilder responseBuffer = new StringBuilder();
        List<Map<String, Object>> citationsList = new ArrayList<>();

        // ── Step 1: Execute Native Java BM25 Lexical Retrieval ────────────
        List<BM25Engine.ScoredResult> bm25Results = bm25Engine.search(messageText, topK, filterDocId);

        // Fallback to ChromaDB dense vector search if BM25 is empty
        List<SearchResult> vectorResults = Collections.emptyList();
        if (bm25Results.isEmpty()) {
            float[] queryVec = embeddingService.embed(messageText);
            vectorResults = chromaDBService.query("tkvault-documents", queryVec, topK, filterDocId);
        }

        boolean hasEvidence = (!bm25Results.isEmpty() && bm25Results.get(0).score > 0.05) ||
                              (!vectorResults.isEmpty() && vectorResults.get(0).getScore() > 25.0);

        if (hasEvidence) {
            StringBuilder contextBuilder = new StringBuilder();

            if (!bm25Results.isEmpty()) {
                for (BM25Engine.ScoredResult r : bm25Results) {
                    contextBuilder.append("[").append(r.chunk.docName)
                            .append(" (Page ").append(r.chunk.pageNumber).append(")] ")
                            .append(r.chunk.text).append("\n\n");

                    Map<String, Object> cite = new HashMap<>();
                    cite.put("docId", r.chunk.docId);
                    cite.put("docName", r.chunk.docName);
                    cite.put("pageNumber", r.chunk.pageNumber);
                    cite.put("excerpt", r.chunk.text);
                    cite.put("score", Math.round(r.score * 100.0) / 100.0);
                    citationsList.add(cite);
                }
            } else {
                for (SearchResult r : vectorResults) {
                    contextBuilder.append("[").append(r.getCitation()).append("] ")
                            .append(r.getChunkText()).append("\n\n");

                    Map<String, Object> cite = new HashMap<>();
                    cite.put("docId", r.getDocId());
                    cite.put("docName", r.getDocName());
                    cite.put("pageNumber", r.getPageNumber());
                    cite.put("excerpt", r.getChunkText());
                    cite.put("score", r.getScore());
                    citationsList.add(cite);
                }
            }

            String context = contextBuilder.toString().trim();
            String systemPrompt = "You are TK-Vault - Sovereign Document Intelligence Assistant. Answer STRICTLY based on the provided document context. Cite document name and page number.";

            // ── Step 2: Query Dedicated Local Python AI Model Service ──────
            String generatedAnswer = pythonAiClient.generateAnswer(messageText, context, systemPrompt);

            if (generatedAnswer != null && !generatedAnswer.isBlank()) {
                // Stream response token-by-token
                streamTokensToSession(session, generatedAnswer, responseBuffer);
            } else {
                // Grounded native synthesis fallback
                String nativeAnswer = "Based on the retrieved document evidence:\n\n" + context;
                streamTokensToSession(session, nativeAnswer, responseBuffer);
            }
        } else {
            // Strict Refusal when evidence is insufficient
            String refusal = "I couldn't find sufficient information in the uploaded documents to answer this question accurately.";
            streamTokensToSession(session, refusal, responseBuffer);
        }

        // ── Step 3: Send Final Completion Payload ─────────────────────────
        Map<String, Object> donePayload = new HashMap<>();
        donePayload.put("type", "done");
        donePayload.put("sources", citationsList);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(donePayload)));

        // ── Step 4: Persist Conversation Session in SQLite ────────────────
        try {
            Chat chat = Chat.builder()
                    .question(messageText)
                    .answer(responseBuffer.toString())
                    .createdAt(LocalDateTime.now())
                    .model("TK-Vault-ZeroPretrained-Transformer")
                    .sessionId(session.getId())
                    .sources(objectMapper.writeValueAsString(citationsList))
                    .build();
            chatRepository.save(chat);
            auditLogService.logEvent("CHAT_QUERY", "User queried: " + messageText, "Success");
        } catch (Exception ex) {
            log.error("[TK-VAULT WS] Failed saving chat history: {}", ex.getMessage());
        }
    }

    private void streamTokensToSession(WebSocketSession session, String fullText, StringBuilder responseBuffer) {
        String[] tokens = fullText.split("(?<=\\s)|(?=\\n)");
        for (String token : tokens) {
            try {
                responseBuffer.append(token);
                Map<String, Object> tokenPayload = new HashMap<>();
                tokenPayload.put("type", "token");
                tokenPayload.put("data", token);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(tokenPayload)));
                Thread.sleep(10); // Real-time token streaming cadence
            } catch (Exception ex) {
                log.error("[TK-VAULT WS] Token stream failed: {}", ex.getMessage());
                break;
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("[TK-VAULT WS] Disconnected: {}", session.getId());
    }
}
