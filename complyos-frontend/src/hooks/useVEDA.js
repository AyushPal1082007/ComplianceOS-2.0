import { useState } from "react";
import { uploadDocument } from "../services/api";

export function useVEDA() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const processDocument = async (file) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadDocument(file);
      setResult(data);
      return data;
    } catch (e) {
      setError("Failed to process document. Please try again.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const clearResult = () => setResult(null);

  return { uploading, result, error, processDocument, clearResult };
}
