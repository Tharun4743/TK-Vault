package com.aura.controller;

import com.aura.service.PythonAiClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Model Management API", description = "Endpoints for controlling custom Transformer training and model checkpoints")
@RestController
@RequestMapping("/api/model")
public class ModelController {

    private final PythonAiClient pythonAiClient;

    public ModelController(PythonAiClient pythonAiClient) {
        this.pythonAiClient = pythonAiClient;
    }

    @Operation(summary = "Get AI Model and Training Status",
               description = "Returns hardware utilization, training state, vocab size, and checkpoint info")
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getModelStatus() {
        Map<String, Object> status = pythonAiClient.getStatus();
        status.put("isServiceOnline", pythonAiClient.isServiceAlive());
        return ResponseEntity.ok(status);
    }

    @Operation(summary = "Start Local Model Training",
               description = "Triggers local autoregressive next-token prediction training on the custom Transformer")
    @PostMapping("/train")
    public ResponseEntity<Map<String, Object>> startTraining(@RequestBody(required = false) Map<String, Object> config) {
        Map<String, Object> effectiveConfig = config != null ? config : new HashMap<>();
        Map<String, Object> result = pythonAiClient.triggerTraining(effectiveConfig);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Stop Model Training",
               description = "Stops ongoing training gracefully")
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stopTraining() {
        Map<String, Object> result = pythonAiClient.stopTraining();
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "List Saved Checkpoints",
               description = "Returns locally stored weights checkpoints")
    @GetMapping("/checkpoints")
    public ResponseEntity<List<Map<String, Object>>> getCheckpoints() {
        List<Map<String, Object>> list = new ArrayList<>();
        File ckptDir = new File("ai_service/checkpoints");
        if (ckptDir.exists() && ckptDir.isDirectory()) {
            File[] files = ckptDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("name", f.getName());
                    item.put("sizeBytes", f.length());
                    item.put("lastModified", f.lastModified());
                    list.add(item);
                }
            }
        }
        return ResponseEntity.ok(list);
    }
}
