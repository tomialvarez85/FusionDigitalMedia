import { useEffect, useRef, useState } from "react";
import { API } from "@/App";

/**
 * LightboxPhoto - Full-size protected photo for lightbox view
 * 
 * Features:
 * - Stronger watermark (40% opacity)
 * - "LUX STUDIO" watermark at -30°
 * - Bottom blur effect
 * - Copyright footer
 * - All protection features enabled
 */
const LightboxPhoto = ({ 
  photoId,
  width, 
  height,
  className = ""
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photoId) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Calculate display size maintaining aspect ratio
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const maxWidth = Math.min(img.naturalWidth, 1200);
      const maxHeight = window.innerHeight * 0.75;
      
      let displayWidth = maxWidth;
      let displayHeight = displayWidth / aspectRatio;
      
      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
      }

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // Draw the original image
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Apply bottom blur effect
      applyBottomBlur(ctx, displayWidth, displayHeight);

      // Draw STRONGER watermark (40% opacity)
      drawStrongWatermark(ctx, displayWidth, displayHeight);

      // Draw footer copyright
      drawFooterCopyright(ctx, displayWidth, displayHeight);

      setLoaded(true);
    };

    img.onerror = () => {
      setError(true);
      setLoaded(true);
    };

    img.src = `${API}/photos/${photoId}/view`;
  }, [photoId]);

  const applyBottomBlur = (ctx, width, height) => {
    const startY = Math.floor(height * 0.5);
    const blurHeight = height - startY;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = blurHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    const imageData = ctx.getImageData(0, startY, width, blurHeight);
    tempCtx.putImageData(imageData, 0, 0);
    
    const passes = 8;
    const baseRadius = 3;
    
    for (let pass = 0; pass < passes; pass++) {
      const currentImageData = tempCtx.getImageData(0, 0, width, blurHeight);
      const data = currentImageData.data;
      const blurredData = new Uint8ClampedArray(data);
      
      for (let py = 0; py < blurHeight; py++) {
        const blurIntensity = (py / blurHeight);
        const effectiveRadius = Math.floor(baseRadius * blurIntensity * 2.5) + 1;
        
        for (let px = 0; px < width; px++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          
          for (let dy = -effectiveRadius; dy <= effectiveRadius; dy++) {
            for (let dx = -effectiveRadius; dx <= effectiveRadius; dx++) {
              const nx = px + dx;
              const ny = py + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < blurHeight) {
                const idx = (ny * width + nx) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                a += data[idx + 3];
                count++;
              }
            }
          }
          
          const idx = (py * width + px) * 4;
          blurredData[idx] = r / count;
          blurredData[idx + 1] = g / count;
          blurredData[idx + 2] = b / count;
          blurredData[idx + 3] = a / count;
        }
      }
      
      tempCtx.putImageData(new ImageData(blurredData, width, blurHeight), 0, 0);
    }
    
    ctx.drawImage(tempCanvas, 0, startY);
  };

  const drawStrongWatermark = (ctx, width, height) => {
    ctx.save();
    
    // Move to center
    ctx.translate(width / 2, height / 2);
    
    // Rotate -30 degrees
    ctx.rotate(-30 * Math.PI / 180);
    
    // STRONGER watermark - 40% opacity (gold color)
    const fontSize = Math.max(width / 8, 40);
    ctx.font = `bold ${fontSize}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgba(200, 169, 126, 0.40)'; // 40% opacity
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw main watermark
    ctx.fillText('FUSION DIGITAL MEDIA', 0, 0);
    
    // Draw additional watermarks for better coverage
    const spacing = fontSize * 2.5;
    ctx.fillStyle = 'rgba(200, 169, 126, 0.25)'; // Slightly lighter for secondary
    ctx.fillText('FUSION DIGITAL MEDIA', -spacing * 1.2, -spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', spacing * 1.2, spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', -spacing * 1.2, spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', spacing * 1.2, -spacing);
    
    ctx.restore();
  };

  const drawFooterCopyright = (ctx, width, height) => {
    ctx.save();
    
    const fontSize = Math.max(width / 50, 12);
    ctx.font = `${fontSize}px "Outfit", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillText('© fusiondigitalmedia.com', 12, height - 12);
    
    ctx.restore();
  };

  const preventAction = (e) => {
    e.preventDefault();
    return false;
  };

  if (error) {
    return (
      <div className={`bg-[#141414] flex items-center justify-center min-h-[300px] ${className}`}>
        <span className="text-[#A3A3A3]">Failed to load image</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`canvas-container relative select-none ${className}`}
      onContextMenu={preventAction}
      onDragStart={preventAction}
      onDrag={preventAction}
      onDragEnd={preventAction}
      tabIndex={-1}
    >
      {!loaded && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="spinner" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`block max-w-full h-auto mx-auto ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          transition: 'opacity 0.3s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          maxHeight: '75vh'
        }}
        onContextMenu={preventAction}
        onDragStart={preventAction}
        draggable={false}
      />
    </div>
  );
};

export default LightboxPhoto;
