import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Archive as ArchiveIcon, Lock, Search, ArrowRight, Trash2 } from 'lucide-react';
import { Page, PageHeader } from '@/components/Layout';
import {
  Badge, Button, ConfirmButton, EmptyState, Input, LoadingPane, Segmented,
  TableWrap, TD, TH, useToast,
} from '@/components/ui';
import { useFetch } from '@/lib/store';
import { api } from '@/lib/api';
import { DASH, longDate } from '@/lib/format';
import { DAY_TYPE, SESSION_STATUS, labelOf } from '@shared/domain.js';

/**
 * Every historical day studied, and what came out of it.
 */
export default function Archive() {
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (search.trim()) qs.set('search', search.trim());
  const { data, loading, reload } = useFetch<any[]>(`/days?${qs}`, [status, search]);

  if (loading && !data) return <LoadingPane />;

  return (
    <>
      <PageHeader
        title="Backtest Archive"
        subtitle="Every historical day you have studied, with what it produced."
        actions={
          <>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
              <Input className="w-52 pl-7" placeholder="Instrument, title, notes…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Segmented
              value={status}
              onChange={(v) => setStatus(v === status ? '' : v)}
              options={[
                { value: '', label: 'All' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'LOCKED', label: 'Locked' },
                { value: 'REVIEWED', label: 'Reviewed' },
              ]}
            />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => navigate('/predict')}>
              New prediction
            </Button>
          </>
        }
      />

      <Page>
        {!data?.length ? (
          <div className="panel">
            <EmptyState
              icon={<ArchiveIcon size={28} />}
              title={status || search ? 'Nothing matches' : 'No days studied yet'}
              hint={
                status || search
                  ? 'Try clearing the filters.'
                  : 'Each day you predict and review is filed here, along with the levels and examples it produced.'
              }
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => navigate('/predict')}>
                  Start a prediction
                </Button>
              }
            />
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead className="bg-ink-850">
                  <tr>
                    <TH>Date</TH><TH>Instrument</TH><TH>TF</TH>
                    <TH>Expected</TH><TH>Actual</TH><TH>Status</TH>
                    <TH align="right">Levels</TH><TH align="right">Examples</TH>
                    <TH align="right">Charts</TH><TH>Notes</TH><TH />
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => {
                    const match = d.actual_day_type && d.actual_day_type === d.expected_day_type;
                    return (
                      <tr key={d.id} className="cursor-pointer hover:bg-ink-850"
                        onClick={() => navigate(`/day/${d.id}`)}>
                        <TD>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-fg">{longDate(d.date)}</span>
                            {d.locked_at && <Lock size={10} className="text-[#4dd39b]" />}
                          </span>
                          {d.title && <div className="text-[10.5px] text-fg-faint">{d.title}</div>}
                        </TD>
                        <TD mono className="font-semibold">{d.instrument}</TD>
                        <TD className="text-fg-muted">{d.timeframe}</TD>
                        <TD className="text-fg-muted">
                          {d.expected_day_type ? labelOf(DAY_TYPE, d.expected_day_type) : DASH}
                        </TD>
                        <TD className={clsx(match ? 'font-medium text-[#4dd39b]'
                          : d.actual_day_type ? 'text-[#f5787f]' : 'text-fg-muted')}>
                          {d.actual_day_type ? labelOf(DAY_TYPE, d.actual_day_type) : DASH}
                        </TD>
                        <TD>
                          <Badge tone={d.status === 'REVIEWED' ? 'good' : d.status === 'LOCKED' ? 'accent' : 'neutral'}>
                            {labelOf(SESSION_STATUS, d.status)}
                          </Badge>
                        </TD>
                        <TD align="right" mono>{d.level_count || DASH}</TD>
                        <TD align="right" mono>{d.example_count || DASH}</TD>
                        <TD align="right" mono className="text-fg-faint">{d.screenshot_count || DASH}</TD>
                        <TD className="max-w-[16rem] truncate text-fg-faint">{d.notes ?? DASH}</TD>
                        <TD align="right">
                          <span onClick={(e) => e.stopPropagation()} className="flex items-center justify-end gap-1">
                            <ConfirmButton size="xs" variant="ghost" confirmLabel="Delete?"
                              onConfirm={async () => {
                                await api.del(`/days/${d.id}`);
                                toast('info', 'Day deleted.');
                                reload();
                              }}>
                              <Trash2 size={11} />
                            </ConfirmButton>
                            <ArrowRight size={12} className="text-ink-500" />
                          </span>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}
      </Page>
    </>
  );
}
