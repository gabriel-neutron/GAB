# Audio and video

Gabriel does not ingest, transcribe, or analyse audio or video. Only text and structured
data enter the corpus.

## Why this is out of scope

Same boundary as OCR, for the same reason: transcription and video analysis are
recognition problems, not investigation problems. If a recording matters to a case, it is
transcribed outside the tool and the transcript is ingested as a document like any other —
with its own source record and its own rating.

Supporting media natively would pull in storage, codecs, timeline models, and a
per-timestamp citation model that the schema does not have. Attribute sources cite a
document, not an offset within a stream. Making a claim traceable to "this frame" or "this
second" is a different data model, not an extension of this one.

The volumes here are small — 1 to 10k entities, 100 to 1k documents, one analyst. Nothing
about that scale justifies carrying a media pipeline.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
