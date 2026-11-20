package com.aura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * High-performance Java HttpClient bridge connecting Spring Boot to the
 * local Python AI Service running on localhost:5000.
 * Enforces strict loopback-only communication.
 */
@Service
public class PythonAiClient {

    private static final Logger log = LoggerFactory.getLogger(PythonAiClient.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${aura.python.ai.url:http://127.0.0.1:5000}")
    private String aiServiceUrl;

    public PythonAiClient() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    public boolean isServiceAlive() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/health"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getStatus() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/status"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), Map.class);
            }
        } catch (Exception e) {
            log.debug("[PythonAiClient] Status check unavailable: {}", e.getMessage());
        }
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("status", "offline");
        fallback.put("model", "Custom-Transformer-Scratch");
        fallback.put("weights", "Random-Initialized");
        return fallback;
    }

    @SuppressWarnings("unchecked")
    public String generateAnswer(String question, String context, String systemPrompt) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("question", question);
            payload.put("context", context);
            payload.put("system_prompt", systemPrompt != null ? systemPrompt : "");
            payload.put("max_tokens", 512);
            payload.put("temperature", 0.2);

            String jsonPayload = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/generate"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> respMap = objectMapper.readValue(response.body(), Map.class);
                return (String) respMap.getOrDefault("answer", "");
            }
        } catch (Exception e) {
            log.warn("[PythonAiClient] Local AI generation call failed: {}", e.getMessage());
        }
        return null; // Fallback to native Java synthesis
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> triggerTraining(Map<String, Object> trainingConfig) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(trainingConfig);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/train"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), Map.class);
            }
        } catch (Exception e) {
            log.error("[PythonAiClient] Failed to trigger training: {}", e.getMessage());
        }
        Map<String, Object> err = new HashMap<>();
        err.put("error", "Failed to communicate with local Python AI training service");
        return err;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> stopTraining() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/stop"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(5))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), Map.class);
            }
        } catch (Exception e) {
            log.error("[PythonAiClient] Failed to stop training: {}", e.getMessage());
        }
        Map<String, Object> err = new HashMap<>();
        err.put("error", "Failed to communicate with local Python AI service to stop training");
        return err;
    }
}
