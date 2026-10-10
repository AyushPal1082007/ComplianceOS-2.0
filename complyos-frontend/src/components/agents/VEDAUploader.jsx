import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Loader, CheckCircle, Eye } from "lucide-react";
import { useVEDA } from "../../hooks/useVEDA";

export function VEDAUploader({ onComplete }) {
  const { uploading, result, error, processDocument, clearResult } = useVEDA();
  const inputRef = useRef(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await processDocument(file);
    if (data) {
      onComplete?.(data);
    }
  };

  const extracted = result?.extracted || {};
  
  return (
    <div>
      <motion.div
        whileHover={{ scale: 1.01 }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          uploading ? "border-cs-300 bg-cs-50" : "border-cs-200 hover:border-cs-400 bg-white"
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader size={28} className="text-cs-500 animate-spin" />
            <p className="text-cs-600 font-semibold text-sm">VEDA is analyzing your document...</p>
            <p className="text-cs-400 text-xs">Extracting deadlines, numbers, and key data</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={28} className="text-green-500" />
            <p className="text-cs-900 font-bold text-sm">Analysis Complete!</p>
            
            {/* Quick extracted data badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {extracted.gstin && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono font-semibold">
                  GSTIN: {extracted.gstin}
                </span>
              )}
              {extracted.pan && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono font-semibold">
                  PAN: {extracted.pan}
                </span>
              )}
              {extracted.udyamNumber && (
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-mono font-semibold">
                  Udyam: {extracted.udyamNumber}
                </span>
              )}
              {extracted.businessName && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                  {extracted.businessName}
                </span>
              )}
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-cs-100 hover:bg-cs-200 text-cs-700 rounded-lg text-xs font-medium"
            >
              <Eye size={14} />
              {showDetails ? "Hide Details" : "View Extracted Data"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload size={28} className="text-cs-400" />
            <p className="text-cs-700 font-semibold text-sm">Upload GST cert, PAN card, invoice, or any compliance doc</p>
            <p className="text-cs-400 text-xs">PDF, JPG, PNG supported • VEDA reads even handwritten documents</p>
          </div>
        )}
      </motion.div>
      
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      
      {/* Expandable extracted data section */}
      {showDetails && result && extracted && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 bg-white border border-cs-200 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-cs-900 font-semibold text-sm flex items-center gap-2">
              <FileText size={16} className="text-cs-600" />
              Extracted Data (Internal View)
            </h4>
            <button onClick={() => setShowDetails(false)} className="text-cs-400 hover:text-cs-600 text-xs">Close</button>
          </div>
          
          {extracted.text && (
            <div className="mb-3">
              <p className="text-cs-400 text-xs mb-1">OCR Text:</p>
              <div className="bg-cs-50 p-2 rounded text-xs font-mono text-cs-800 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {extracted.text.substring(0, 500)}...
              </div>
            </div>
          )}
          
          {extracted.documentType && (
            <div className="mb-2">
              <span className="text-cs-400 text-xs">Document Type: </span>
              <span className="text-cs-700 font-medium text-xs">{extracted.documentType}</span>
            </div>
          )}
          
          {extracted.confidence && (
            <div className="mt-2 pt-2 border-t border-cs-100">
              <span className="text-cs-400 text-xs">OCR Confidence: </span>
              <span className="text-green-600 font-medium text-xs">{Math.round(extracted.confidence * 100)}%</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default VEDAUploader;
