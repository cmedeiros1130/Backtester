import React, { useEffect, useState } from 'react';
import { Save, HardDrive, FolderOpen, Images, CalendarCheck, ImageIcon } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import { Button, Card, Field, Input, Select, useToast } from '@/components/ui';
import { useApp, useFetch } from '@/lib/store';
import { COMMON_INSTRUMENTS, TIMEFRAMES } from '@shared/domain.js';

export default function Settings() {
  const { settings, save } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const { data: health } = useFetch<any>('/health');
  const { data: home } = useFetch<any>('/home');

  useEffect(() => setDraft(settings), [settings]);

  const counts = home?.counts;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Local-first. Everything lives in a SQLite file on this machine — nothing is uploaded anywhere."
      />

      <Page className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Defaults" subtitle="Pre-filled when you start something new.">
            <div className="space-y-3">
              <Field label="Default instrument">
                <Input
                  list="settings-instruments"
                  value={draft.default_instrument ?? ''}
                  onChange={(e) => setDraft({ ...draft, default_instrument: e.target.value.toUpperCase() })}
                />
                <datalist id="settings-instruments">
                  {COMMON_INSTRUMENTS.map((i: string) => <option key={i} value={i} />)}
                </datalist>
              </Field>
              <Field label="Default timeframe">
                <Select
                  value={draft.default_timeframe ?? '5m'}
                  onChange={(e) => setDraft({ ...draft, default_timeframe: e.target.value })}
                  options={TIMEFRAMES}
                />
              </Field>
              <Button
                variant="primary" icon={<Save size={13} />} loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await save(draft);
                    toast('good', 'Settings saved.');
                  } catch (e: any) { toast('bad', e.message); } finally { setBusy(false); }
                }}
              >
                Save defaults
              </Button>
            </div>
          </Card>

          <Card title="What is in the cabinet">
            {counts ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ['Days studied', counts.days, CalendarCheck],
                  ['Certified levels', counts.levels, FolderOpen],
                  ['Key levels', counts.key_levels, FolderOpen],
                  ['Categories', counts.categories, Images],
                  ['Market examples', counts.market_examples, Images],
                  ['Charts stored', counts.screenshots, ImageIcon],
                ].map(([label, n, Icon]: any) => (
                  <div key={label} className="rounded-md border border-ink-750 bg-ink-900/50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} className="text-fg-faint" />
                      <span className="label-xs">{label}</span>
                    </div>
                    <div className="tnum mt-1 text-[18px] font-semibold">{n}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <Card title="Storage" subtitle="Where your research lives.">
          <div className="flex items-start gap-2.5 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2.5">
            <HardDrive size={15} className="mt-0.5 shrink-0 text-fg-faint" />
            <div className="min-w-0">
              <div className="text-[11.5px] font-medium text-fg-muted">Data directory</div>
              <code className="mt-0.5 block break-all text-[11px] text-fg-faint">
                {health?.data_dir ?? '—'}
              </code>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-faint">
                Holds <code>levelforge.db</code> — every certified level, example, prediction and review — and{' '}
                <code>uploads/</code>, which holds every chart you have saved. Back up that one folder
                and you have backed up the whole cabinet.
              </p>
            </div>
          </div>
        </Card>
      </Page>
    </>
  );
}
