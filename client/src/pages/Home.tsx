import React from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  CalendarCheck, FolderOpen, Images, Archive, ArrowRight, Lock,
} from 'lucide-react';
import { Page } from '@/components/Layout';
import { Badge, LoadingPane } from '@/components/ui';
import { ChartThumb } from '@/components/Charts';
import { LevelCard } from '@/components/LevelCard';
import { useFetch } from '@/lib/store';
import { DASH, longDate, pts, shortDate } from '@/lib/format';
import { DAY_TYPE, labelOf } from '@shared/domain.js';

const SECTIONS = [
  {
    to: '/predict',
    icon: CalendarCheck,
    title: 'Daily Prediction',
    blurb: 'Test your ability to read a historical day before seeing the outcome.',
    countKey: 'days',
    countLabel: 'days studied',
  },
  {
    to: '/library',
    icon: FolderOpen,
    title: 'Level Library',
    blurb: 'Certify the price levels you trust, and how much room and profit they give.',
    countKey: 'levels',
    countLabel: 'certified levels',
  },
  {
    to: '/examples',
    icon: Images,
    title: 'Market Examples',
    blurb: 'Build your visual textbook of ranges, trends, candles and market structure.',
    countKey: 'market_examples',
    countLabel: 'examples filed',
  },
  {
    to: '/archive',
    icon: Archive,
    title: 'Backtest Archive',
    blurb: "Review every historical day you've studied.",
    countKey: 'days_reviewed',
    countLabel: 'days reviewed',
  },
];

function Row({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-fg">{title}</h2>
        {onMore && (
          <button onClick={onMore} className="flex items-center gap-1 text-[11.5px] text-fg-faint hover:text-accent">
            See all <ArrowRight size={11} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { data, loading } = useFetch<any>('/home');

  if (loading && !data) return <LoadingPane label="Opening the cabinet" />;
  if (!data) return null;

  const c = data.counts;
  const empty = c.days === 0 && c.levels === 0 && c.market_examples === 0;

  return (
    <>
      <div className="border-b border-ink-700 bg-ink-900/60 px-6 py-6">
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight">LevelForge</h1>
        <p className="mt-1 text-[13px] text-fg-faint">Trading Research Library</p>
      </div>

      <Page className="space-y-7">
        {/* ------------------------------------------------ the four things -- */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <button
              key={s.to}
              onClick={() => navigate(s.to)}
              className="panel group flex items-start gap-4 px-5 py-4 text-left transition-colors hover:border-ink-500"
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-850 text-accent">
                <s.icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-fg">{s.title}</span>
                  <ArrowRight size={14} className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-fg-faint">{s.blurb}</p>
                <p className="tnum mt-2 text-[11.5px] text-fg-muted">
                  <span className="font-semibold text-fg">{c[s.countKey]}</span> {s.countLabel}
                </p>
              </div>
            </button>
          ))}
        </div>

        {empty ? (
          <div className="panel px-6 py-10 text-center">
            <p className="text-[13px] font-medium text-fg-muted">The cabinet is empty</p>
            <p className="mx-auto mt-1.5 max-w-lg text-[12px] leading-relaxed text-fg-faint">
              Start with a Daily Prediction, or go straight to the Level Library and certify your
              first level. Everything here is yours to name — nothing is pre-filled.
            </p>
          </div>
        ) : (
          <>
            {/* -------------------------------------- recent certified levels -- */}
            {data.recent_levels.length > 0 && (
              <Row title="Recently certified levels" onMore={() => navigate('/library')}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.recent_levels.map((l: any) => (
                    <LevelCard key={l.id} level={l} onClick={() => navigate(`/library/${l.id}`)} />
                  ))}
                </div>
              </Row>
            )}

            {/* ------------------------------------ recent market examples -- */}
            {data.recent_market_examples.length > 0 && (
              <Row title="Recent market examples" onMore={() => navigate('/examples')}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.recent_market_examples.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/examples/${m.category_slug}?open=${m.id}`)}
                      className="group text-left"
                    >
                      <ChartThumb
                        filename={m.thumb}
                        alt={m.title}
                        badge={<Badge tone="muted">{m.category_name}</Badge>}
                      />
                      <div className="mt-1.5">
                        <div className="truncate text-[12px] font-medium text-fg group-hover:text-accent">
                          {m.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-fg-faint">
                          {m.instrument && <span className="tnum">{m.instrument}</span>}
                          {m.timeframe && <span>{m.timeframe}</span>}
                          {m.occurred_on && <span>{shortDate(m.occurred_on)}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Row>
            )}

            {/* --------------------------------------------- recent days --- */}
            {data.recent_days.length > 0 && (
              <Row title="Recent backtests" onMore={() => navigate('/archive')}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recent_days.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/day/${d.id}`)}
                      className="panel group flex gap-3 p-2.5 text-left transition-colors hover:border-ink-500"
                    >
                      <ChartThumb filename={d.thumb} ratio="aspect-[4/3]" className="w-28 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium text-fg group-hover:text-accent">
                            {longDate(d.date)}
                          </span>
                          {d.locked_at && <Lock size={10} className="shrink-0 text-[#4dd39b]" />}
                        </div>
                        <div className="tnum mt-0.5 text-[10.5px] text-fg-faint">
                          {d.instrument} · {d.timeframe}
                        </div>
                        <div className="mt-1.5 space-y-0.5 text-[10.5px]">
                          <div className="flex justify-between gap-2">
                            <span className="text-fg-faint">Predicted</span>
                            <span className="text-fg-muted">
                              {d.expected_day_type ? labelOf(DAY_TYPE, d.expected_day_type) : DASH}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-fg-faint">Actual</span>
                            <span className={clsx(
                              d.actual_day_type && d.actual_day_type === d.expected_day_type
                                ? 'text-[#4dd39b]' : 'text-fg-muted'
                            )}>
                              {d.actual_day_type ? labelOf(DAY_TYPE, d.actual_day_type) : DASH}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Row>
            )}
          </>
        )}
      </Page>
    </>
  );
}
