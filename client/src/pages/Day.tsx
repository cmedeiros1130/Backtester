import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, Lock, ShieldCheck, Save, Eye, FolderPlus, ImagePlus, Trash2, Check,
} from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Badge, Button, Card, ConfirmButton, EmptyState, Field, Input, LoadingPane,
  Modal, Prose, SectionLabel, Select, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb, Screenshots } from '@/components/Charts';
import { LevelExampleForm } from '@/components/LevelExampleForm';
import { MarketExampleForm } from '@/components/MarketExampleForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { DASH, longDate, pts } from '@/lib/format';
import { BIAS, DAY_TYPE, LEVEL_RESULT, SESSION_STATUS, labelOf } from '@shared/domain.js';

const PREDICTION_FIELDS: { key: string; label: string; rows?: number; placeholder?: string }[] = [
  { key: 'important_levels', label: 'Important levels', rows: 2, placeholder: '21450 / 21520' },
  { key: 'main_prediction', label: 'Main prediction', rows: 3, placeholder: 'What you think today is.' },
  { key: 'bull_scenario', label: 'Bull scenario', rows: 2 },
  { key: 'bear_scenario', label: 'Bear scenario', rows: 2 },
  { key: 'waiting_for', label: 'What I am waiting for', rows: 2 },
  { key: 'invalidates', label: 'What would invalidate my idea', rows: 2 },
  { key: 'notes', label: 'Notes', rows: 2 },
];

const REVIEW_FIELDS: { key: string; label: string; rows?: number }[] = [
  { key: 'right_about', label: 'What was I right about?', rows: 3 },
  { key: 'wrong_about', label: 'What was I wrong about?', rows: 3 },
  { key: 'missed', label: 'What did I miss?', rows: 3 },
  { key: 'learned', label: 'What did I learn?', rows: 3 },
];

const RESULT_TONE: Record<string, any> = {
  HELD: 'good', RECLAIMED: 'good', FAILED: 'bad', BROKE: 'bad',
};

/** Read-only rendering of a locked field, so a locked page still reads well. */
function Locked({ value }: { value: any }) {
  return (
    <div className="min-h-[2.25rem] whitespace-pre-wrap rounded-md border border-ink-750 bg-ink-900/60 px-2.5 py-1.5
                    text-[12.5px] leading-relaxed text-fg-muted">
      {value || <span className="text-ink-500">—</span>}
    </div>
  );
}

