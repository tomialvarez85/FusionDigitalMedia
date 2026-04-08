import { useEffect, useRef, useState } from "react";

/**
 * ProtectedPhoto - Renders images on canvas with watermark and blur protection
 * - Diagonal watermark text overlay
 * - Progressive blur on bottom 50%
 * - Right-click and drag disabled
 * - No raw image URL exposed in DOM
 */
const ProtectedPhoto = ({ 
  src, 
  width, 
  height, 
  watermarkText = "Lux Studio",
  className = ""
}) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Calculate display size maintaining aspect ratio
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let displayWidth = Math.min(img.naturalWidth, 800);
      let displayHeight = displayWidth / aspectRatio;

      // Set canvas size
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      setDisplaySize({ width: displayWidth, height: displayHeight });

      // Draw image
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Apply progressive blur to bottom 50%
      applyProgressiveBlur(ctx, displayWidth, displayHeight);

      // Draw watermark
      drawWatermark(ctx, displayWidth, displayHeight, watermarkText);

      setLoaded(true);
    };

    img.onerror = () => {
      console.error("Failed to load image");
      setLoaded(true);
    };

    img.src = src;
  }, [src, watermarkText]);

  const applyProgressiveBlur = (ctx, width, height) => {
    // Get the bottom 50% of the image
    const startY = Math.floor(height * 0.5);
    const blurHeight = height - startY;
    
    // Apply multiple blur passes with increasing intensity
    const passes = 5;
    for (let i = 0; i < passes; i++) {
      const y = startY + (blurHeight / passes) * i;
      const h = blurHeight / passes;
      
      // Get image data for this section
      const imageData = ctx.getImageData(0, y, width, h);
      const data = imageData.data;
      
      // Apply box blur with increasing radius
      const radius = Math.min(3 + i * 2, 10);
      
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < width; px++) {
          let r = 0, g = 0, b = 0, count = 0;
          
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = px + dx;
              const ny = py + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < h) {
                const idx = (ny * width + nx) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
          }
          
          const idx = (py * width + px) * 4;
          data[idx] = r / count;
          data[idx + 1] = g / count;
          data[idx + 2] = b / count;
        }
      }
      
      ctx.putImageData(imageData, 0, y);
    }
  };

  const drawWatermark = (ctx, width, height, text) => {
    ctx.save();
    
    // Configure watermark style
    const fontSize = Math.max(width / 15, 20);
    ctx.font = `${fontSize}px "Cormorant Garamond", serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate diagonal angle
    const angle = -Math.atan(height / width);
    
    // Draw multiple watermarks across the image
    const spacing = fontSize * 4;
    const diagonal = Math.sqrt(width * width + height * height);
    
    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);
    
    for (let y = -diagonal / 2; y < diagonal / 2; y += spacing) {
      for (let x = -diagonal / 2; x < diagonal / 2; x += spacing * 2) {
        ctx.fillText(text, x, y);
      }
    }
    
    ctx.restore();
  };

  return (
    <div 
      className={`canvas-container relative ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {!loaded && (
        <div 
          className="absolute inset-0 bg-[#141414] flex items-center justify-center"
          style={{ 
            width: displaySize.width || 'auto', 
            height: displaySize.height || 200 
          }}
        >
          <div className="spinner" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`protected-canvas block max-w-full h-auto ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ transition: 'opacity 0.3s ease' }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default ProtectedPhoto;
