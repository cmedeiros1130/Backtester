import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Button, Card, ConfirmButton, LoadingPane, Prose, SectionLabel, useToast,
} from '@/components/ui';
import { Screenshots } from '@/components/Charts';
import { LevelBadges } from '@/components/LevelCard';
import { CertifyLevelForm } from '@/components/CertifyLevelForm';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { DASH, longDate, pts } from '@/lib/format';
import { LEVEL_DIRECTION, labelOf } from '@shared/domain.js';

const DIR_STYLE: Record<string, string> = {
  BUY: 'text-[#4dd39b]', SELL: 'text-[#f5787f]', BOTH: 'text-[#8fb8ff]',
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="mt-0.5 text-[13px] text-fg">{value}</div>
    </div>
  );
}

/** One side's three numbers, in points. */
function SideBlock({
  side, stop, profit, best,
}: { side: 'BUY' | 'SELL'; stop: any; profit: any; best: any }) {
  return (
    <div className="panel px-4 py-3.5">
      <div className={clsx('text-[12px] font-semibold uppercase tracking-wider', DIR_STYLE[side])}>
        {side}
      </div>
      <dl className="mt-3 space-y-2.5">
        {[
          ['Average stop', stop],
          ['Average profit', profit],
          ['Best profit', best],
        ].map(([label, v]: any) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-[11.5px] text-fg-muted">{label}</dt>
            <dd className="tnum text-[17px] font-semibold text-fg">
              {v != null ? <>{pts(v)}<span className="ml-1 text-[10px] font-normal text-fg-faint">pts</span></> : DASH}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function LevelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: level, loading, reload } = useFetch<any>(id ? `/library/levels/${id}` : null, [id]);
  const [editing, setEditing] = useState(false);

  if (loading && !level) return <LoadingPane />;
  if (!level) return null;

  const showBuy = level.direction === 'BUY' || level.direction === 'BOTH';
  const showSell = level.direction === 'SELL' || level.direction === 'BOTH';

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => navigate('/library')}
            className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
            <ArrowLeft size={12} /> Level Library
          </button>
        }
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            <span className="tnum text-[30px] font-semibold tracking-tight">{pts(level.level_price)}</span>
            <span className="tnum text-[14px] text-fg-faint">
              {[level.instrument, level.timeframe].filter(Boolean).join(' • ')}
            </span>
          </span>
        }
        subtitle={level.source || undefined}
        actions={
          <>
            <Button size="sm" icon={<Pencil size={12} />} onClick={() => setEditing(true)}>Edit</Button>
            <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete this level?"
              onConfirm={async () => {
                await api.del(`/library/levels/${level.id}`);
                toast('info', 'Level deleted.');
                navigate('/library');
              }}>
              <Trash2 size={12} />
            </ConfirmButton>
          </>
        }
      >
        <div className="mt-3.5">
          <LevelBadges level={level} size="lg" />
        </div>
      </PageHeader>

      <Page className="space-y-4">
        {/* ----------------------------------------------------- the facts -- */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Source" value={level.source || DASH} />
            <Fact label="Timeframe" value={level.timeframe || DASH} />
            <Fact
              label="Direction"
              value={
                <span className={clsx('font-semibold', DIR_STYLE[level.direction])}>
                  {level.direction === 'BOTH' ? 'Buy + Sell' : labelOf(LEVEL_DIRECTION, level.direction)}
                </span>
              }
            />
            <Fact
              label="First touch"
              value={
                level.first_touch_pct != null
                  ? <span className="tnum text-[17px] font-semibold">{Math.round(level.first_touch_pct)}%</span>
                  : DASH
              }
            />
            <Fact
              label="Sample size"
              value={
                level.sample_size != null
                  ? <span className="tnum">Tested {level.sample_size} times</span>
                  : DASH
              }
            />
            <Fact label="Period tested" value={level.period_tested || DASH} />
          </div>

          {level.first_touch_note && (
            <p className="mt-3.5 border-t border-ink-750 pt-3 text-[12px] leading-relaxed text-fg-muted">
              {level.first_touch_note}
            </p>
          )}
        </Card>

        {/* ------------------------------------------------------ the stats -- */}
        <div className={clsx('grid gap-4', showBuy && showSell ? 'sm:grid-cols-2' : '')}>
          {showBuy && (
            <SideBlock side="BUY" stop={level.buy_avg_stop} profit={level.buy_avg_profit} best={level.buy_best_profit} />
          )}
          {showSell && (
            <SideBlock side="SELL" stop={level.sell_avg_stop} profit={level.sell_avg_profit} best={level.sell_best_profit} />
          )}
        </div>

        {/* -------------------------------------------------------- charts -- */}
        <Card title="Charts / evidence" subtitle="What convinced you to certify this level.">
          <Screenshots
            entityType="CERTIFIED_LEVEL"
            entityId={level.id}
            defaultCategory="MAIN"
            shots={level.screenshots ?? []}
            onChange={reload}
            columns={2}
          />
        </Card>

        {/* --------------------------------------------------------- notes -- */}
        <Card title="Notes">
          <Prose label="">{level.notes}</Prose>
          {level.session && (
            <button
              onClick={() => navigate(`/day/${level.session.id}`)}
              className="mt-3 text-[11.5px] text-accent hover:underline"
            >
              Certified from the {longDate(level.session.date)} backtest →
            </button>
          )}
        </Card>
      </Page>

      <CertifyLevelForm
        open={editing}
        onClose={() => setEditing(false)}
        level={level}
        onSaved={reload}
      />
    </>
  );
}
