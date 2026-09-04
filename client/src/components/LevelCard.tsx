import React from 'react';
import clsx from 'clsx';
import { Badge } from './ui';
import { ChartThumb } from './Charts';
import { DASH, pts } from '@/lib/format';
import { LEVEL_CLASSIFICATION, LEVEL_IMPORTANCE, labelOf } from '@shared/domain.js';

/**
 * Badges for the two verdicts. A key level and a watch-out area are different
 * things, and major/minor is a separate axis, so they never merge into one
 * combined score.
 */
export function LevelBadges({ level, size = 'sm' }: { level: any; size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {level.classification && (
        <span className={clsx(
          'inline-flex items-center rounded border font-semibold uppercase tracking-wider',
          big ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]',
          level.classification === 'KEY_LEVEL'
            ? 'border-[#25406e] bg-accent-soft text-[#8fb8ff]'
            : 'border-[#4a3a16] bg-[#2d2410] text-[#f5be5a]'
        )}>
          {labelOf(LEVEL_CLASSIFICATION, level.classification)}
        </span>
      )}
      {level.importance && (
        <span className={clsx(
          'inline-flex items-center rounded border font-semibold uppercase tracking-wider',
          big ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]',
          level.importance === 'MAJOR'
            ? 'border-ink-500 bg-ink-700 text-fg'
            : 'border-ink-700 bg-transparent text-fg-faint'
        )}>
          {labelOf(LEVEL_IMPORTANCE, level.importance)}
        </span>
      )}
    </span>
  );
}

const DIR_STYLE: Record<string, string> = {
  BUY: 'text-[#4dd39b]',
  SELL: 'text-[#f5787f]',
  BOTH: 'text-[#8fb8ff]',
};

/** Compact stop/profit pair for one side of the trade. */
function SideStats({
  side, stop, profit, best,
}: { side: 'BUY' | 'SELL'; stop: any; profit: any; best?: any }) {
  const has = stop != null || profit != null;
  if (!has) return null;
  return (
    <div>
      <div className={clsx('text-[10px] font-semibold uppercase tracking-wider', DIR_STYLE[side])}>
        {side}
      </div>
      <dl className="mt-0.5 space-y-0.5">
        <div className="flex justify-between gap-3">
          <dt className="text-[10.5px] text-fg-faint">Avg stop</dt>
          <dd className="tnum text-[11.5px] text-fg-muted">{stop != null ? `${pts(stop)}` : DASH}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[10.5px] text-fg-faint">Avg profit</dt>
          <dd className="tnum text-[11.5px] font-semibold text-fg">{profit != null ? `${pts(profit)}` : DASH}</dd>
        </div>
        {best != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-[10.5px] text-fg-faint">Best</dt>
            <dd className="tnum text-[11.5px] text-fg-muted">{pts(best)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * The card. Reads top to bottom as: what is it, is it trusted, how does it
 * trade, how much evidence is behind it.
 */
export function LevelCard({ level, onClick }: { level: any; onClick: () => void }) {
  const showBuy = level.direction === 'BUY' || level.direction === 'BOTH';
  const showSell = level.direction === 'SELL' || level.direction === 'BOTH';

  return (
    <button
      onClick={onClick}
      className="panel group flex flex-col overflow-hidden text-left transition-colors hover:border-ink-500"
    >
      <div className="px-4 pb-3 pt-3.5">
        {/* The price is the headline. */}
        <div className="tnum text-[26px] font-semibold leading-none tracking-tight text-fg group-hover:text-accent">
          {pts(level.level_price)}
        </div>

        <div className="mt-1.5 min-h-[15px] text-[11.5px] leading-tight text-fg-muted">
          {level.source || <span className="text-ink-500">no source recorded</span>}
        </div>
        <div className="tnum mt-0.5 text-[10.5px] text-fg-faint">
          {[level.instrument, level.timeframe].filter(Boolean).join(' • ') || DASH}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <LevelBadges level={level} />
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-ink-750 pt-2.5">
          <span className="text-[10.5px] text-fg-faint">Direction</span>
          <span className={clsx('text-[11.5px] font-semibold uppercase', DIR_STYLE[level.direction])}>
            {level.direction === 'BOTH' ? 'Buy + Sell' : level.direction}
          </span>
        </div>

        {level.first_touch_pct != null && (
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] text-fg-faint">First touch</span>
            <span className="tnum text-[15px] font-semibold text-fg">
              {Math.round(level.first_touch_pct)}%
            </span>
          </div>
        )}

        <div className={clsx('mt-2.5 gap-4 border-t border-ink-750 pt-2.5',
          showBuy && showSell ? 'grid grid-cols-2' : 'block')}>
          {showBuy && (
            <SideStats side="BUY" stop={level.buy_avg_stop} profit={level.buy_avg_profit}
              best={showBuy && !showSell ? level.buy_best_profit : undefined} />
          )}
          {showSell && (
            <SideStats side="SELL" stop={level.sell_avg_stop} profit={level.sell_avg_profit}
              best={showSell && !showBuy ? level.sell_best_profit : undefined} />
          )}
        </div>

        {level.sample_size != null && (
          <div className="mt-2.5 border-t border-ink-750 pt-2 text-[10.5px] text-fg-faint">
            Tested <span className="tnum font-semibold text-fg-muted">{level.sample_size}</span> times
          </div>
        )}
      </div>

      <ChartThumb
        filename={level.thumb}
        ratio="aspect-[16/9]"
        className="mt-auto rounded-none border-0 border-t border-ink-700"
      />
    </button>
  );
}
