import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/store';
import { todayIso } from '@/lib/format';
import {
  Button, Field, Input, Modal, Segmented, Select, TagInput, Textarea, useToast,
} from './ui';
import { Screenshots } from './Charts';
import { PickerWithCreate } from './PickerWithCreate';
import { COMMON_INSTRUMENTS, DIRECTION, LEVEL_RESULT, TIMEFRAMES } from '@shared/domain.js';

const numOrNull = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * File one occurrence of a level.
 *
 * Deliberately one short screen: what it was, what it did, and the before and
 * after charts. Nothing is required except the folder it goes in.
 */
export function LevelExampleForm({
  open, onClose, folderId, folders, sessionId, defaults, example, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  folderId?: string | null;
  folders?: any[] | null;
  sessionId?: string | null;
  defaults?: Partial<Record<string, any>>;
  example?: any | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [saved, setSaved] = useState<any>(null);

  // The prop is a fast initial value; the fetch is the source of truth so a
  // folder created from inside this form appears immediately.
  const { data: fetchedFolders, reload: reloadFolders } = useFetch<any[]>(
    open ? '/library/folders' : null, [open]
  );
  const folderList = fetchedFolders ?? folders ?? [];

  useEffect(() => {
    if (!open) return;
    setSaved(example ?? null);
    setF(
      example ?? {
        folder_id: folderId ?? '',
        session_id: sessionId ?? null,
        occurred_on: todayIso(),
        direction: 'LONG',
        timeframe: '5m',
        ...defaults,
      }
    );
  }, [open, example?.id]);

  const set = (patch: any) => setF((p: any) => ({ ...p, ...patch }));

  const save = async () => {
    if (!f.folder_id) { toast('bad', 'Choose which folder this belongs in.'); return; }
    setBusy(true);
    const payload = {
      ...f,
      level_price: numOrNull(f.level_price),
      touch_number: numOrNull(f.touch_number),
      drawdown: numOrNull(f.drawdown),
      reaction: numOrNull(f.reaction),
      session_id: f.session_id || null,
    };
    try {
      const res = saved?.id
        ? await api.patch(`/library/examples/${saved.id}`, payload)
        : await api.post('/library/examples', payload);
      setSaved(res);
      setF(res);
      toast('good', saved?.id ? 'Example updated.' : 'Filed. Add the charts below.');
      onSaved();
      // Stay open after the first save so charts can be attached straight away.
      if (saved?.id) onClose();
    } catch (e: any) {
      toast('bad', e.message);
    } finally {
      setBusy(false);
    }
  };

  const num = (key: string, label: string, hint?: string, step = '0.25') => (
    <Field label={label} hint={hint}>
      <Input type="number" step={step} value={f[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={example ? 'Edit level example' : 'File a level example'}
      subtitle="What the level was, what it did, and the charts."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{saved ? 'Done' : 'Cancel'}</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {saved?.id ? 'Save changes' : 'File it'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PickerWithCreate
            label="Folder"
            required
            className="sm:col-span-3"
            value={f.folder_id ?? ''}
            onChange={(id) => set({ folder_id: id })}
            options={folderList}
            placeholder="Choose a level type…"
            hint="No folders yet — name the level type you are filing this under."
            createLabel="Folder"
            createPlaceholder="4H Previous Candle Low"
            onCreate={async (name) => {
              const created = await api.post('/library/folders', { name });
              reloadFolders();
              return created.id;
            }}
          />
          <Field label="Date">
            <Input type="date" value={f.occurred_on ?? ''} onChange={(e) => set({ occurred_on: e.target.value })} />
          </Field>
          <Field label="Instrument">
            <Input list="lex-instruments" value={f.instrument ?? ''}
              onChange={(e) => set({ instrument: e.target.value.toUpperCase() })} />
            <datalist id="lex-instruments">
              {COMMON_INSTRUMENTS.map((i: string) => <option key={i} value={i} />)}
            </datalist>
          </Field>
          <Field label="Timeframe" hint="What you were watching it on.">
            <Select value={f.timeframe ?? '5m'} onChange={(e) => set({ timeframe: e.target.value })}
              options={TIMEFRAMES} />
          </Field>
        </div>

        <div className="grid gap-3 border-t border-ink-750 pt-4 sm:grid-cols-4">
          {num('level_price', 'Level price', undefined, '0.01')}
          <Field label="Direction">
            <Select value={f.direction ?? 'LONG'} onChange={(e) => set({ direction: e.target.value })}
              options={DIRECTION} />
          </Field>
          {num('touch_number', 'Touch number', 'First, second, third…', '1')}
          <Field label="Result">
            <Select value={f.result ?? ''} onChange={(e) => set({ result: e.target.value })}
              options={LEVEL_RESULT} placeholder="Not recorded" />
          </Field>
          {num('drawdown', 'Drawdown / penetration', 'Points through the level')}
          {num('reaction', 'Reaction', 'Points away from the level')}
        </div>

        <div className="space-y-3 border-t border-ink-750 pt-4">
          <Field label="What happened">
            <Textarea rows={3} value={f.what_happened ?? ''} onChange={(e) => set({ what_happened: e.target.value })}
              placeholder="Price moved through the level, reclaimed it, then produced a strong reaction." />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <Field label="Tags" hint="Press Enter after each one.">
            <TagInput value={f.tags ?? []} onChange={(tags) => set({ tags })} />
          </Field>
        </div>

        <div className="border-t border-ink-750 pt-4">
          <div className="label-xs mb-2">Charts — before and after</div>
          {saved?.id ? (
            <Screenshots
              entityType="LEVEL_EXAMPLE"
              entityId={saved.id}
              sessionId={f.session_id ?? undefined}
              defaultCategory="BEFORE"
              shots={saved.screenshots ?? []}
              onChange={async () => {
                const fresh = await api.get(`/library/examples/${saved.id}`);
                setSaved(fresh);
                onSaved();
              }}
            />
          ) : (
            <p className="rounded-md border border-dashed border-ink-600 bg-ink-900/30 px-4 py-6 text-center text-[11.5px] text-fg-faint">
              File it first, then the chart uploader appears here.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