export default function Day() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, reload } = useFetch<any>(id ? `/days/${id}` : null, [id]);

  const [pred, setPred] = useState<any>({});
  const [rev, setRev] = useState<any>({});
  const [predDirty, setPredDirty] = useState(false);
  const [revDirty, setRevDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPred(data.prediction ?? {});
    setRev(data.review ?? {});
    setPredDirty(false);
    setRevDirty(false);
  }, [data?.prediction?.updated_at, data?.review?.updated_at, data?.session?.id]);

  if (loading && !data) return <LoadingPane label="Opening the day" />;
  if (!data) return null;

  const { session, prediction, review } = data;
  const locked = !!prediction?.locked_at;
  const snapshot = prediction?.locked_snapshot?.fields ?? prediction ?? {};

  const savePrediction = async () => {
    setSaving(true);
    try {
      await api.put(`/days/${session.id}/prediction`, pred);
      toast('good', 'Prediction saved.');
      setPredDirty(false);
      reload();
    } catch (e: any) { toast('bad', e.message); } finally { setSaving(false); }
  };

  const lock = async () => {
    setSaving(true);
    try {
      if (predDirty) await api.put(`/days/${session.id}/prediction`, pred);
      await api.post(`/days/${session.id}/prediction/lock`, {});
      toast('good', 'Locked. Go and study the day — this text will not change.');
      setLockOpen(false);
      setPredDirty(false);
      reload();
    } catch (e: any) { toast('bad', e.message); } finally { setSaving(false); }
  };

  const saveReview = async () => {
    setSaving(true);
    try {
      await api.put(`/days/${session.id}/review`, rev);
      toast('good', 'Review saved.');
      setRevDirty(false);
      reload();
    } catch (e: any) { toast('bad', e.message); } finally { setSaving(false); }
  };

  const setP = (patch: any) => { setPred({ ...pred, ...patch }); setPredDirty(true); };
  const setR = (patch: any) => { setRev({ ...rev, ...patch }); setRevDirty(true); };

  const dayTypeMatch =
    review?.actual_day_type && snapshot.expected_day_type &&
    review.actual_day_type === snapshot.expected_day_type;

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => navigate('/archive')}
            className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
            <ArrowLeft size={12} /> Backtest Archive
          </button>
        }
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            {longDate(session.date)}
            <span className="tnum text-[15px] font-semibold text-accent">{session.instrument}</span>
            <span className="text-[13px] font-normal text-fg-faint">{session.timeframe}</span>
            <Badge tone={session.status === 'REVIEWED' ? 'good' : session.status === 'LOCKED' ? 'accent' : 'neutral'}>
              {labelOf(SESSION_STATUS, session.status)}
            </Badge>
          </span>
        }
        subtitle={session.title || undefined}
        actions={
          <>
            <Button size="sm" icon={<FolderPlus size={13} />} onClick={() => setLevelOpen(true)}>
              Save to Level Library
            </Button>
            <Button size="sm" icon={<ImagePlus size={13} />} onClick={() => setExampleOpen(true)}>
              Save to Market Examples
            </Button>
            <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete this day?"
              onConfirm={async () => {
                await api.del(`/days/${session.id}`);
                toast('info', 'Day deleted.');
                navigate('/archive');
              }}>
              <Trash2 size={12} />
            </ConfirmButton>
          </>
        }
      />

      <Page className="space-y-4">
        {/* ------------------------------------------------------ the lock -- */}
        <div className={clsx(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
          locked ? 'border-[#1d4534] bg-[#0f2019]' : 'border-[#4a3a16] bg-[#1c1709]'
        )}>
          <div className="flex items-start gap-2.5">
            {locked ? <ShieldCheck size={17} className="mt-0.5 text-[#4dd39b]" />
              : <Lock size={17} className="mt-0.5 text-[#e0b45c]" />}
            <div>
              <div className={clsx('text-[12.5px] font-semibold', locked ? 'text-[#8fe0bb]' : 'text-[#e0b45c]')}>
                {locked ? 'Prediction locked' : 'Not locked yet'}
              </div>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-fg-faint">
                {locked
                  ? 'This is exactly what you wrote before you knew the outcome. Go and study the day, then fill in the review beside it.'
                  : 'Write what you think the day will do, then lock it before you look. That is what makes the comparison worth anything.'}
              </p>
            </div>
          </div>
          {!locked && (
            <div className="flex gap-2">
              <Button icon={<Save size={13} />} loading={saving} onClick={savePrediction} disabled={!predDirty}>
                {predDirty ? 'Save draft' : 'Saved'}
              </Button>
              <Button variant="primary" icon={<Lock size={13} />} onClick={() => setLockOpen(true)}>
                Lock prediction
              </Button>
            </div>
          )}
        </div>

        {/* -------------------------------------- prediction beside reality -- */}
        <div className={clsx('grid gap-4', locked && 'lg:grid-cols-2')}>
          <Card
            title="My prediction"
            subtitle={locked ? 'Sealed before the outcome was known.' : 'Written before you look at the day.'}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Expected day type">
                {locked ? <Locked value={labelOf(DAY_TYPE, snapshot.expected_day_type)} /> : (
                  <Select value={pred.expected_day_type ?? ''} onChange={(e) => setP({ expected_day_type: e.target.value })}
                    options={DAY_TYPE} placeholder="Select…" />
                )}
              </Field>
              <Field label="Bias">
                {locked ? <Locked value={labelOf(BIAS, snapshot.bias)} /> : (
                  <Select value={pred.bias ?? ''} onChange={(e) => setP({ bias: e.target.value })}
                    options={BIAS} placeholder="Select…" />
                )}
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              {PREDICTION_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  {locked ? <Locked value={snapshot[f.key]} /> : (
                    <Textarea rows={f.rows ?? 2} placeholder={f.placeholder}
                      value={pred[f.key] ?? ''} onChange={(e) => setP({ [f.key]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>

            <div className="mt-4 border-t border-ink-750 pt-4">
              <SectionLabel>Charts from before the day</SectionLabel>
              <Screenshots
                entityType="DAY_PREDICTION"
                entityId={prediction?.id ?? null}
                sessionId={session.id}
                defaultCategory="BEFORE"
                shots={prediction?.screenshots ?? []}
                onChange={reload}
                columns={2}
              />
            </div>
          </Card>

          {locked && (
            <Card
              title="What actually happened"
              subtitle="Fill this in after you have studied the day."
              actions={
                <Button size="xs" variant="primary" icon={<Save size={11} />}
                  loading={saving} onClick={saveReview} disabled={!revDirty}>
                  {revDirty ? 'Save' : 'Saved'}
                </Button>
              }
            >
              <Field
                label="Actual day type"
                aside={dayTypeMatch
                  ? <span className="inline-flex items-center gap-1 text-[10.5px] text-[#4dd39b]"><Check size={10} /> matched</span>
                  : undefined}
              >
                <Select value={rev.actual_day_type ?? ''} onChange={(e) => setR({ actual_day_type: e.target.value })}
                  options={DAY_TYPE} placeholder="Select…" />
              </Field>

              <div className="mt-3 space-y-3">
                {REVIEW_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Textarea rows={f.rows ?? 3} value={rev[f.key] ?? ''}
                      onChange={(e) => setR({ [f.key]: e.target.value })} />
                  </Field>
                ))}
                <Field label="Notes">
                  <Textarea rows={2} value={rev.notes ?? ''} onChange={(e) => setR({ notes: e.target.value })} />
                </Field>
              </div>

              <div className="mt-4 border-t border-ink-750 pt-4">
                <SectionLabel>Completed session chart</SectionLabel>
                <Screenshots
                  entityType="DAY_REVIEW"
                  entityId={review?.id ?? null}
                  sessionId={session.id}
                  defaultCategory="AFTER"
                  shots={review?.screenshots ?? []}
                  onChange={reload}
                  columns={2}
                />
                {!review?.id && (
                  <p className="mt-2 text-[11px] text-fg-faint">
                    Save the review once to create it, then charts can be attached here.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ---------------------------------------- what this day produced -- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={`Level examples filed (${data.level_examples.length})`}
            subtitle="Levels you tested on this day."
            actions={<Button size="xs" icon={<FolderPlus size={11} />} onClick={() => setLevelOpen(true)}>Add</Button>}
          >
            {data.level_examples.length === 0 ? (
              <EmptyState title="Nothing filed from this day yet"
                hint="Tested a level? File it into the Level Library and it stays linked to this day." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.level_examples.map((e: any) => (
                  <button key={e.id} onClick={() => navigate(`/library/${e.folder_slug}?open=${e.id}`)}
                    className="group text-left">
                    <ChartThumb filename={e.thumb} ratio="aspect-[16/9]"
                      badge={e.result ? <Badge tone={RESULT_TONE[e.result] ?? 'muted'}>{labelOf(LEVEL_RESULT, e.result)}</Badge> : undefined} />
                    <div className="mt-1.5 truncate text-[12px] font-medium text-fg group-hover:text-accent">
                      {e.folder_name}
                    </div>
                    <div className="tnum flex gap-2 text-[10.5px] text-fg-faint">
                      {e.level_price != null && <span>{pts(e.level_price)}</span>}
                      <span>{e.timeframe}</span>
                      {e.touch_number != null && <span>touch {e.touch_number}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={`Market examples saved (${data.market_examples.length})`}
            subtitle="Patterns worth keeping from this day."
            actions={<Button size="xs" icon={<ImagePlus size={11} />} onClick={() => setExampleOpen(true)}>Add</Button>}
          >
            {data.market_examples.length === 0 ? (
              <EmptyState title="Nothing saved from this day yet"
                hint="Spotted a clean range or a textbook retest? Save it into your Market Examples." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.market_examples.map((m: any) => (
                  <button key={m.id} onClick={() => navigate(`/examples/${m.category_slug}?open=${m.id}`)}
                    className="group text-left">
                    <ChartThumb filename={m.thumb} ratio="aspect-[16/9]"
                      badge={<Badge tone="muted">{m.category_name}</Badge>} />
                    <div className="mt-1.5 truncate text-[12px] font-medium text-fg group-hover:text-accent">
                      {m.title}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Other charts from this day" subtitle="Anything else worth keeping alongside the record.">
          <Screenshots
            entityType="SESSION"
            entityId={session.id}
            sessionId={session.id}
            defaultCategory="OTHER"
            shots={data.screenshots ?? []}
            onChange={reload}
            columns={3}
          />
        </Card>
      </Page>

      <Modal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        width="sm"
        title="Lock this prediction?"
        subtitle="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLockOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={<Lock size={13} />} loading={saving} onClick={lock}>Lock it</Button>
          </>
        }
      >
        <div className="space-y-3 text-[12.5px] leading-relaxed text-fg-muted">
          <p>
            After locking, the server refuses any edit to these fields. That is the whole point: a
            prediction you can revise after seeing the outcome is not a prediction.
          </p>
          <p>You can still attach charts and write the review beside it.</p>
          {predDirty && (
            <p className="rounded-md border border-[#4a3a16] bg-[#1c1709] px-3 py-2 text-[11.5px] text-[#e0b45c]">
              You have unsaved changes. They will be saved and then locked.
            </p>
          )}
        </div>
      </Modal>

      <LevelExampleForm
        open={levelOpen}
        onClose={() => setLevelOpen(false)}
        sessionId={session.id}
        defaults={{ occurred_on: session.date, instrument: session.instrument, timeframe: session.timeframe }}
        onSaved={reload}
      />
      <MarketExampleForm
        open={exampleOpen}
        onClose={() => setExampleOpen(false)}
        sessionId={session.id}
        defaults={{ occurred_on: session.date, instrument: session.instrument, timeframe: session.timeframe }}
        onSaved={reload}
      />
    </>
  );
}
