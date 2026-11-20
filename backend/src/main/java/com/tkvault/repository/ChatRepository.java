package com.tkvault.repository;

import com.tkvault.model.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatRepository extends JpaRepository<Chat, Long> {
    List<Chat> findAllByOrderByCreatedAtAsc();
    List<Chat> findBySessionIdOrderByCreatedAtAsc(String sessionId);
}
