package com.aura.retrieval;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.Serializable;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.regex.Pattern;

/**
 * 100% Native Java BM25 (Okapi BM25) Probabilistic Retrieval Engine.
 * Built from scratch with zero external dependencies and zero pretrained models.
 * Calculates exact term frequencies, inverse document frequencies, and document length normalization.
 */
@Service
public class BM25Engine {

    private static final Logger log = LoggerFactory.getLogger(BM25Engine.class);
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[^a-zA-Z0-9]+");

    // Standard Okapi BM25 Hyperparameters
    private double k1 = 1.5;
    private double b = 0.75;

    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    public static class IndexedChunk implements Serializable {
        public String chunkId;
        public String docId;
        public String docName;
        public int pageNumber;
        public String text;
        public Map<String, Integer> termFreqs;
        public int length;

        public IndexedChunk(String chunkId, String docId, String docName, int pageNumber, String text, Map<String, Integer> termFreqs, int length) {
            this.chunkId = chunkId;
            this.docId = docId;
            this.docName = docName;
            this.pageNumber = pageNumber;
            this.text = text;
            this.termFreqs = termFreqs;
            this.length = length;
        }
    }

    public static class ScoredResult {
        public IndexedChunk chunk;
        public double score;

        public ScoredResult(IndexedChunk chunk, double score) {
            this.chunk = chunk;
            this.score = score;
        }
    }

    // In-memory inverted index: term -> list of chunk IDs
    private final Map<String, List<String>> invertedIndex = new ConcurrentHashMap<>();
    // Chunk storage: chunk ID -> IndexedChunk
    private final Map<String, IndexedChunk> chunksMap = new ConcurrentHashMap<>();
    private double avgDocLength = 0.0;
    private long totalTokenCount = 0;

    /**
     * Tokenizes raw text into normalized lower-case word tokens.
     */
    public List<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        String[] parts = TOKEN_PATTERN.split(text.toLowerCase());
        List<String> tokens = new ArrayList<>(parts.length);
        for (String p : parts) {
            if (p.length() > 1) { // Skip single-letter noise
                tokens.add(p);
            }
        }
        return tokens;
    }

    /**
     * Indexes a document chunk into the in-memory BM25 inverted index.
     */
    public void indexChunk(String chunkId, String docId, String docName, int pageNumber, String text) {
        rwLock.writeLock().lock();
        try {
            List<String> tokens = tokenize(text);
            Map<String, Integer> freqs = new HashMap<>();
            for (String t : tokens) {
                freqs.put(t, freqs.getOrDefault(t, 0) + 1);
            }

            IndexedChunk chunk = new IndexedChunk(chunkId, docId, docName, pageNumber, text, freqs, tokens.size());
            chunksMap.put(chunkId, chunk);

            for (String term : freqs.keySet()) {
                invertedIndex.computeIfAbsent(term, k -> new ArrayList<>()).add(chunkId);
            }

            totalTokenCount += tokens.size();
            avgDocLength = chunksMap.isEmpty() ? 0.0 : (double) totalTokenCount / chunksMap.size();
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Executes Okapi BM25 scoring across all indexed chunks for a query.
     */
    public List<ScoredResult> search(String query, int topK, String targetDocId) {
        rwLock.readLock().lock();
        try {
            List<String> queryTokens = tokenize(query);
            if (queryTokens.isEmpty() || chunksMap.isEmpty()) {
                return Collections.emptyList();
            }

            int N = chunksMap.size();
            Map<String, Double> scores = new HashMap<>();

            for (String term : queryTokens) {
                List<String> postingList = invertedIndex.get(term);
                if (postingList == null || postingList.isEmpty()) continue;

                int df = postingList.size();
                // Standard smoothed BM25 IDF
                double idf = Math.log(1.0 + (N - df + 0.5) / (df + 0.5));

                for (String chunkId : postingList) {
                    IndexedChunk chunk = chunksMap.get(chunkId);
                    if (chunk == null) continue;
                    if (targetDocId != null && !targetDocId.isBlank() && !targetDocId.equals(chunk.docId)) {
                        continue; // Filter by document collection if specified
                    }

                    int tf = chunk.termFreqs.getOrDefault(term, 0);
                    double lenNorm = 1.0 - b + b * (chunk.length / Math.max(1.0, avgDocLength));
                    double termScore = idf * (tf * (k1 + 1.0)) / (tf + k1 * lenNorm);

                    scores.put(chunkId, scores.getOrDefault(chunkId, 0.0) + termScore);
                }
            }

            List<ScoredResult> results = new ArrayList<>();
            for (Map.Entry<String, Double> entry : scores.entrySet()) {
                IndexedChunk chunk = chunksMap.get(entry.getKey());
                if (chunk != null) {
                    results.add(new ScoredResult(chunk, entry.getValue()));
                }
            }

            results.sort((a, b) -> Double.compare(b.score, a.score));

            if (results.size() > topK) {
                return results.subList(0, topK);
            }
            return results;
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public void removeDocument(String docId) {
        rwLock.writeLock().lock();
        try {
            List<String> toRemove = new ArrayList<>();
            for (Map.Entry<String, IndexedChunk> e : chunksMap.entrySet()) {
                if (e.getValue().docId.equals(docId)) {
                    toRemove.add(e.getKey());
                    totalTokenCount -= e.getValue().length;
                }
            }
            for (String id : toRemove) {
                chunksMap.remove(id);
            }
            for (List<String> list : invertedIndex.values()) {
                list.removeAll(toRemove);
            }
            avgDocLength = chunksMap.isEmpty() ? 0.0 : (double) totalTokenCount / chunksMap.size();
            log.info("[BM25] Evicted document {} ({} chunks). Total remaining: {}", docId, toRemove.size(), chunksMap.size());
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    public int getTotalChunks() {
        return chunksMap.size();
    }

    public void setK1(double k1) { this.k1 = k1; }
    public void setB(double b) { this.b = b; }
    public double getK1() { return k1; }
    public double getB() { return b; }
}
