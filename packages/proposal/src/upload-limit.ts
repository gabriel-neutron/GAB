// Origin of the number: a bought filing is a PDF of some megabytes, and a scan of many pages
// reaches some tens of them. The whole file is held in memory twice, as text and as bytes, so
// the cap keeps one request well under the heap of the writer.
export const UPLOAD_FILE_BYTES = 20 * 1024 * 1024;

// Origin of the number: decided, not calibrated. A published bulk dataset (a GEM workbook, a GEM
// route archive, a World Bank flare workbook) is some tens to some hundreds of megabytes. 256 MiB
// is the most whose base64 text (some 342 million characters) a JavaScript string still holds.
// The cap is for the stored bytes only: the text step reads such a file as a stream.
// shortcut: the writer still holds the base64 body of an upload in memory, upgrade to a streamed
// upload when a dataset passes this cap.
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
