import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/store';
import {
  Button, Field, Input, Modal, SectionLabel, Segmented, Textarea, useToast,
} from './ui';
import { Screenshots } from './Charts';
import {
  COMMON_INSTRUMENTS, LEVEL_CLASSIFICATION, LEVEL_DIRECTION, LEVEL_IMPORTANCE,
  LEVEL_SOURCE_SUGGESTIONS, TIMEFRAMES,
} from '@shared/domain.js';

const numOrNull = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * Certify a level.
 *
 * You do the backtesting elsewhere; this records the verdict. Every field here
 * exists to answer one of two questions: can I trust this level, and how much
 * room and profit does it historically give? Nothing else earns a place.
 */
export function CertifyLevelForm({
  open, onClose, level, sessionId, defaults, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  level?: any | null;
  sessionId?: string | null;
  defaults?: Record<string, any>;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [saved, setSaved] = useState<any>(null);

  const { data: sources } = useFetch<any[]>(open ? '/library/sources' : null, [open]);

  useEffect(() => {
    if (!open) return;
    setSaved(level ?? null);
    setF(
      level ?? {
        direction: 'BOTH',
        classification: 'KEY_LEVEL',
        importance: 'MAJOR',
        session_id: sessionId ?? null,
        ...defaults,
      }
    );
  }, [open, level?.id]);

  const set = (patch: any) => setF((p: any) => ({ ...p, ...patch }));

  const showBuy = f.direction === 'BUY' || f.direction === 'BOTH';
  const showSell = f.direction === 'SELL' || f.direction === 'BOTH';

  const save = async () => {
    if (numOrNull(f.level_price) === null) {
      toast('bad', 'A level price is required — that is the level.');
      return;
    }
    setBusy(true);
    const payload = {
      ...f,
      level_price: numOrNull(f.level_price),
      first_touch_pct: numOrNull(f.first_touch_pct),
      buy_avg_stop: numOrNull(f.buy_avg_stop),
      buy_avg_profit: numOrNull(f.buy_avg_profit),
      buy_best_profit: numOrNull(f.buy_best_profit),
      sell_avg_stop: numOrNull(f.sell_avg_stop),
      sell_avg_profit: numOrNull(f.sell_avg_profit),
      sell_best_profit: numOrNull(f.sell_best_profit),
      sample_size: numOrNull(f.sample_size),
      session_id: f.session_id || null,
    };
    try {
      const res = saved?.id
        ? await api.patch(`/library/levels/${saved.id}`, payload)
        : await api.post('/library/levels', payload);
      setSaved(res);
      setF(res);
      toast('good', saved?.id ? 'Level updated.' : 'Level certified. Add the charts below.');
      onSaved();
      if (saved?.id) onClose();
    } catch (e: any) {
      toast('bad', e.message);
    } finally {
      setBusy(false);
    }
  };

  /** Points input. Every number in this form is points, never money. */
  const pointsField = (key: string, label: string, placeholder?: string) => (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number" step="0.25" placeholder={placeholder}
          value={f[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })}
          className="pr-9"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-fg-faint">
          pts
        </span>
      </div>
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-accent" />
          {level ? 'EDIT CERTIFIED LEVEL' : 'CERTIFY A LEVEL'}
        </span>
      }
      subtitle="Your verdict after backtesting. All figures in points."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{saved ? 'Done' : 'Cancel'}</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {saved?.id ? 'Save changes' : 'Certify it'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ------------------------------------------------------ the level -- */}
        <section>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Level" required>
              <Input
                autoFocus
                type="number"
                step="0.01"
                placeholder="29549"
                value={f.level_price ?? ''}
                onChange={(e) => set({ level_price: e.target.value })}
                className="!h-12 !text-[22px] !font-semibold"
              />
            </Field>
            <Field label="Instrument">
              <Input
                list="lvl-instruments"
                placeholder="NQ"
                value={f.instrument ?? ''}
                onChange={(e) => set({ instrument: e.target.value.toUpperCase() })}
                className="!h-12"
              />
              <datalist id="lvl-instruments">
                {COMMON_INSTRUMENTS.map((i: string) => <option key={i} value={i} />)}
              </datalist>
            </Field>
            <Field label="Timeframe" hint="Type your own if you like.">
              <Input
                list="lvl-timeframes"
                placeholder="5M"
                value={f.timeframe ?? ''}
                onChange={(e) => set({ timeframe: e.target.value })}
                className="!h-12"
              />
              <datalist id="lvl-timeframes">
                {TIMEFRAMES.map((t: any) => <option key={t.value} value={t.value} />)}
              </datalist>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Level source" hint="Where the level comes from. Type anything.">
              <Input
                list="lvl-sources"
                placeholder="4H Previous Candle Low"
                value={f.source ?? ''}
                onChange={(e) => set({ source: e.target.value })}
              />
              <datalist id="lvl-sources">
                {[...new Set([...(sources ?? []).map((s: any) => s.value), ...LEVEL_SOURCE_SUGGESTIONS])]
                  .map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Date / period tested" hint="Optional.">
              <Input
                placeholder="Jan – Mar 2026"
                value={f.period_tested ?? ''}
                onChange={(e) => set({ period_tested: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* ------------------------------------------------------- direction -- */}
        <section className="border-t border-ink-750 pt-4">
          <SectionLabel>Direction</SectionLabel>
          <Segmented
            value={f.direction ?? 'BOTH'}
            onChange={(v) => set({ direction: v })}
            options={LEVEL_DIRECTION.map((d: any) => ({ value: d.value, label: d.label }))}
          />
          <p className="mt-1.5 text-[10.5px] text-fg-faint">
            How this level has historically been worth trading.
          </p>
        </section>

        {/* ----------------------------------------------------- first touch -- */}
        <section className="border-t border-ink-750 pt-4">
          <SectionLabel>First touch</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
            <Field label="Reliability">
              <div className="relative">
                <Input
                  type="number" min={0} max={100} step="1" placeholder="82"
                  value={f.first_touch_pct ?? ''}
                  onChange={(e) => set({ first_touch_pct: e.target.value })}
                  className="pr-7 !text-[16px] !font-semibold"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-fg-faint">
                  %
                </span>
              </div>
            </Field>
            <Field label="Note" hint="Optional.">
              <Input
                placeholder="First touch is significantly stronger than later touches."
                value={f.first_touch_note ?? ''}
                onChange={(e) => set({ first_touch_note: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* ----------------------------------------------------------- buy --- */}
        {showBuy && (
          <section className="border-t border-ink-750 pt-4">
            <SectionLabel className="!text-[#4dd39b]">Buy statistics</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-3">
              {pointsField('buy_avg_stop', 'Average stop loss', '8.5')}
              {pointsField('buy_avg_profit', 'Average profit', '24.5')}
              {pointsField('buy_best_profit', 'Best profit (optional)', '51')}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- sell --- */}
        {showSell && (
          <section className="border-t border-ink-750 pt-4">
            <SectionLabel className="!text-[#f5787f]">Sell statistics</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-3">
              {pointsField('sell_avg_stop', 'Average stop loss', '7.25')}
              {pointsField('sell_avg_profit', 'Average profit', '21')}
              {pointsField('sell_best_profit', 'Best profit (optional)', '44')}
            </div>
          </section>
        )}

        {/* ------------------------------------------------- classification -- */}
        <section className="border-t border-ink-750 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <SectionLabel>Classification</SectionLabel>
              <Segmented
                value={f.classification ?? ''}
                onChange={(v) => set({ classification: v })}
                options={LEVEL_CLASSIFICATION.map((c: any) => ({ value: c.value, label: c.label }))}
              />
            </div>
            <div>
              <SectionLabel>Importance</SectionLabel>
              <Segmented
                value={f.importance ?? ''}
                onChange={(v) => set({ importance: v })}
                options={LEVEL_IMPORTANCE.map((c: any) => ({ value: c.value, label: c.label }))}
              />
            </div>
            <Field label="Backtest sample size" hint="How many occurrences you tested.">
              <Input
                type="number" min={0} step="1" placeholder="47"
                value={f.sample_size ?? ''}
                onChange={(e) => set({ sample_size: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* --------------------------------------------------------- charts -- */}
        <section className="border-t border-ink-750 pt-4">
          <SectionLabel>Charts / evidence</SectionLabel>
          {saved?.id ? (
            <Screenshots
              entityType="CERTIFIED_LEVEL"
              entityId={saved.id}
              sessionId={f.session_id ?? undefined}
              defaultCategory="MAIN"
              shots={saved.screenshots ?? []}
              onChange={async () => {
                const fresh = await api.get(`/library/levels/${saved.id}`);
                setSaved(fresh);
                onSaved();
              }}
            />
          ) : (
            <p className="rounded-md border border-dashed border-ink-600 bg-ink-900/30 px-4 py-6 text-center text-[11.5px] text-fg-faint">
              Certify it first, then the chart uploader appears here.
            </p>
          )}
        </section>

        {/* ---------------------------------------------------------- notes -- */}
        <section className="border-t border-ink-750 pt-4">
          <Field label="Notes">
            <Textarea
              rows={3}
              value={f.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Very strong on first touch. Buy reactions need roughly 8–10 points of room. After the third touch it becomes much less reliable."
            />
          </Field>
        </section>
      </div>
    </Modal>
  );
}
