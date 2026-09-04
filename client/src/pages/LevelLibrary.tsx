import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, FolderPlus } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Button, EmptyState, Field, Input, LoadingPane, Modal, Textarea, useToast,
} from '@/components/ui';
import { ChartThumb } from '@/components/Charts';
import { LevelExampleForm } from '@/components/LevelExampleForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';

/**
 * The filing cabinet itself: one drawer per level type.
 *
 * Each drawer shows its most recent chart, so the library is browsable by eye
 * rather than by reading a list of names.
 */
export default function LevelLibrary() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, reload } = useFetch<any[]>('/library/folders');
  const [newFolder, setNewFolder] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [f, setF] = useState<any>({});

  if (loading && !data) return <LoadingPane />;

  const total = (data ?? []).reduce((a, x) => a + x.example_count, 0);

  return (
    <>
      <PageHeader
        title="Level Library"
        subtitle={
          total > 0
            ? `${total} example${total === 1 ? '' : 's'} filed across ${data!.length} level type${data!.length === 1 ? '' : 's'}.`
            : 'Store and compare every occurrence of your predictive trading levels.'
        }
        actions={
          <>
            <Button icon={<FolderPlus size={13} />} onClick={() => { setF({}); setNewFolder(true); }}>
              New Folder
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setFileOpen(true)}>
              File an example
            </Button>
          </>
        }
      />

      <Page>
        {!data?.length ? (
          <div className="panel">
            <EmptyState
              icon={<FolderOpen size={28} />}
              title="Store and compare every occurrence of your levels"
              hint="A folder is one level type you research — named however you think about it. Create a folder and file an example every time you test it."
              action={
                <Button variant="primary" icon={<FolderPlus size={14} />} onClick={() => { setF({}); setNewFolder(true); }}>
                  New Folder
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((folder) => (
              <button
                key={folder.id}
                onClick={() => navigate(`/library/${folder.slug}`)}
                className="panel group overflow-hidden text-left transition-colors hover:border-ink-500"
              >
                <ChartThumb filename={folder.thumb} ratio="aspect-[16/9]" className="rounded-none border-0 border-b border-ink-700" />
                <div className="px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold leading-tight text-fg group-hover:text-accent">
                      {folder.name}
                    </span>
                    <span className="tnum shrink-0 rounded bg-ink-750 px-1.5 py-0.5 text-[10.5px] text-fg-muted">
                      {folder.example_count}
                    </span>
                  </div>
                  {folder.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-faint">
                      {folder.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Page>

      <Modal
        open={newFolder}
        onClose={() => setNewFolder(false)}
        width="sm"
        title="New level folder"
        subtitle="A level type you want to collect examples of."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolder(false)}>Cancel</Button>
            <Button variant="primary" disabled={!f.name?.trim()}
              onClick={async () => {
                try {
                  await api.post('/library/folders', f);
                  toast('good', 'Folder created.');
                  setNewFolder(false);
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
              placeholder="4H Previous Candle Low" />
          </Field>
          <Field label="Description" hint="Optional — what counts as this level.">
            <Textarea rows={2} value={f.description ?? ''}
              onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <LevelExampleForm
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        folders={data}
        onSaved={reload}
      />
    </>
  );
}
