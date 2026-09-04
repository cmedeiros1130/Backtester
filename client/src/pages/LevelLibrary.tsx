import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Search, Layers } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import { Button, EmptyState, Input, LoadingPane, Segmented, Select } from '@/components/ui';
import { LevelCard } from '@/components/LevelCard';
import { CertifyLevelForm } from '@/components/CertifyLevelForm';
import { useFetch } from '@/lib/store';
import { LEVEL_CLASSIFICATION, LEVEL_DIRECTION, LEVEL_IMPORTANCE } from '@shared/domain.js';

/**
 * The certified level database.
 *
 * Key levels sort above watch-out areas and major above minor, so the levels
 * you actually trade are the ones you see first.
 */
export default function LevelLibrary() {
  const navigate = useNavigate();
  const [certifying, setCertifying] = useState(false);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [classification, setClassification] = useState('');
  const [importance, setImportance] = useState('');

  const qs = new URLSearchParams();
  if (search.trim()) qs.set('search', search.trim());
  if (direction) qs.set('direction', direction);
  if (classification) qs.set('classification', classification);
  if (importance) qs.set('importance', importance);

  const { data, loading, reload } = useFetch<any[]>(
    `/library/levels?${qs}`, [search, direction, classification, importance]
  );

  const filtering = !!(search.trim() || direction || classification || importance);
  const keyCount = (data ?? []).filter((l) => l.classification === 'KEY_LEVEL').length;

  return (
    <>
      <PageHeader
        title="Level Library"
        subtitle={
          data?.length
            ? `${data.length} certified level${data.length === 1 ? '' : 's'}${keyCount ? ` · ${keyCount} key level${keyCount === 1 ? '' : 's'}` : ''}. All figures in points.`
            : 'Levels you have backtested and reached a verdict on.'
        }
        actions={
          <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => setCertifying(true)}>
            Certify a Level
          </Button>
        }
      />

      <Page className="space-y-4">
        {loading && !data ? (
          <LoadingPane />
        ) : !data?.length && !filtering ? (
          <div className="panel">
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="No certified levels yet"
              hint="After you backtest a level, record the verdict here: where it came from, whether it buys or sells, how it behaves on first touch, and how much room and profit it historically gives."
              action={
                <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => setCertifying(true)}>
                  Certify a Level
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
                <Input
                  className="w-52 pl-7"
                  placeholder="Price, source, notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Segmented
                value={direction}
                onChange={(v) => setDirection(v === direction ? '' : v)}
                options={[{ value: '', label: 'All' },
                  ...LEVEL_DIRECTION.map((d: any) => ({ value: d.value, label: d.label }))]}
              />
              <Select
                className="w-40"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                options={LEVEL_CLASSIFICATION}
                placeholder="Any classification"
              />
              <Select
                className="w-32"
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                options={LEVEL_IMPORTANCE}
                placeholder="Any importance"
              />
              {filtering && (
                <span className="ml-auto text-[11px] text-fg-faint">{data?.length ?? 0} shown</span>
              )}
            </div>

            {!data?.length ? (
              <div className="panel">
                <EmptyState
                  icon={<Layers size={24} />}
                  title="No levels match those filters"
                  hint="Try clearing one of them."
                />
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.map((level) => (
                  <LevelCard key={level.id} level={level} onClick={() => navigate(`/library/${level.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </Page>

      <CertifyLevelForm
        open={certifying}
        onClose={() => setCertifying(false)}
        onSaved={reload}
      />
    </>
  );
}
