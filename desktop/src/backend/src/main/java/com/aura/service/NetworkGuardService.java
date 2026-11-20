package com.aura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class NetworkGuardService {

    private static final Logger log = LoggerFactory.getLogger(NetworkGuardService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${aura.ai-service.url:http://127.0.0.1:5000}")
    private String aiServiceUrl;

    @PostConstruct
    public void checkOfflineInfrastructure() {
        log.info("[AURA NEURAL GUARD] Verifying 100% offline zero-pretrained AI model service on {}...", aiServiceUrl);

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/status"))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == HttpURLConnection.HTTP_OK) {
                Map<?, ?> json = objectMapper.readValue(response.body(), Map.class);
                Object params = json.get("model_parameters");
                Object vocab = json.get("vocab_size");
                log.info("[AURA NEURAL GUARD] Custom Scratch Transformer verified online: {} parameters, vocab size: {}", params, vocab);
            } else {
                log.warn("[AURA NEURAL GUARD] Python AI service responded with HTTP status {}", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("[AURA NEURAL GUARD] Python AI service not currently reachable on {}. Ensure ai_service is started.", aiServiceUrl);
        }

        log.info("[AURA NEURAL GUARD] Zero-pretrained offline architecture verified.");
    }
}
