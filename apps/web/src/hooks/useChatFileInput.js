import { useCallback, useRef } from "react";
import {
  FILE_TOO_LARGE_MESSAGE,
  MAX_FILE_SIZE,
  PDF_EXTENSION,
  PDF_MIME_TYPE,
  PDF_NOT_SUPPORTED_MESSAGE,
  TEXT_FILE_EXTENSIONS,
  UNSUPPORTED_FILE_MESSAGE,
} from "@/constants/fileUpload";

export default function useChatFileInput({
  setSelectedFile,
  setUploadError,
}) {
  const fileInputRef = useRef(null);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadError("");
    resetFileInput();
  }, [resetFileInput, setSelectedFile, setUploadError]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      setUploadError("");
      resetFileInput();
      return;
    }

    const fileName = file.name || "";
    const lowerFileName = fileName.toLowerCase();

    const isTextFile = TEXT_FILE_EXTENSIONS.some((extension) =>
      lowerFileName.endsWith(extension)
    );

    const isPdfFile =
      file.type === PDF_MIME_TYPE ||
      lowerFileName.endsWith(PDF_EXTENSION);

    if (isPdfFile) {
      setSelectedFile(null);
      setUploadError(PDF_NOT_SUPPORTED_MESSAGE);
      resetFileInput();
      return;
    }

    if (!isTextFile && !isPdfFile) {
      setSelectedFile(null);
      setUploadError(UNSUPPORTED_FILE_MESSAGE);
      resetFileInput();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setUploadError(FILE_TOO_LARGE_MESSAGE);
      resetFileInput();
      return;
    }

    setUploadError("");
    setSelectedFile(file);
  }, [resetFileInput, setSelectedFile, setUploadError]);

  return {
    fileInputRef,
    resetFileInput,
    handleClearFile,
    handleFileChange,
  };
}