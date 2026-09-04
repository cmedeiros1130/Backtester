# LevelForge

A filing cabinet for trading research. Local-first, screenshot-heavy, and built
around four things:

1. **Daily Prediction** — practise reading a historical day, lock your call, then compare it with what happened
2. **Level Library** — a folder per level type, holding every example you file
3. **Market Examples** — your visual textbook of ranges, trends, candles and structure
4. **Backtest Archive** — every day you have studied, and what came out of it

It is not a trading journal, a P&L tracker or an analytics platform. There is no
account, no broker and no money anywhere in the database.

Nothing is pre-created. Every folder and every category is yours to name — the
application ships an empty cabinet.

---

## Running it

One install from the repo root covers both packages (npm workspaces):

```bash
npm install
```

Development — Vite on 4300 proxying the API on 4310, both with hot reload:

```bash
npm run dev
```

Production — build the client once, then run the single server that serves both
the UI and the API:

```bash
npm run build
```

```bash
npm start
```

Requires **Node 24** (`.node-version` pins it). LevelForge uses the built-in
`node:sqlite`, so there is no native module to compile — but the runtime has to
be new enough to expose it. The server refuses to start with a clear message if
it is not.

## Where your data lives

Everything is in `data/`:

- `data/levelforge.db` — folders, categories, examples, predictions, reviews
- `data/uploads/` — every chart you have saved

Back up that folder and you have backed up the cabinet.

---

## The one rule that survived

**A locked prediction is immutable.** Once you lock a day's prediction the
server returns `409` on any edit, and an immutable JSON snapshot is written
alongside the columns. A prediction you can revise after seeing the outcome is
not a prediction, and the side-by-side comparison would be worthless without it.

That's the only enforcement in the app. Everything else is filing.

---

## How it is organised

### Daily Prediction

Pick a date, instrument and timeframe. Write nine fields — expected day type,
bias, important levels, main prediction, bull and bear scenarios, what you're
waiting for, what would invalidate it, notes — attach charts, then **lock**.

Study the day however you like (the app doesn't replay it for you). Come back and
fill in the review beside the locked text: actual day type, and four questions —
what was I right about, wrong about, what did I miss, what did I learn. Attach the
completed-session chart.

### Level Library

**Starts completely empty.** One folder per level type, all created by you —
nothing is pre-named. Make a folder for whatever you actually research and file
an example every time you test it.

Each example records: date, instrument, **timeframe**, level price, direction,
touch number, drawdown, reaction, result (held / reclaimed / failed / broke),
what happened, notes, tags, and before/after charts.

The folder header shows plain statistics — total, held, failed, average and
median drawdown and reaction, and a per-touch breakdown. Filter the gallery by
timeframe, result, touch number or text; **the summary always describes the whole
folder** so filtering the view never silently moves the numbers you're comparing
against.

Because timeframe is on every example, each folder also gets an *Across
timeframes* table: does this level behave differently on 5m than on 1h?

### Market Examples

**Starts completely empty**, same as the Level Library. Categories are your own
vocabulary for market concepts; the application has no business pre-labelling
them. Create whatever chapters you want as you learn.

Each example is a chart and the writing that goes with it: description, what I
see, what makes this valid, what invalidates it, what happened next, what I
learned, tags.

### Backtest Archive

Every studied day in one table: date, instrument, timeframe, expected vs actual
day type, status, and how many level examples, market examples and charts it
produced. A matching prediction shows green.

From any day you can **Save to Level Library** or **Save to Market Examples**;
what you file stays linked back to the day it came from.

### Search

One box, `⌘K` from anywhere. Matches level prices, folder and category names,
example titles, everything you wrote, and your tags. `"third touch"` finds
touch-number 3; `"503"` finds level prices.

---

## Deploying

LevelForge is a **single long-running Node process** that owns a SQLite file and
a directory of uploaded screenshots. It needs a host that provides a persistent
disk. It cannot run on a static or serverless host — see the note at the bottom.

| | |
|---|---|
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Node version | 24 (from `.node-version`) |

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | yes | Set to `production`. Disables CORS (same-origin in prod) and enables the missing-build warning. |
| `LEVELFORGE_DATA_DIR` | yes | Absolute path to the **persistent disk**. Holds `levelforge.db` and `uploads/`. |
| `PORT` | no | Set by the host. Defaults to 4310. |
| `HOST` | no | Defaults to `0.0.0.0`, which is what platforms need. |
| `LEVELFORGE_CLIENT_DIST` | no | Override the built-client path. The default is correct for a normal deploy. |

Everything mutable lives under `LEVELFORGE_DATA_DIR`:

```
$LEVELFORGE_DATA_DIR/
  levelforge.db      the whole database
  uploads/           every screenshot
```

Point that at the mounted volume and both survive restarts and redeploys. Back
it up and you have backed up everything.

### Render

`render.yaml` in the repo root is ready to use — it declares the build and start
commands, the health check, `LEVELFORGE_DATA_DIR=/var/data`, and a 1 GB disk
mounted there.

**A persistent disk requires a paid instance type.** On the free tier the disk
is not available and the database and screenshots are wiped on every deploy.

### Railway, Fly.io, a VPS

Identical shape: same build and start commands, mount a volume, and set
`LEVELFORGE_DATA_DIR` to the mount path.

### Why not Netlify or Vercel

Those host static files plus serverless functions. There is no long-lived
process to hold the SQLite handle, and the function filesystem is ephemeral —
`/tmp` is wiped on cold start and not shared between concurrent instances. The
database and every uploaded screenshot would disappear. LevelForge needs a real
server with a real disk.

---

## Project layout

```
server/
  src/
    db/schema.sql        the whole schema, annotated
    db/migrate.js        idempotent migrations, run before the schema
    lib/stats.js         mean/median, used by the folder summary
    routes/days.js       predictions and reviews
    routes/library.js    level folders and examples
    routes/examples.js   categories and market examples
    routes/search.js     global search
    routes/home.js       home page feed
    routes/screenshots.js
client/
  src/
    components/Charts.tsx   thumbnails, lightbox, upload — the visual core
    components/ui.tsx       the UI kit
    pages/                  one page per section
shared/
  domain.js            the enum vocabulary, imported by both sides
```

---

## Preserved but not surfaced

The market-data adapter layer (`server/src/lib/marketdata.js`,
`server/src/routes/market.js`) and its tables — `market_dataset`, `candle`,
`backtest_meta` — are intact and still work. They import CSV / headerless OHLCV /
NinjaTrader exports and enforce a server-side future-data guard for candle
replay.

Nothing in the current UI touches them. They are kept because rebuilding that
layer is expensive and replay may come back; if it doesn't, deleting
`routes/market.js`, `lib/marketdata.js` and those three tables removes it cleanly.

## What was removed

An earlier version of this app had a learning-study system (hypotheses,
variables, observations, pattern cards), a versioned playbook, a research
dashboard with filter engine, simulated trades with process scores and
analysis/execution quadrants, contradiction detection, session timelines and 0–100
session scoring. All of it is gone — routes, UI and tables.

The migration carries the useful part across: old predictive levels and their
touches become flat `level_example` rows, one per touch, filed into folders named
after their level type. Screenshots that belonged to deleted records are
re-pointed at their day rather than deleted.

The schema went from 28 tables to 16; the client bundle from 606 KB to 268 KB.
