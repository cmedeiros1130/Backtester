import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchX, ArrowRight } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import { Badge, EmptyState, LoadingPane, SectionLabel } from '@/components/ui';
import { ChartThumb } from '@/components/Charts';
import { LevelCard } from '@/components/LevelCard';
import { useFetch } from '@/lib/store';
import { DASH, longDate, pts, shortDate } from '@/lib/format';
import { DAY_TYPE, SESSION_STATUS, labelOf } from '@shared/domain.js';

/**
 * One result page across the whole cabinet: levels, examples and days together.
 */
export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const { data, loading } = useFetch<any>(q ? `/search?q=${encodeURIComponent(q)}` : null, [q]);

  if (loading && !data) return <LoadingPane label={`Searching for “${q}”`} />;

  return (
    <>
      <PageHeader
        title={<>Results for “{q}”</>}
        subtitle={data ? `${data.total} match${data.total === 1 ? '' : 'es'} across levels, examples and days.` : undefined}
      />

      <Page className="space-y-7">
        {!data || data.total === 0 ? (
          <div className="panel">
            <EmptyState
              icon={<SearchX size={26} />}
              title="Nothing found"
              hint="Search matches level prices, sources, example titles, the notes you wrote and any tags you attached."
            />
          </div>
        ) : (
          <>
            {data.levels.length > 0 && (
              <section>
                <SectionLabel>Certified levels ({data.levels.length})</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.levels.map((l: any) => (
                    <LevelCard key={l.id} level={l} onClick={() => navigate(`/library/${l.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {data.market_examples.length > 0 && (
              <section>
                <SectionLabel>Market examples ({data.market_examples.length})</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.market_examples.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/examples/${m.category_slug}?open=${m.id}`)}
                      className="group text-left"
                    >
                      <ChartThumb filename={m.thumb} badge={<Badge tone="muted">{m.category_name}</Badge>} />
                      <div className="mt-1.5 truncate text-[12px] font-medium text-fg group-hover:text-accent">
                        {m.title}
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-[10.5px] text-fg-faint">
                        {m.instrument && <span className="tnum">{m.instrument}</span>}
                        {m.timeframe && <span>{m.timeframe}</span>}
                        {m.occurred_on && <span>{shortDate(m.occurred_on)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.days.length > 0 && (
              <section>
                <SectionLabel>Days ({data.days.length})</SectionLabel>
                <div className="space-y-1.5">
                  {data.days.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/day/${d.id}`)}
                      className="panel group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:border-ink-500"
                    >
                      <span className="flex flex-wrap items-baseline gap-3">
                        <span className="text-[12.5px] font-medium text-fg group-hover:text-accent">
                          {longDate(d.date)}
                        </span>
                        <span className="tnum text-[11px] text-fg-faint">{d.instrument} · {d.timeframe}</span>
                        {d.title && <span className="text-[11px] text-fg-muted">{d.title}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-[10.5px] text-fg-faint">
                          {d.expected_day_type ? labelOf(DAY_TYPE, d.expected_day_type) : DASH}
                          {d.actual_day_type && ` → ${labelOf(DAY_TYPE, d.actual_day_type)}`}
                        </span>
                        <Badge tone={d.status === 'REVIEWED' ? 'good' : 'neutral'}>
                          {labelOf(SESSION_STATUS, d.status)}
                        </Badge>
                        <ArrowRight size={12} className="text-ink-500" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </Page>
    </>
  );
}
