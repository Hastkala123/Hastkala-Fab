"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { apiUpload } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export type UploadedImage = { url: string; alt: string };

const MAX_IMAGES = 15;
const MAX_MB = 5;

/**
 * Multi-image uploader with drag-and-drop and reordering.
 *
 * Client-side type and size checks are a courtesy to the admin, not a security
 * control — the server re-validates every byte by magic number in lib/upload.ts
 * and ignores whatever the browser claims about the file.
 */
export default function ImageUploader({
  images,
  onChange,
  label = "Product images",
  folder = "products",
  max = MAX_IMAGES,
}: {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  label?: string;
  folder?: "products" | "categories" | "banners" | "content";
  max?: number;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    if (images.length + list.length > max) {
      toast(`You can add at most ${max} image${max === 1 ? "" : "s"}.`, "error");
      return;
    }

    const tooBig = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      toast(`"${tooBig.name}" is larger than ${MAX_MB} MB.`, "error");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("folder", folder);
    for (const file of list) formData.append("files", file);

    const result = await apiUpload<{
      uploaded: { url: string }[];
      errors: string[];
    }>("/api/admin/upload", formData);

    setUploading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    if (result.data.errors.length > 0) {
      toast(result.data.errors[0]!, "error");
    }

    onChange([
      ...images,
      ...result.data.uploaded.map((u) => ({ url: u.url, alt: "" })),
    ]);

    if (result.data.uploaded.length > 0) {
      toast(
        `${result.data.uploaded.length} image${result.data.uploaded.length === 1 ? "" : "s"} uploaded`,
        "success",
      );
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="hf-label">{label}</span>
        <span className="text-xs text-slate-400">
          {images.length}/{max}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-card border-2 border-dashed p-5 text-center transition",
          dragOver
            ? "border-indigo-ink-600 bg-indigo-ink-50"
            : "border-cotton-400 bg-cotton-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          onChange={(e) => e.target.files && void upload(e.target.files)}
          className="sr-only"
          id="image-upload-input"
          disabled={uploading || images.length >= max}
        />

        <p className="text-sm text-slate-600">
          Drag images here, or{" "}
          <label
            htmlFor="image-upload-input"
            className="cursor-pointer font-semibold text-indigo-ink-700 underline"
          >
            browse your files
          </label>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          JPG, PNG, WebP, GIF or AVIF · up to {MAX_MB} MB each · first image is the
          main one
        </p>

        {uploading && (
          <p className="mt-3 text-sm font-medium text-indigo-ink-700">
            Uploading…
          </p>
        )}
      </div>

      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.url}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
                setDragIndex(null);
              }}
              className="hf-card overflow-hidden"
            >
              <div className="relative aspect-square bg-cotton-100">
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-indigo-ink-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    MAIN
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-madder-600 shadow transition hover:bg-madder-600 hover:text-white"
                  aria-label={`Remove image ${index + 1}`}
                >
                  ✕
                </button>
              </div>

              <div className="p-2">
                <label className="sr-only" htmlFor={`alt-${index}`}>
                  Alt text for image {index + 1}
                </label>
                <input
                  id={`alt-${index}`}
                  value={image.alt}
                  onChange={(e) => {
                    const next = [...images];
                    next[index] = { ...next[index]!, alt: e.target.value };
                    onChange(next);
                  }}
                  placeholder="Alt text (for SEO)"
                  maxLength={160}
                  className="w-full rounded border border-cotton-300 px-2 py-1 text-xs focus:border-indigo-ink-500 focus:outline-none"
                />

                <div className="mt-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    className="flex-1 rounded bg-cotton-200 py-1 text-xs font-semibold text-slate-600 transition hover:bg-cotton-300 disabled:opacity-40"
                    aria-label={`Move image ${index + 1} earlier`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === images.length - 1}
                    className="flex-1 rounded bg-cotton-200 py-1 text-xs font-semibold text-slate-600 transition hover:bg-cotton-300 disabled:opacity-40"
                    aria-label={`Move image ${index + 1} later`}
                  >
                    →
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Alt text describes the image for screen readers and search engines. Write
        what you would say to someone who cannot see it — e.g. &ldquo;indigo buti print
        cotton kurti, front view&rdquo;.
      </p>
    </div>
  );
}
