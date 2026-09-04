import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/store';
import { todayIso } from '@/lib/format';
import {
  Button, Field, Input, Modal, Select, TagInput, Textarea, useToast,
} from './ui';
import { Screenshots } from './Charts';
import { PickerWithCreate } from './PickerWithCreate';
import { COMMON_INSTRUMENTS, TIMEFRAMES } from '@shared/domain.js';

/**
 * A page in the visual textbook.
 *
 * The chart is the point; the writing underneath is what you will actually
 * reread later, so the prompts are the questions worth answering rather than
 * a generic notes box.
 */
export function MarketExampleForm({
  open, onClose, categoryId, categories, sessionId, defaults, example, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categoryId?: string | null;
  categories?: any[] | null;
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
  // category created from inside this form appears immediately.
  const { data: fetched, reload: reloadCategories } = useFetch<any[]>(
    open ? '/examples/categories' : null, [open]
  );
  const categoryList = fetched ?? categories ?? [];

  useEffect(() => {
    if (!open) return;
    setSaved(example ?? null);
    setF(
      example ?? {
        category_id: categoryId ?? '',
        session_id: sessionId ?? null,
        occurred_on: todayIso(),
        timeframe: '5m',
        ...defaults,
      }
    );
  }, [open, example?.id]);

  const set = (patch: any) => setF((p: any) => ({ ...p, ...patch }));

  const save = async () => {
    if (!f.category_id) { toast('bad', 'Choose a category.'); return; }
    if (!f.title?.trim()) { toast('bad', 'Give it a title.'); return; }
    setBusy(true);
    try {
      const payload = { ...f, session_id: f.session_id || null };
      const res = saved?.id
        ? await api.patch(`/examples/${saved.id}`, payload)
        : await api.post('/examples', payload);
      setSaved(res);
      setF(res);
      toast('good', saved?.id ? 'Example updated.' : 'Saved. Add the chart below.');
      onSaved();
      if (saved?.id) onClose();
    } catch (e: any) {
      toast('bad', e.message);
    } finally {
      setBusy(false);
    }
  };

  const prose = (key: string, label: string, placeholder?: string, rows = 2) => (
    <Field label={label}>
      <Textarea rows={rows} value={f[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })}
        placeholder={placeholder} />
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={example ? 'Edit market example' : 'Save a market example'}
      subtitle="A page in your visual textbook."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{saved ? 'Done' : 'Cancel'}</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {saved?.id ? 'Save changes' : 'Save it'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Title" required className="sm:col-span-2">
            <Input autoFocus value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })}
              placeholder="Clean NQ Morning Range" />
          </Field>
          <PickerWithCreate
            label="Category"
            required
            className="sm:col-span-2"
            value={f.category_id ?? ''}
            onChange={(id) => set({ category_id: id })}
            options={categoryList}
            placeholder="Choose a category…"
            hint="No categories yet — name the one this belongs in."
            createLabel="Category"
            createPlaceholder="Morning Trends"
            onCreate={async (name) => {
              const created = await api.post('/examples/categories', { name });
              reloadCategories();
              return created.id;
            }}
          />
          <Field label="Date">
            <Input type="date" value={f.occurred_on ?? ''} onChange={(e) => set({ occurred_on: e.target.value })} />
          </Field>
          <Field label="Instrument">
            <Input list="mex-instruments" value={f.instrument ?? ''}
              onChange={(e) => set({ instrument: e.target.value.toUpperCase() })} />
            <datalist id="mex-instruments">
              {COMMON_INSTRUMENTS.map((i: string) => <option key={i} value={i} />)}
            </datalist>
          </Field>
          <Field label="Timeframe">
            <Select value={f.timeframe ?? '5m'} onChange={(e) => set({ timeframe: e.target.value })}
              options={TIMEFRAMES} />
          </Field>
          <Field label="Tags" hint="Enter after each.">
            <TagInput value={f.tags ?? []} onChange={(tags) => set({ tags })} />
          </Field>
        </div>

        <div className="border-t border-ink-750 pt-4">
          <div className="label-xs mb-2">The chart</div>
          {saved?.id ? (
            <Screenshots
              entityType="MARKET_EXAMPLE"
              entityId={saved.id}
              sessionId={f.session_id ?? undefined}
              defaultCategory="MAIN"
              shots={saved.screenshots ?? []}
              onChange={async () => {
                const fresh = await api.get(`/examples/${saved.id}`);
                setSaved(fresh);
                onSaved();
              }}
            />
          ) : (
            <p className="rounded-md border border-dashed border-ink-600 bg-ink-900/30 px-4 py-6 text-center text-[11.5px] text-fg-faint">
              Save it first, then the chart uploader appears here.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-ink-750 pt-4">
          {prose('description', 'Description', 'Range high 29675, range low 29503.')}
          {prose('what_i_see', 'What I see', 'Price repeatedly rejected both extremes.', 3)}
          <div className="grid gap-3 sm:grid-cols-2">
            {prose('what_makes_valid', 'What makes this pattern valid')}
            {prose('what_invalidates', 'What invalidates it')}
          </div>
          {prose('what_happened_next', 'What happened next')}
          {prose('what_i_learned', 'What I learned',
            'This is the type of range I want to recognise in real time.')}
        </div>
      </div>
    </Modal>
  );
}
