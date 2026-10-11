"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ProductGallery({
  images,
  title,
}: {
  images: { url: string; alt: string }[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[3/4] w-full place-items-center rounded-card bg-cotton-200 text-cotton-500">
        <span className="text-sm">No image available</span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)]!;

  // Arrow keys move between thumbnails, which is how a keyboard user expects a
  // gallery to behave.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => (i + 1) % images.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => (i - 1 + images.length) % images.length);
    }
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label={`${title} images`}
          onKeyDown={onKeyDown}
          className="flex gap-2.5 overflow-x-auto sm:flex-col sm:overflow-visible"
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              role="tab"
              type="button"
              aria-selected={index === active}
              aria-label={`View image ${index + 1} of ${images.length}`}
              onClick={() => setActive(index)}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg ring-1 transition sm:w-20",
                index === active
                  ? "ring-2 ring-indigo-ink-700"
                  : "ring-cotton-300 hover:ring-indigo-ink-400",
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex-1">
        <button
          type="button"
          onClick={() => setZoomed((v) => !v)}
          aria-label={zoomed ? "Zoom out" : "Zoom in"}
          className="relative block aspect-[3/4] w-full overflow-hidden rounded-card bg-cotton-100 ring-1 ring-cotton-300"
        >
          <Image
            src={current.url}
            alt={current.alt || title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className={cn(
              "object-cover transition-transform duration-300",
              zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in",
            )}
          />
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          {zoomed ? "Tap the image to zoom out" : "Tap the image to zoom in"}
        </p>
      </div>
    </div>
  );
}
