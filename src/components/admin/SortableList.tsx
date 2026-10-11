"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export type SortableItem = { id: string; label: string; sublabel?: string | null; imageUrl?: string | null };

/**
 * Drag-and-drop ordering for admin lists (products in a category, categories
 * in the menu). Rows can also be moved with the ↑ ↓ buttons, so it works on a
 * phone and with a keyboard. Nothing is saved until "Save order".
 */
export default function SortableList({ items: initial, endpoint }: { items: SortableItem[]; endpoint: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = items.some((item, i) => item.id !== initial[i]?.id);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const result = await apiRequest(endpoint, { body: { ids: items.map((i) => i.id) } });
    setSaving(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Order saved", "success");
    router.refresh();
  }

  return (
    <div>
      <ol className="divide-y divide-cotton-200 rounded-card border border-cotton-300 bg-white">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                move(dragIndex, index);
                setDragIndex(index);
              }
            }}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "flex cursor-grab items-center gap-3 px-3 py-2.5 active:cursor-grabbing",
              dragIndex === index && "bg-indigo-ink-50",
            )}
          >
            <span aria-hidden="true" className="select-none text-lg leading-none text-slate-400">
              ⠿
            </span>
            <span className="w-7 text-right text-xs font-semibold text-slate-400">{index + 1}</span>
            {item.imageUrl !== undefined && (
              <span className="relative aspect-square w-10 shrink-0 overflow-hidden rounded bg-cotton-100">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-indigo-ink-900">{item.label}</span>
              {item.sublabel && <span className="block truncate text-xs text-slate-500">{item.sublabel}</span>}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                className="hf-btn hf-btn-ghost px-2 py-1 text-sm disabled:opacity-30"
                aria-label={`Move ${item.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === items.length - 1}
                className="hf-btn hf-btn-ghost px-2 py-1 text-sm disabled:opacity-30"
                aria-label={`Move ${item.label} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex gap-2.5">
        <button type="button" onClick={save} disabled={!dirty || saving} className="hf-btn hf-btn-primary">
          {saving ? "Saving…" : "Save order"}
        </button>
        {dirty && (
          <button type="button" onClick={() => setItems(initial)} className="hf-btn hf-btn-outline">
            Undo changes
          </button>
        )}
      </div>
    </div>
  );
}
