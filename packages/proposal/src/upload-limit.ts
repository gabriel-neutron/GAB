// Origin of the number: a bought filing is a PDF of some megabytes, and a scan of many pages
// reaches some tens of them. The whole file is held in memory twice, as text and as bytes, so
// the cap keeps one request well under the heap of the writer.
export const UPLOAD_FILE_BYTES = 20 * 1024 * 1024;

// External constraint: base64 writes three bytes as four characters. The rest of the body is a
// title, an address and a few short fields, and 64 KiB holds them with room.
export const LARGEST_UPLOAD_BODY = Math.ceil((UPLOAD_FILE_BYTES * 4) / 3) + 64 * 1024;
