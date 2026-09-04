import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Images, FolderPlus } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Button, EmptyState, Field, Input, LoadingPane, Modal, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb } from '@/components/Charts';
import { MarketExampleForm } from '@/components/MarketExampleForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';

/**
 * The visual textbook, one chapter per category.
 */
export default function MarketExamples() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, reload } = useFetch<any[]>('/examples/categories');
  const [newCat, setNewCat] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [f, setF] = useState<any>({});

  if (loading && !data) return <LoadingPane />;

  const total = (data ?? []).reduce((a, c) => a + c.example_count, 0);

  return (
    <>
      <PageHeader
        title="Market Examples"
        subtitle={
          total > 0
            ? `${total} example${total === 1 ? '' : 's'} across ${data!.length} categor${data!.length === 1 ? 'y' : 'ies'}.`
            : 'Build your personal visual library of market structure, price action, and trading concepts.'
        }
        actions={
          <>
            <Button icon={<FolderPlus size={13} />} onClick={() => { setF({}); setNewCat(true); }}>
              New category
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setSaveOpen(true)}>
              Save an example
            </Button>
          </>
        }
      />

      <Page>
        {!data?.length ? (
          <div className="panel">
            <EmptyState
              icon={<Images size={28} />}
              title="Build your personal visual library"
              hint="Market structure, price action, and trading concepts — organised the way you think about them. Create a category and start filing charts into it."
              action={
                <Button variant="primary" icon={<FolderPlus size={14} />} onClick={() => { setF({}); setNewCat(true); }}>
                  New Category
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/examples/${c.slug}`)}
                className="panel group overflow-hidden text-left transition-colors hover:border-ink-500"
              >
                <ChartThumb filename={c.thumb} ratio="aspect-[16/9]" className="rounded-none border-0 border-b border-ink-700" />
                <div className="px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold leading-tight text-fg group-hover:text-accent">
                      {c.name}
                    </span>
                    <span className="tnum shrink-0 rounded bg-ink-750 px-1.5 py-0.5 text-[10.5px] text-fg-muted">
                      {c.example_count}
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-faint">{c.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Page>

      <Modal
        open={newCat}
        onClose={() => setNewCat(false)}
        width="sm"
        title="New category"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewCat(false)}>Cancel</Button>
            <Button variant="primary" disabled={!f.name?.trim()}
              onClick={async () => {
                try {
                  await api.post('/examples/categories', f);
                  toast('good', 'Category created.');
                  setNewCat(false);
                  reload();
                } catch (e: any) { toast('bad', e.message); }
              }}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input autoFocus value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Opening Drives" />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={f.description ?? ''}
              onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <MarketExampleForm
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        categories={data}
        onSaved={reload}
      />
    </>
  );
}
