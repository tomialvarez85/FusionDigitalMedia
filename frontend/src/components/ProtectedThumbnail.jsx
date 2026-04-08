import { useEffect, useRef, useState } from "react";
import { API } from "@/App";

/**
 * ProtectedThumbnail - Renders thumbnail images on canvas with watermark
 * Used for event cards in the gallery grid
 * - Images loaded via backend proxy
 * - Light watermark for thumbnails
 * - Right-click and drag disabled
 */
const ProtectedThumbnail = ({ 
  photoId,
  className = ""
}) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photoId) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Fixed thumbnail size
      const targetWidth = 400;
      const targetHeight = 300;
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Calculate crop to fill
      const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;
      const offsetX = (targetWidth - scaledWidth) / 2;
      const offsetY = (targetHeight - scaledHeight) / 2;

      // Draw image (cover fit)
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      // Draw light watermark for thumbnails
      drawWatermark(ctx, targetWidth, targetHeight);

      setLoaded(true);
    };

    img.onerror = () => {
      setError(true);
      setLoaded(true);
    };

    img.src = `${API}/photos/${photoId}/view`;
  }, [photoId]);

  const drawWatermark = (ctx, width, height) => {
    ctx.save();
    
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-30 * Math.PI / 180);
    
    const fontSize = Math.max(width / 12, 16);
    ctx.font = `bold ${fontSize}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgba(200, 169, 126, 0.2)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText('FUSION DIGITAL MEDIA', 0, 0);
    
    ctx.restore();
  };

  const preventAction = (e) => {
    e.preventDefault();
    return false;
  };

  if (error) {
    return (
      <div className={`bg-[#1a1a1a] flex items-center justify-center ${className}`}>
        <span className="text-[#A3A3A3] text-xs">No preview</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onContextMenu={preventAction}
      onDragStart={preventAction}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
          <div className="spinner" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          transition: 'opacity 0.3s ease',
          userSelect: 'none'
        }}
        onContextMenu={preventAction}
        onDragStart={preventAction}
        draggable={false}
      />
    </div>
  );
};

export default ProtectedThumbnail;
