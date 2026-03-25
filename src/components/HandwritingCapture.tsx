"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

interface Props {
  onImageReady: (base64Image: string) => void;
}

export function HandwritingCapture({ onImageReady }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    // Resize image using Canvas to save bandwidth and API latency
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Define max sizing ~ 800px width/height for Gemini Vision
        const MAX_DIMENSION = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 80%
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        
        setIsProcessing(false);
        onImageReady(base64.split(",")[1]); // Return base64 without prefix
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-3 px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 font-bold"
      >
        <Camera size={28} />
        {isProcessing ? "Procesando..." : "Tomar Foto al Cuaderno"}
      </button>
      <p className="text-gray-500 text-sm">Asegúrate de que haya buena luz</p>
    </div>
  );
}
