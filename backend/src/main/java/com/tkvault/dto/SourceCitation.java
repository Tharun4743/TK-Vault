package com.tkvault.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SourceCitation {
    private String docId;
    private String docName;
    private Integer pageNumber;
    private String excerpt;
    private double score;
}
