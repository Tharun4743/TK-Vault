package com.aura.config;

import com.aura.model.Setting;
import com.aura.repository.SettingRepository;
import com.aura.service.AuditLogService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private final SettingRepository settingRepository;
    private final AuditLogService auditLogService;

    public DatabaseInitializer(SettingRepository settingRepository, AuditLogService auditLogService) {
        this.settingRepository = settingRepository;
        this.auditLogService = auditLogService;
    }

    @Override
    public void run(String... args) {
        // Seed default zero-pretrained offline settings if empty
        if (settingRepository.count() == 0) {
            Map<String, String> defaults = new HashMap<>();
            defaults.put("ai_service_url", "http://127.0.0.1:5000");
            defaults.put("compute_device", "cuda");
            defaults.put("chunk_size", "500");
            defaults.put("overlap", "100");
            defaults.put("top_k", "5");
            defaults.put("context_window", "256");
            defaults.put("model_name", "Custom-ZeroPretrained-Transformer");
            defaults.put("temperature", "0.1");
            defaults.put("strict_refusal", "true");
            defaults.put("enable_fallback", "false");

            defaults.forEach((key, value) -> {
                settingRepository.save(Setting.builder().key(key).value(value).build());
            });
            System.out.println("AURA: Seeded default zero-pretrained offline settings into SQLite.");
        }

        // Add starting system log entry
        auditLogService.logEvent(
                "SERVER_START",
                "AURA Zero-Pretrained Offline SQLite3 database kernel successfully mounted.",
                "Success"
        );
    }
}
