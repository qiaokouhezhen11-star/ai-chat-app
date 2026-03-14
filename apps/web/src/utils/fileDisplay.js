export function formatFileSize(size) {
    if (size < 1024) {
      return `${size} B`;
    }
  
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
  
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  export function getFileBadgeClassName(fileName = "") {
    const extension = fileName.split(".").pop()?.toLowerCase();
  
    if (extension === "md") {
      return "bg-[#1E3A5F] text-[#9AD1FF]";
    }
  
    if (extension === "txt") {
      return "bg-[#3A3A2A] text-[#F5E6A8]";
    }
  
    return "bg-[#262630] text-[#B4B4B8]";
  }