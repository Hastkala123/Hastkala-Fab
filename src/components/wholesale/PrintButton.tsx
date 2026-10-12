"use client";

/** Opens the browser's print dialog, where "Save as PDF" makes the catalogue a PDF. */
export default function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="hf-btn hf-btn-primary">
      {label}
    </button>
  );
}
