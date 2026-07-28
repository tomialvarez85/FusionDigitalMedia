"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import Skeleton from "@/components/skeleton";

export default function PhotoThumbnail({
  alt,
  className = "",
  onLoad,
  protectImage = false,
  ...imgProps
}: ImgHTMLAttributes<HTMLImageElement> & { protectImage?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Si la imagen ya terminó de cargar (caché del navegador, o gana la
    // carrera contra la hidratación de React) el evento "load" nativo
    // puede haber disparado antes de que el handler de abajo se conecte.
    // Sin este chequeo, el skeleton queda pegado para siempre en ese caso.
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        {...imgProps}
        alt={alt}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
      {protectImage && (
        <div
          className="absolute inset-0"
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}
