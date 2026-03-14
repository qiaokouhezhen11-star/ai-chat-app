export const PDF_NOT_SUPPORTED_MESSAGE =
  "PDFはまだ未対応です。現在は txt / md ファイルのみ対応しています。";

export const UNSUPPORTED_FILE_MESSAGE =
  "未対応のファイル形式です。現在は txt / md ファイルのみ対応しています。";

export const FILE_TOO_LARGE_MESSAGE =
  "ファイルサイズが大きすぎます。2MB以下のファイルを選んでください。";

export const TEXT_FILE_EXTENSIONS = [".txt", ".md"];
export const PDF_EXTENSION = ".pdf";
export const PDF_MIME_TYPE = "application/pdf";
export const ACCEPTED_FILE_TYPES = [...TEXT_FILE_EXTENSIONS, PDF_EXTENSION].join(
  ","
);
export const MAX_FILE_SIZE = 2 * 1024 * 1024;