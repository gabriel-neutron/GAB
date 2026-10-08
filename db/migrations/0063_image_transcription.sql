-- =============================================================================================
-- 0063 — a citation of an image can hold the words that the AI read from the image    ORDERED
--
-- AN IMAGE STATES ITS FACTS IN ITS DRAWING. A unit tree of Tochnyi draws a line from each parent
-- to each child, and the OCR text of the image mixes the columns and misreads the numbers. So a
-- fact that the image states clearly has no span in the stored text, and the door refused it.
--
-- A CITATION IS ONE OF TWO SHAPES. A span: start and end in the stored page, and no transcription.
-- A transcription: the words that the research AI read from the image, and no span. The page and
-- its text extractor stay, so the citation still names a stored page of the document. The door
-- accepts a transcription only for a PNG or JPEG document, and only for an act that it marks as
-- disputed: the operator compares the words with the image before a promotion (P5).
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The two checks of the span move into the one check of the two shapes, which states its NULL.
ALTER TABLE citation
  DROP CONSTRAINT citation_start_check,
  DROP CONSTRAINT citation_span_order,
  ALTER COLUMN start DROP NOT NULL,
  ALTER COLUMN "end" DROP NOT NULL,
  ADD COLUMN transcription text,
  ADD CONSTRAINT citation_span_or_transcription CHECK (
    (start IS NOT NULL AND "end" IS NOT NULL AND start >= 0 AND start < "end"
     AND transcription IS NULL)
    OR (start IS NULL AND "end" IS NULL AND transcription IS NOT NULL
        AND btrim(transcription, E' \t\n\r\f\v') <> '' AND char_length(transcription) <= 600));

RESET ROLE;
