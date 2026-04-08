import { useEffect, useRef, useState } from "react";
import { API } from "@/App";

/**
 * ProtectedPhoto - Secure image rendering via backend proxy + canvas
 * 
 * Security features:
 * - Images loaded via backend proxy (no direct URLs exposed)
 * - Rendered on HTML Canvas (not <img> tags)
 * - Diagonal watermark: "LUX STUDIO" at -30°, 25% opacity, gold color
 * - Bottom 50% blur effect (20px)
 * - Footer copyright text
 * - Right-click, drag, and keyboard shortcuts disabled
 */
const ProtectedPhoto = ({ 
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
      let displayWidth = Math.min(img.naturalWidth, 800);
      let displayHeight = displayWidth / aspectRatio;

      // Set canvas size
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // Draw the original image
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Apply bottom 50% blur effect
      applyBottomBlur(ctx, displayWidth, displayHeight);

      // Draw diagonal watermark
      drawWatermark(ctx, displayWidth, displayHeight);

      // Draw footer copyright
      drawFooterCopyright(ctx, displayWidth, displayHeight);

      setLoaded(true);
    };

    img.onerror = () => {
      console.error("Failed to load image via proxy");
      setError(true);
      setLoaded(true);
    };

    // Load image via backend proxy - NO direct URL exposed
    img.src = `${API}/photos/${photoId}/view`;
  }, [photoId]);

  // Disable keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Disable Ctrl+S, Ctrl+U, Ctrl+Shift+I
      if (
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I')
      ) {
        e.preventDefault();
        return false;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

  const applyBottomBlur = (ctx, width, height) => {
    // Get the bottom 50% of the image
    const startY = Math.floor(height * 0.5);
    const blurHeight = height - startY;
    
    // Create a temporary canvas for blur effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = blurHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Copy bottom section
    const imageData = ctx.getImageData(0, startY, width, blurHeight);
    tempCtx.putImageData(imageData, 0, 0);
    
    // Apply multiple blur passes for 20px equivalent blur
    const passes = 8;
    const baseRadius = 3;
    
    for (let pass = 0; pass < passes; pass++) {
      const currentImageData = tempCtx.getImageData(0, 0, width, blurHeight);
      const data = currentImageData.data;
      const blurredData = new Uint8ClampedArray(data);
      
      const radius = baseRadius;
      
      for (let py = 0; py < blurHeight; py++) {
        // Increase blur intensity towards bottom
        const blurIntensity = (py / blurHeight);
        const effectiveRadius = Math.floor(radius * blurIntensity * 2) + 1;
        
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
    
    // Draw blurred section back with gradient fade
    ctx.save();
    
    // Create gradient mask for smooth transition
    const gradient = ctx.createLinearGradient(0, startY, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.3, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    
    // Draw the blurred image
    ctx.drawImage(tempCanvas, 0, startY);
    
    ctx.restore();
  };

  const drawWatermark = (ctx, width, height) => {
    ctx.save();
    
    // Move to center
    ctx.translate(width / 2, height / 2);
    
    // Rotate -30 degrees
    ctx.rotate(-30 * Math.PI / 180);
    
    // Configure watermark style - gold color, 25% opacity
    const fontSize = Math.max(width / 10, 30);
    ctx.font = `bold ${fontSize}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgba(200, 169, 126, 0.25)'; // Gold color (#C8A97E) with 25% opacity
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw main watermark
    ctx.fillText('FUSION DIGITAL MEDIA', 0, 0);
    
    // Draw additional watermarks for coverage
    const spacing = fontSize * 3;
    ctx.fillText('FUSION DIGITAL MEDIA', -spacing * 1.5, -spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', spacing * 1.5, spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', -spacing * 1.5, spacing);
    ctx.fillText('FUSION DIGITAL MEDIA', spacing * 1.5, -spacing);
    
    ctx.restore();
  };

  const drawFooterCopyright = (ctx, width, height) => {
    ctx.save();
    
    // Footer copyright text at bottom-left
    const fontSize = Math.max(width / 40, 12);
    ctx.font = `${fontSize}px "Outfit", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    // Add subtle shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillText('© fusiondigitalmedia.com', 10, height - 10);
    
    ctx.restore();
  };

  // Event handlers for protection
  const preventAction = (e) => {
    e.preventDefault();
    return false;
  };

  if (error) {
    return (
      <div className={`bg-[#141414] flex items-center justify-center ${className}`} style={{ minHeight: 200 }}>
        <span className="text-[#A3A3A3] text-sm">Failed to load image</span>
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
      onMouseDown={(e) => e.button === 2 && preventAction(e)}
      tabIndex={-1}
      data-testid={`protected-photo-${photoId}`}
    >
      {!loaded && (
        <div 
          className="absolute inset-0 bg-[#141414] flex items-center justify-center"
          style={{ minHeight: 200 }}
        >
          <div className="spinner" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`protected-canvas block max-w-full h-auto ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          transition: 'opacity 0.3s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          pointerEvents: 'auto'
        }}
        onContextMenu={preventAction}
        onDragStart={preventAction}
        draggable={false}
      />
    </div>
  );
};

export default ProtectedPhoto;
