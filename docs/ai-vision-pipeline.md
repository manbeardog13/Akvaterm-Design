# AI Vision Pipeline for Bathroom Reconstruction

## Pipeline stages

1. Ingest
   - accept wall-by-wall photos with capture metadata
2. Preprocess
   - normalize perspective and exposure
3. Detection
   - multi-model object detection for fixtures and structural points
4. Confidence split
   - classify detections by confidence bucket
5. User verification
   - user confirms, rejects, or adjusts every detected item
6. Reconstruction
   - produce a progressive digital twin approximation
7. Correction loop
   - user edits are propagated back into the inferred model

## Privacy and consent

- Explicit consent before upload
- User control to delete captures anytime
- No non-consented analytics on pixel-level data

## Safety constraints

- No full-automation acceptance
- No object inferred without visible confirmation
- Confidence threshold below which no product recommendations are attached
