import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Images } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Badge, Button, ConfirmButton, EmptyState, Field, Input, LoadingPane, Modal,
  Prose, SectionLabel, Segmented, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb, Screenshots } from '@/components/Charts';
import { MarketExampleForm } from '@/components/MarketExampleForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { longDate, shortDate } from '@/lib/format';
import { TIMEFRAMES, labelOf } from '@shared/domain.js';

/** The full textbook page: big chart on top, your writing underneath. */
function ExampleDetail({
  example, onClose, onChanged, onEdit,
}: { example: any; onClose: () => void; onChanged: () => void; onEdit: () => void }) {
  const toast = useToast();
  const { data, reload } = useFetch<any>(example ? `/examples/${example.id}` : null, [example?.id]);
  const m = data ?? example;

  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={m.title}
      subtitle={[m.instrument, m.timeframe, m.occurred_on ? longDate(m.occurred_on) : null]
        .filter(Boolean).join(' · ')}
      footer={
        <>
          <ConfirmButton variant="ghost" confirmLabel="Delete this example?"
            onConfirm={async () => {
              await api.del(`/examples/${m.id}`);
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
          entityType="MARKET_EXAMPLE"
          entityId={m.id}
          defaultCategory="MAIN"
          shots={m.screenshots ?? []}
          onChange={() => { reload(); onChanged(); }}
          columns={m.screenshots?.length > 1 ? 2 : 1}
        />

        <div className="space-y-3 border-t border-ink-750 pt-3">
          <Prose label="Description">{m.description}</Prose>
          <Prose label="What I see">{m.what_i_see}</Prose>
          <div className="grid gap-3 sm:grid-cols-2">
            <Prose label="What makes it valid">{m.what_makes_valid}</Prose>
            <Prose label="What invalidates it">{m.what_invalidates}</Prose>
          </div>
          <Prose label="What happened next">{m.what_happened_next}</Prose>
          <Prose label="What I learned">{m.what_i_learned}</Prose>

          {m.tags?.length > 0 && (
            <div>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {m.tags.map((t: string) => <Badge key={t} tone="muted">{t}</Badge>)}
              </div>
            </div>
          )}
          {m.session_id && (
            <a href={`/day/${m.session_id}`} className="inline-block text-[11.5px] text-accent hover:underline">
              From the {shortDate(m.session_date)} backtest →
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function ExampleCategory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [timeframe, setTimeframe] = useState('');
  const [search, setSearch] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [opened, setOpened] = useState<any>(null);
  const [renaming, setRenaming] = useState(false);
  const [rename, setRename] = useState<any>({});

  const qs = new URLSearchParams();
  if (timeframe) qs.set('timeframe', timeframe);
  if (search.trim()) qs.set('search', search.trim());

  const { data, loading, reload } = useFetch<any>(
    slug ? `/examples/categories/${slug}?${qs}` : null, [slug, timeframe, search]
  );

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

  const { category, examples } = data;
  const filtered = timeframe || search.trim();

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => navigate('/examples')}
            className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
            <ArrowLeft size={12} /> Market Examples
          </button>
        }
        title={category.name}
        subtitle={category.description}
        actions={
          <>
            <Button size="sm" icon={<Pencil size={12} />}
              onClick={() => { setRename({ name: category.name, description: category.description }); setRenaming(true); }}>
              Edit category
            </Button>
            <Button variant="primary" icon={<Plus size={14} />}
              onClick={() => { setEditing(null); setSaveOpen(true); }}>
              Save an example
            </Button>
          </>
        }
      />

      <Page className="space-y-4">
        {data.total_count > 0 && (
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
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-faint" />
              <Input className="w-52 pl-6" placeholder="Title or notes…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            {filtered && (
              <span className="ml-auto text-[11px] text-fg-faint">
                {examples.length} of {data.total_count}
              </span>
            )}
          </div>
        )}

        {examples.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={<Images size={26} />}
              title={filtered ? 'Nothing matches those filters' : 'No examples in this category yet'}
              hint={
                filtered
                  ? 'Clear the filter to see the rest.'
                  : 'Save a chart with what you see, what makes it valid, what invalidates it, and what happened next.'
              }
              action={
                !filtered && (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setSaveOpen(true)}>
                    Save the first one
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((m: any) => (
              <button key={m.id} onClick={() => setOpened(m)} className="group text-left">
                <ChartThumb
                  filename={m.screenshots?.[0]?.filename}
                  alt={m.title}
                  badge={m.timeframe ? <Badge tone="accent">{m.timeframe}</Badge> : undefined}
                />
                <div className="mt-2">
                  <div className="text-[13px] font-medium leading-tight text-fg group-hover:text-accent">
                    {m.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-fg-faint">
                    {m.instrument && <span className="tnum">{m.instrument}</span>}
                    {m.occurred_on && <span>{shortDate(m.occurred_on)}</span>}
                    {m.screenshots?.length > 1 && <span>{m.screenshots.length} charts</span>}
                  </div>
                  {m.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-muted">{m.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Page>

      {opened && (
        <ExampleDetail
          example={opened}
          onClose={() => setOpened(null)}
          onChanged={reload}
          onEdit={() => { setEditing(opened); setOpened(null); setSaveOpen(true); }}
        />
      )}

      <MarketExampleForm
        open={saveOpen}
        onClose={() => { setSaveOpen(false); setEditing(null); }}
        categoryId={category.id}
        example={editing}
        onSaved={reload}
      />

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        width="sm"
        title="Edit category"
        footer={
          <>
            <ConfirmButton variant="ghost" confirmLabel="Delete category?"
              onConfirm={async () => {
                try {
                  await api.del(`/examples/categories/${category.id}`);
                  toast('info', 'Category deleted.');
                  navigate('/examples');
                } catch (e: any) { toast('bad', e.message); }
              }}>
              <Trash2 size={12} />
            </ConfirmButton>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary"
              onClick={async () => {
                const res = await api.patch(`/examples/categories/${category.id}`, rename);
                toast('good', 'Category updated.');
                setRenaming(false);
                navigate(`/examples/${res.slug}`, { replace: true });
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
