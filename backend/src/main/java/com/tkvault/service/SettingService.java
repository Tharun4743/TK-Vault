package com.tkvault.service;

import com.tkvault.model.Setting;
import com.tkvault.repository.SettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.File;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

@Service
public class SettingService {

    private final SettingRepository settingRepository;

    @Value("${spring.datasource.url:}")
    private String dbUrl;

    public SettingService(SettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    public Map<String, String> getAllSettings() {
        Map<String, String> settingsMap = new HashMap<>();
        settingRepository.findAll().forEach(setting -> {
            settingsMap.put(setting.getKey(), setting.getValue());
        });
        return settingsMap;
    }

    @Transactional
    public void saveSettings(Map<String, String> settings) {
        for (Map.Entry<String, String> entry : settings.entrySet()) {
            Setting setting = settingRepository.findByKey(entry.getKey())
                    .orElse(Setting.builder().key(entry.getKey()).build());
            setting.setValue(entry.getValue());
            settingRepository.save(setting);
        }
    }

    public String getSetting(String key, String defaultValue) {
        return settingRepository.findByKey(key)
                .map(Setting::getValue)
                .orElse(defaultValue);
    }
}
