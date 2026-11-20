package com.aura.repository;

import com.aura.model.VectorChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VectorChunkRepository extends JpaRepository<VectorChunk, String> {

    List<VectorChunk> findByCollectionName(String collectionName);

    @Modifying
    @Query("DELETE FROM VectorChunk v WHERE v.docId = :docId")
    void deleteByDocId(@Param("docId") String docId);

    @Modifying
    @Query("DELETE FROM VectorChunk v WHERE v.collectionName = :collectionName")
    void deleteByCollectionName(@Param("collectionName") String collectionName);
}
