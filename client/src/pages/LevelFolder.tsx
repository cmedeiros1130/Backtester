import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, LayoutGrid, Rows3,
} from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Badge, Button, Card, ConfirmButton, EmptyState, Field, Input, LoadingPane, Modal,
  Prose, SectionLabel, Segmented, Select, TableWrap, TD, TH, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb, Screenshots } from '@/components/Charts';
import { LevelExampleForm } from '@/components/LevelExampleForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { DASH, longDate, pts, shortDate } from '@/lib/format';
import { LEVEL_RESULT, TIMEFRAMES, labelOf } from '@shared/domain.js';

const RESULT_TONE: Record<string, any> = {
  HELD: 'good', RECLAIMED: 'good', FAILED: 'bad', BROKE: 'bad',
};

/** One number in the folder header. Plain by design. */
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-[92px]">
      <div className="label-xs">{label}</div>
      <div className="tnum mt-0.5 text-[17px] font-semibold leading-none text-fg">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-fg-faint">{sub}</div>}
    </div>
  );
}

/** The full example, opened from the gallery. */
function ExampleDetail({
  example, onClose, onChanged, onEdit,
}: { example: any; onClose: () => void; onChanged: () => void; onEdit: () => void }) {
  const toast = useToast();
  const { data, reload } = useFetch<any>(example ? `/library/examples/${example.id}` : null, [example?.id]);
  const e = data ?? example;

  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="tnum text-[16px]">{e.level_price != null ? pts(e.level_price) : e.folder_name}</span>
          {e.result && <Badge tone={RESULT_TONE[e.result] ?? 'muted'}>{labelOf(LEVEL_RESULT, e.result)}</Badge>}
          {e.touch_number != null && <Badge tone="muted">touch {e.touch_number}</Badge>}
          {e.timeframe && <Badge tone="accent">{e.timeframe}</Badge>}
        </span>
      }
      subtitle={[e.instrument, e.occurred_on ? longDate(e.occurred_on) : null].filter(Boolean).join(' · ')}
      footer={
        <>
          <ConfirmButton variant="ghost" confirmLabel="Delete this example?"
            onConfirm={async () => {
              await api.del(`/library/examples/${e.id}`);
              toast('info', 'Example deleted.');
              onChanged();
              onClose();
            }}>
            <Trash2 size={12} />
          </ConfirmButton>
          <Button icon={<Pencil size={12} />} onClick={onEdit}>Edit</Button>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Screenshots
          entityType="LEVEL_EXAMPLE"
          entityId={e.id}
          defaultCategory="BEFORE"
          shots={e.screenshots ?? []}
          onChange={() => { reload(); onChanged(); }}
          columns={2}
        />

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ink-750 pt-3 sm:grid-cols-4">
          <Stat label="Drawdown" value={e.drawdown != null ? `${pts(e.drawdown)}` : DASH} sub="pts through" />
          <Stat label="Reaction" value={e.reaction != null ? `${pts(e.reaction)}` : DASH} sub="pts away" />
          <Stat label="Direction" value={e.direction ?? DASH} />
          <Stat label="Touch" value={e.touch_number ?? DASH} />
        </div>

        <div className="space-y-3 border-t border-ink-750 pt-3">
          <Prose label="What happened">{e.what_happened}</Prose>
          <Prose label="Notes">{e.notes}</Prose>
          {e.tags?.length > 0 && (
            <div>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {e.tags.map((t: string) => <Badge key={t} tone="muted">{t}</Badge>)}
              </div>
            </div>
          )}
          {e.session_id && (
            <a href={`/day/${e.session_id}`} className="inline-block text-[11.5px] text-accent hover:underline">
              From the {shortDate(e.session_date)} backtest →
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function LevelFolder() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [timeframe, setTimeframe] = useState('');
  const [result, setResult] = useState('');
  const [touch, setTouch] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [fileOpen, setFileOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [opened, setOpened] = useState<any>(null);
  const [renaming, setRenaming] = useState(false);
  const [rename, setRename] = useState<any>({});

  const qs = new URLSearchParams();
  if (timeframe) qs.set('timeframe', timeframe);
  if (result) qs.set('result', result);
  if (touch) qs.set('touch', touch);
  if (search.trim()) qs.set('search', search.trim());

  const { data, loading, reload } = useFetch<any>(
    slug ? `/library/folders/${slug}?${qs}` : null, [slug, timeframe, result, touch, search]
  );

  // Deep link from Home / a day: ?open=<exampleId>
  useEffect(() => {
    const id = params.get('open');
    if (id && data) {
      const found = data.examples.find((e: any) => e.id === id);
      if (found) setOpened(found);
      params.delete('open');
      setParams(params, { replace: true });
    }
  }, [data]);

  if (loading && !data) return <LoadingPane />;
  if (!data) return null;

  const { folder, examples, summary } = data;
  const filtered = timeframe || result || touch || search.trim();

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => navigate('/library')}
            className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
            <ArrowLeft size={12} /> Level Library
          </button>
        }
        title={folder.name}
        subtitle={folder.description}
        actions={
          <>
            <Button size="sm" icon={<Pencil size={12} />}
              onClick={() => { setRename({ name: folder.name, description: folder.description }); setRenaming(true); }}>
              Edit folder
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setFileOpen(true); }}>
              File an example
            </Button>
          </>
        }
      >
        {/* -------------------------------------------------------- summary -- */}
        {summary.total > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Examples" value={summary.total} />
            <Stat label="Held" value={summary.held} sub={`${summary.failed} failed`} />
            <Stat label="Held rate" value={summary.held_pct != null ? `${summary.held_pct}%` : DASH}
              sub={`${summary.with_result} with a result`} />
            <Stat label="Avg drawdown" value={pts(summary.avg_drawdown)} sub={`median ${pts(summary.median_drawdown)}`} />
            <Stat label="Avg reaction" value={pts(summary.avg_reaction)} sub={`median ${pts(summary.median_reaction)}`} />
            <div className="flex gap-4 border-l border-ink-700 pl-6">
              {summary.by_touch.filter((t: any) => t.total > 0).map((t: any) => (
                <Stat key={t.touch} label={`Touch ${t.touch}`}
                  value={t.held_pct != null ? `${t.held_pct}%` : DASH}
                  sub={`${t.held}/${t.with_result} held`} />
              ))}
            </div>
          </div>
        )}
      </PageHeader>

      <Page className="space-y-4">
        {/* --------------------------------------------------------- filters -- */}
        {summary.total > 0 && (
          <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="label-xs">Timeframe</span>
              <Segmented
                value={timeframe}
                onChange={(v) => setTimeframe(v === timeframe ? '' : v)}
                options={[
                  { value: '', label: 'All' },
                  ...TIMEFRAMES.filter((t: any) => data.timeframes.includes(t.value))
                    .map((t: any) => ({ value: t.value, label: t.value })),
                ]}
              />
            </div>
            <Select className="w-32" value={result} onChange={(e) => setResult(e.target.value)}
              options={LEVEL_RESULT} placeholder="Any result" />
            <Select className="w-32" value={touch} onChange={(e) => setTouch(e.target.value)}
              options={[
                { value: '1', label: 'Touch 1' }, { value: '2', label: 'Touch 2' },
                { value: '3', label: 'Touch 3' }, { value: '4+', label: 'Touch 4+' },
              ]} placeholder="Any touch" />
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-faint" />
              <Input className="w-44 pl-6" placeholder="Price or text…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {filtered && (
                <span className="text-[11px] text-fg-faint">
                  {examples.length} of {summary.total}
                </span>
              )}
              <Segmented
                size="xs"
                value={view}
                onChange={(v) => setView(v as any)}
                options={[{ value: 'grid', label: 'Charts' }, { value: 'table', label: 'Table' }]}
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- the gallery */}
        {examples.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={<LayoutGrid size={26} />}
              title={filtered ? 'Nothing matches those filters' : 'No examples filed yet'}
              hint={
                filtered
                  ? 'Clear a filter to see the rest of the folder.'
                  : 'Every time you test this level, file what happened: the drawdown, the reaction, and a before and after chart.'
              }
              action={
                !filtered && (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setFileOpen(true)}>
                    File the first one
                  </Button>
                )
              }
            />
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {examples.map((e: any) => (
              <button key={e.id} onClick={() => setOpened(e)} className="group text-left">
                <ChartThumb
                  filename={e.screenshots?.[0]?.filename}
                  alt={e.what_happened ?? ''}
                  badge={e.result ? <Badge tone={RESULT_TONE[e.result] ?? 'muted'}>{labelOf(LEVEL_RESULT, e.result)}</Badge> : undefined}
                />
                <div className="mt-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tnum text-[13px] font-semibold text-fg group-hover:text-accent">
                      {e.level_price != null ? pts(e.level_price) : DASH}
                    </span>
                    <span className="text-[10.5px] text-fg-faint">
                      {e.timeframe}{e.touch_number != null ? ` · touch ${e.touch_number}` : ''}
                    </span>
                  </div>
                  <div className="tnum mt-0.5 flex flex-wrap gap-x-2.5 text-[10.5px] text-fg-faint">
                    {e.occurred_on && <span>{shortDate(e.occurred_on)}</span>}
                    {e.drawdown != null && <span>DD {pts(e.drawdown)}</span>}
                    {e.reaction != null && <span>React {pts(e.reaction)}</span>}
                    {e.screenshots?.length > 1 && <span>{e.screenshots.length} charts</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead className="bg-ink-850">
                  <tr>
                    <TH>Date</TH><TH>Instr.</TH><TH>TF</TH><TH align="right">Level</TH>
                    <TH align="right">Touch</TH><TH align="right">Drawdown</TH><TH align="right">Reaction</TH>
                    <TH>Result</TH><TH>What happened</TH><TH align="right">Charts</TH>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((e: any) => (
                    <tr key={e.id} className="cursor-pointer hover:bg-ink-850" onClick={() => setOpened(e)}>
                      <TD className="whitespace-nowrap text-fg-muted">{e.occurred_on ? shortDate(e.occurred_on) : DASH}</TD>
                      <TD mono>{e.instrument ?? DASH}</TD>
                      <TD className="text-fg-muted">{e.timeframe ?? DASH}</TD>
                      <TD align="right" mono className="font-semibold">{e.level_price != null ? pts(e.level_price) : DASH}</TD>
                      <TD align="right" mono>{e.touch_number ?? DASH}</TD>
                      <TD align="right" mono>{pts(e.drawdown)}</TD>
                      <TD align="right" mono>{pts(e.reaction)}</TD>
                      <TD>{e.result ? <Badge tone={RESULT_TONE[e.result] ?? 'muted'}>{labelOf(LEVEL_RESULT, e.result)}</Badge> : DASH}</TD>
                      <TD className="max-w-[22rem] truncate text-fg-muted">{e.what_happened ?? DASH}</TD>
                      <TD align="right" mono className="text-fg-faint">{e.screenshots?.length ?? 0}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}

        {/* --------------------------------------------- timeframe comparison */}
        {summary.by_timeframe.length > 1 && (
          <Card
            title="Across timeframes"
            subtitle="Does this level behave differently depending on what you watch it on?"
            dense
          >
            <TableWrap>
              <table className="w-full border-collapse">
                <thead className="bg-ink-850">
                  <tr>
                    <TH>Timeframe</TH><TH align="right">Examples</TH><TH align="right">Held</TH>
                    <TH align="right">Held rate</TH><TH align="right">Median drawdown</TH><TH align="right">Median reaction</TH>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_timeframe.map((t: any) => (
                    <tr key={t.timeframe} className="hover:bg-ink-850/60">
                      <TD className="font-medium">{labelOf(TIMEFRAMES, t.timeframe)}</TD>
                      <TD align="right" mono>{t.total}</TD>
                      <TD align="right" mono>{t.held}/{t.with_result}</TD>
                      <TD align="right" mono className="font-semibold">
                        {t.held_pct != null ? `${t.held_pct}%` : DASH}
                      </TD>
                      <TD align="right" mono>{pts(t.median_drawdown)}</TD>
                      <TD align="right" mono>{pts(t.median_reaction)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        )}
      </Page>

      {opened && (
        <ExampleDetail
          example={opened}
          onClose={() => setOpened(null)}
          onChanged={reload}
          onEdit={() => { setEditing(opened); setOpened(null); setFileOpen(true); }}
        />
      )}

      <LevelExampleForm
        open={fileOpen}
        onClose={() => { setFileOpen(false); setEditing(null); }}
        folderId={folder.id}
        example={editing}
        onSaved={reload}
      />

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        width="sm"
        title="Edit folder"
        footer={
          <>
            <ConfirmButton variant="ghost" confirmLabel="Delete folder?"
              onConfirm={async () => {
                try {
                  await api.del(`/library/folders/${folder.id}`);
                  toast('info', 'Folder deleted.');
                  navigate('/library');
                } catch (e: any) { toast('bad', e.message); }
              }}>
              <Trash2 size={12} />
            </ConfirmButton>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary"
              onClick={async () => {
                const res = await api.patch(`/library/folders/${folder.id}`, rename);
                toast('good', 'Folder updated.');
                setRenaming(false);
                navigate(`/library/${res.slug}`, { replace: true });
              }}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={rename.name ?? ''} onChange={(e) => setRename({ ...rename, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={rename.description ?? ''}
              onChange={(e) => setRename({ ...rename, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
