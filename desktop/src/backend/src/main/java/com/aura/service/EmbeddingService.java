package com.aura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EmbeddingService(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
    }

    /**
     * Generates a 100% offline dense vector embedding using the local ONNX bi-encoder sidecar.
     * Falls back to Ollama only if the sidecar encounters an unexpected issue.
     */
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            return new float[384];
        }

        // 1. Prioritize 100% offline native sidecar (Zero Ollama required)
        try {
            String userDir = System.getProperty("user.dir");
            File sidecarDir;
            if (userDir.endsWith("backend")) {
                sidecarDir = new File(userDir, "sidecars");
            } else if (new File(userDir, "desktop/src/backend/sidecars").exists()) {
                sidecarDir = new File(userDir, "desktop/src/backend/sidecars");
            } else {
                sidecarDir = new File(new File(userDir, "backend"), "sidecars");
            }

            File sidecarScript = new File(sidecarDir, "embedder_sidecar.py");
            if (sidecarScript.exists()) {
                ProcessBuilder pb = new ProcessBuilder(
                    PythonResolver.resolvePythonCommand(),
                    sidecarScript.getAbsolutePath(),
                    text
                );
                pb.directory(sidecarDir);
                Process process = pb.start();
                boolean finished = process.waitFor(10, TimeUnit.SECONDS);

                if (finished && process.exitValue() == 0) {
                    float[] vec = objectMapper.readValue(process.getInputStream(), float[].class);
                    if (vec != null && vec.length > 0) {
                        return vec;
                    }
                } else {
                    log.warn("[AURA ML] Embedder sidecar exited with code: {}. Falling back to Ollama.", process.exitValue());
                }
            }
        } catch (Exception e) {
            log.warn("[AURA ML] Native embedder sidecar failed ({}), falling back to Ollama.", e.getMessage());
        }

        // 2. Fallback to Ollama if sidecar is unavailable
        return ollamaService.embed(text);
    }

    public List<float[]> embedBatch(List<String> texts) {
        List<float[]> results = new ArrayList<>();
        if (texts == null) return results;
        for (String text : texts) {
            results.add(embed(text));
        }
        return results;
    }
}
