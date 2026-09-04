import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, CalendarCheck, Lock, ArrowRight } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Badge, Button, EmptyState, Field, Input, LoadingPane, Modal, Select, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb } from '@/components/Charts';
import { useApp, useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { DASH, longDate, todayIso } from '@/lib/format';
import { COMMON_INSTRUMENTS, DAY_TYPE, SESSION_STATUS, TIMEFRAMES, labelOf } from '@shared/domain.js';

function NewDayModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { settings } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setF({
      date: todayIso(),
      instrument: settings.default_instrument,
      timeframe: settings.default_timeframe,
    });
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New daily prediction"
      subtitle="Pick a historical day, then write what you think it does — before you look."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!f.date || !f.instrument}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api.post('/days', f);
                onCreated(res.session.id);
                onClose();
              } catch (e: any) { toast('bad', e.message); } finally { setBusy(false); }
            }}>
            Start
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" required>
            <Input type="date" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Instrument" required>
            <Input list="day-instruments" value={f.instrument ?? ''}
              onChange={(e) => setF({ ...f, instrument: e.target.value.toUpperCase() })} />
            <datalist id="day-instruments">
              {COMMON_INSTRUMENTS.map((i: string) => <option key={i} value={i} />)}
            </datalist>
          </Field>
          <Field label="Timeframe" required>
            <Select value={f.timeframe ?? '5m'} onChange={(e) => setF({ ...f, timeframe: e.target.value })}
              options={TIMEFRAMES} />
          </Field>
        </div>
        <Field label="Title" hint="Optional — what this day is for.">
          <Input value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="Range practice" />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * The practice loop: days you have not finished reviewing sit at the top so you
 * can pick straight back up.
 */
export default function DailyPrediction() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useFetch<any[]>('/days?limit=100');

  if (loading && !data) return <LoadingPane />;

  const open = data?.filter((d) => d.status !== 'REVIEWED') ?? [];
  const done = data?.filter((d) => d.status === 'REVIEWED') ?? [];

  const Tile = ({ d }: { d: any }) => (
    <button onClick={() => navigate(`/day/${d.id}`)}
      className="panel group flex gap-3 p-3 text-left transition-colors hover:border-ink-500">
      <ChartThumb filename={d.thumb} ratio="aspect-[4/3]" className="w-32 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-fg group-hover:text-accent">
            {longDate(d.date)}
          </span>
          {d.locked_at && <Lock size={11} className="shrink-0 text-[#4dd39b]" />}
        </div>
        <div className="tnum mt-0.5 text-[11px] text-fg-faint">{d.instrument} · {d.timeframe}</div>
        {d.title && <div className="mt-0.5 truncate text-[11px] text-fg-muted">{d.title}</div>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={d.status === 'REVIEWED' ? 'good' : d.status === 'LOCKED' ? 'accent' : 'neutral'}>
            {labelOf(SESSION_STATUS, d.status)}
          </Badge>
          {d.expected_day_type && (
            <span className="text-[10.5px] text-fg-faint">
              predicted {labelOf(DAY_TYPE, d.expected_day_type)}
              {d.actual_day_type && (
                <span className={d.actual_day_type === d.expected_day_type ? 'text-[#4dd39b]' : 'text-[#f5787f]'}>
                  {' '}→ {labelOf(DAY_TYPE, d.actual_day_type)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={14} className="mt-1 shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" />
    </button>
  );

  return (
    <>
      <PageHeader
        title="Daily Prediction"
        subtitle="Practise reading a historical day. Write your call, lock it, study the day, then compare."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            New prediction
          </Button>
        }
      />

      <Page className="space-y-6">
        {!data?.length ? (
          <div className="panel">
            <EmptyState
              icon={<CalendarCheck size={28} />}
              title="No predictions yet"
              hint="Pick a historical day, write what you think it will do, and lock it before you look. Then study the day and write down what actually happened beside it."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                  Start your first one
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <h2 className="mb-2.5 text-[13px] font-semibold tracking-wide text-fg">In progress</h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {open.map((d) => <Tile key={d.id} d={d} />)}
                </div>
              </section>
            )}
            {done.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-semibold tracking-wide text-fg">Reviewed</h2>
                  <button onClick={() => navigate('/archive')}
                    className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
                    Full archive <ArrowRight size={11} />
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {done.slice(0, 8).map((d) => <Tile key={d.id} d={d} />)}
                </div>
              </section>
            )}
          </>
        )}
      </Page>

      <NewDayModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => { reload(); navigate(`/day/${id}`); }}
      />
    </>
  );
}
