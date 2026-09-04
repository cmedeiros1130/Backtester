import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
  ImagePlus, X, Trash2, ChevronLeft, ChevronRight, ImageOff, Maximize2,
} from 'lucide-react';
import { api, uploadUrl } from '@/lib/api';
import { SCREENSHOT_CATEGORY, labelOf } from '@shared/domain.js';
import { Badge, Button, Input, Select, useToast } from './ui';

export type Shot = {
  id: string; filename: string; caption: string | null; category: string | null;
  original_name: string | null; created_at: string;
};

// ===========================================================================
// Lightbox
// ===========================================================================
/**
 * Full-screen chart viewer. Arrow keys move through the set, because comparing
 * a before against an after is most of what this application is for.
 */
export function Lightbox({
  shots, index, onClose, onIndex,
}: { shots: Shot[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const shot = shots[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % shots.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + shots.length) % shots.length);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, shots.length, onClose, onIndex]);

  if (!shot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/94" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {shot.category && <Badge tone="accent">{labelOf(SCREENSHOT_CATEGORY, shot.category)}</Badge>}
          <span className="text-[12.5px] text-fg-muted">{shot.caption || shot.original_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum text-[11.5px] text-fg-faint">{index + 1} / {shots.length}</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-ink-800 hover:text-fg">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 px-3 pb-4" onClick={(e) => e.stopPropagation()}>
        {shots.length > 1 && (
          <button
            onClick={() => onIndex((index - 1 + shots.length) % shots.length)}
            className="shrink-0 rounded-full bg-ink-850/80 p-2.5 text-fg-muted hover:bg-ink-700 hover:text-fg"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <img
          src={uploadUrl(shot.filename)}
          alt={shot.caption ?? ''}
          className="mx-auto max-h-full min-h-0 flex-1 object-contain"
        />
        {shots.length > 1 && (
          <button
            onClick={() => onIndex((index + 1) % shots.length)}
            className="shrink-0 rounded-full bg-ink-850/80 p-2.5 text-fg-muted hover:bg-ink-700 hover:text-fg"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {shots.length > 1 && (
        <div className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {shots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onIndex(i)}
              className={clsx(
                'h-12 w-20 shrink-0 overflow-hidden rounded border-2 transition-colors',
                i === index ? 'border-accent' : 'border-transparent opacity-50 hover:opacity-90'
              )}
            >
              <img src={uploadUrl(s.filename)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ===========================================================================
// Thumbnail
// ===========================================================================
/** A chart tile. Large by default — this is the primary content of the app. */
export function ChartThumb({
  filename, alt, className, onClick, ratio = 'aspect-[16/10]', badge,
}: {
  filename?: string | null; alt?: string; className?: string;
  onClick?: () => void; ratio?: string; badge?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-md border border-ink-700 bg-ink-900',
        ratio, onClick && 'cursor-zoom-in', className
      )}
    >
      {filename ? (
        <img
          src={uploadUrl(filename)}
          alt={alt ?? ''}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-500">
          <ImageOff size={20} />
          <span className="text-[10.5px]">No chart yet</span>
        </div>
      )}
      {badge && <div className="absolute left-2 top-2">{badge}</div>}
      {filename && onClick && (
        <div className="absolute right-2 top-2 rounded bg-ink-950/70 p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 size={11} className="text-fg-muted" />
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Screenshot manager
// ===========================================================================
/**
 * Upload, caption, categorise and delete the charts on one record.
 *
 * Paste works anywhere inside the drop zone, which is how a screenshot
 * normally arrives — straight from the clipboard.
 */
export function Screenshots({
  entityType, entityId, sessionId, defaultCategory = 'BEFORE', shots, onChange, columns = 2, compact,
}: {
  entityType: string;
  entityId: string | null;
  sessionId?: string | null;
  defaultCategory?: string;
  shots: Shot[];
  onChange: () => void;
  columns?: number;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [viewing, setViewing] = useState<number | null>(null);
  const toast = useToast();

  const upload = useCallback(
    async (files: FileList | File[]) => {
      if (!entityId) { toast('bad', 'Save this first, then attach charts to it.'); return; }
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      setBusy(true);
      try {
        const form = new FormData();
        list.forEach((f) => form.append('files', f));
        form.append('entity_type', entityType);
        form.append('entity_id', entityId);
        if (sessionId) form.append('session_id', sessionId);
        if (category) form.append('category', category);
        await api.upload('/screenshots', form);
        toast('good', `${list.length} chart${list.length > 1 ? 's' : ''} added.`);
        onChange();
      } catch (e: any) {
        toast('bad', e.message);
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [entityId, entityType, sessionId, category, onChange, toast]
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-36"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={SCREENSHOT_CATEGORY}
        />
        <Button size="sm" icon={<ImagePlus size={13} />} loading={busy}
          onClick={() => fileRef.current?.click()} disabled={!entityId}>
          Add charts
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => e.target.files && upload(e.target.files)} />
        <span className="text-[10.5px] text-fg-faint">or paste / drop images below</span>
      </div>

      <div
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) { e.preventDefault(); upload(files); }
        }}
        className={clsx(
          'rounded-lg border border-dashed transition-colors focus:outline-none',
          dragging ? 'border-accent bg-accent-soft/40' : 'border-ink-600 bg-ink-900/30',
          shots.length ? 'p-2.5' : 'px-6 py-10'
        )}
      >
        {shots.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 text-center text-fg-faint">
            <ImagePlus size={22} className="text-ink-500" />
            <span className="text-[12px]">
              {entityId ? 'Click here and paste, or drop chart images' : 'Save first, then attach charts'}
            </span>
          </div>
        ) : (
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {shots.map((s, i) => (
              <figure key={s.id} className="overflow-hidden rounded-md border border-ink-700 bg-ink-850">
                <div className="group relative">
                  <ChartThumb
                    filename={s.filename}
                    alt={s.caption ?? ''}
                    ratio={compact ? 'aspect-[16/10]' : 'aspect-[16/9]'}
                    onClick={() => setViewing(i)}
                    badge={s.category ? <Badge tone="accent">{labelOf(SCREENSHOT_CATEGORY, s.category)}</Badge> : undefined}
                  />
                  <button
                    onClick={async () => {
                      await api.del(`/screenshots/${s.id}`);
                      toast('info', 'Chart removed.');
                      onChange();
                    }}
                    className="absolute bottom-2 right-2 rounded bg-ink-950/80 p-1.5 text-fg-faint opacity-0
                               transition-opacity hover:text-[#f0575f] group-hover:opacity-100"
                    aria-label="Delete chart"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <figcaption className="p-1.5">
                  <Input
                    defaultValue={s.caption ?? ''}
                    placeholder="Caption…"
                    onBlur={async (e) => {
                      if (e.target.value !== (s.caption ?? '')) {
                        await api.patch(`/screenshots/${s.id}`, { caption: e.target.value });
                        onChange();
                      }
                    }}
                    className="!border-transparent !bg-transparent !px-1 !py-0.5 !text-[11px] hover:!border-ink-600"
                  />
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {viewing !== null && (
        <Lightbox shots={shots} index={viewing} onClose={() => setViewing(null)} onIndex={setViewing} />
      )}
    </div>
  );
}

/** Read-only chart strip, used wherever charts are shown but not managed. */
export function ChartStrip({ shots, columns = 2 }: { shots: Shot[]; columns?: number }) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (!shots.length) return null;
  return (
    <>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shots.map((s, i) => (
          <figure key={s.id}>
            <ChartThumb
              filename={s.filename}
              alt={s.caption ?? ''}
              onClick={() => setViewing(i)}
              badge={s.category ? <Badge tone="accent">{labelOf(SCREENSHOT_CATEGORY, s.category)}</Badge> : undefined}
            />
            {s.caption && <figcaption className="mt-1 text-[11px] text-fg-faint">{s.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {viewing !== null && (
        <Lightbox shots={shots} index={viewing} onClose={() => setViewing(null)} onIndex={setViewing} />
      )}
    </>
  );
}
