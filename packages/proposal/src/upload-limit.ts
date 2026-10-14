// Origin of the number: a bought filing is a PDF of some megabytes, and a scan of many pages
// reaches some tens of them. The door holds a file as about five times its size (see the note on
// the bulk cap), some 100 MB at this cap, so the cap keeps one request well under the heap of the
// writer.
export const UPLOAD_FILE_BYTES = 20 * 1024 * 1024;

// Origin of the number: decided, not calibrated. A published bulk dataset (a GEM workbook, a GEM
// route archive, a World Bank flare workbook) is some tens to some hundreds of megabytes. The
// real limit is the heap of the writer. The body arrives as bytes (some 342 MB of base64 at the
// cap) and the writer holds it as text (342 MB). JSON.parse copies the base64 field (342 MB), and
// the decoded file is 256 MB. So the peak of one bulk upload is at most about 1.3 GB, about five
// times the file, when no copy is freed. A check on a file of 100 MB measured an extra peak of
// about four times the file, because the collector frees the first copies. The text step reads
// such a file as a stream, but the door still holds the bytes once.
// shortcut: the writer holds the whole body in memory, upgrade to a streamed upload when a
// dataset passes this cap.
export const BULK_FILE_BYTES = 256 * 1024 * 1024;

// The files that a published dataset comes in: a workbook and a zip archive of GeoJSON layers.
const BULK_EXTENSIONS = ['.xlsx', '.zip'] as const;

/** The most bytes that the door takes for a file of this name. A bulk dataset gets the higher
 * limit, and every other file gets the usual one. */
export const fileLimitOf = (fileName: string): number =>
  BULK_EXTENSIONS.some((extension) => fileName.trim().toLowerCase().endsWith(extension))
    ? BULK_FILE_BYTES
    : UPLOAD_FILE_BYTES;

// External constraint: base64 writes three bytes as four characters. The rest of the body is a
// title, an address and a few short fields, and 64 KiB holds them with room.
export const LARGEST_UPLOAD_BODY = Math.ceil((BULK_FILE_BYTES * 4) / 3) + 64 * 1024;
