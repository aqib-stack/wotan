'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPostFormData } from '@/lib/api';

type Summary = any;
type Metric = any;
type Heatmap = any;
type Bet = any;
type BetRes = { rows: Bet[]; count: number; totalStaked: number; totalReturned: number };
type StreakRes = { rows: any[]; stats: any };

const tone: any = {
  ok: ['#1A4E8A', 'bg-[#1A4E8A]'],
  warn: ['#7A4E10', 'bg-[#7A4E10]'],
  bad: ['#8A2818', 'bg-[#8A2818]'],
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiPostJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || `API error ${res.status}: ${path}`);
  }

  return data as T;
}

function formatCurrency(amount: any, currency?: string) {
  const value = Number(amount || 0);
  const code = (currency || 'PKR').toUpperCase();

  if (code === 'PKR') {
    return `PKR ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

function getDisplayCurrency(summary?: any, bets?: any) {
  return summary?.currency || bets?.rows?.find((b: any) => b.currency)?.currency || 'PKR';
}

export default function InsightsDashboard() {
  const [summary, setSummary] = useState<Summary>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [heat, setHeat] = useState<Heatmap>();
  const [streak, setStreak] = useState<StreakRes>({ rows: [], stats: {} });
  const [tilt, setTilt] = useState<any[]>([]);
  const [bets, setBets] = useState<BetRes>();
  const [filter, setFilter] = useState('all');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stakeSyncing, setStakeSyncing] = useState(false);
  const [stakeToken, setStakeToken] = useState('');

  const load = async () => {
    const [summaryRes, metricsRes, heatRes, streakRes, tiltRes] = await Promise.all([
      apiGet('/insights/summary'),
      apiGet('/insights/metrics'),
      apiGet('/insights/heatmap'),
      apiGet('/insights/streak'),
      apiGet('/insights/tilt-events'),
    ]);

    setSummary(summaryRes as any);
    setMetrics(metricsRes as any[]);
    setHeat(heatRes as any);
    setStreak(Array.isArray(streakRes) ? { rows: streakRes, stats: {} } : (streakRes as any));
    setTilt(tiltRes as any);
  };

  useEffect(() => {
    load();

    const savedStakeToken = window.localStorage.getItem('wotanStakeToken');
    if (savedStakeToken) setStakeToken(savedStakeToken);
  }, []);

  useEffect(() => {
    apiGet(`/insights/bets?filter=${filter}`).then((res) => setBets(res as BetRes));
  }, [filter]);

  async function handleStakeUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadMessage(`Uploading ${files.length} Stake archive file${files.length === 1 ? '' : 's'}...`);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    if (stakeToken.trim()) {
      formData.append('stakeToken', stakeToken.trim());
      window.localStorage.setItem('wotanStakeToken', stakeToken.trim());
    }

    try {
      const data = await apiPostFormData<any>('/insights/import/stake-json', formData);

      setUploadMessage(data.message || `Imported ${data.imported} Stake bets`);
      await load();
      const betRes = await apiGet(`/insights/bets?filter=${filter}`);
      setBets(betRes as BetRes);
    } catch (err: any) {
      setUploadMessage(`Upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleStakeLiveSync() {
    const token = stakeToken.trim() || window.localStorage.getItem('wotanStakeToken') || '';

    if (!token) {
      setUploadMessage('Connect Stake first: paste the Stake x-access-token once, then click Fetch Stake Bets. After that it is saved locally for future syncs.');
      return;
    }

    setStakeSyncing(true);
    setUploadMessage('Fetching Stake sports bet history directly from Stake...');

    try {
      window.localStorage.setItem('wotanStakeToken', token);
      const data = await apiPostJson<any>('/insights/import/stake-live', {
        stakeToken: token,
        maxBets: 500,
      });

      setUploadMessage(data.message || `Fetched and imported ${data.imported} Stake bets`);
      await load();
      const betRes = await apiGet(`/insights/bets?filter=${filter}`);
      setBets(betRes as BetRes);
    } catch (err: any) {
      setUploadMessage(`Stake sync failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setStakeSyncing(false);
    }
  }

  if (!summary) return <main className="min-h-screen bg-[#F5F3EE] p-10">Loading Insights...</main>;

  return (
    <main className="min-h-screen bg-[#F5F3EE] px-5 py-8 text-[#1A1A1A]">
      <div className="mx-auto max-w-[1280px]">
        <Header summary={summary} />
        <StakeUpload
          onUpload={handleStakeUpload}
          onStakeSync={handleStakeLiveSync}
          uploading={uploading}
          stakeSyncing={stakeSyncing}
          message={uploadMessage}
          stakeToken={stakeToken}
          setStakeToken={setStakeToken}
        />
        <Hero summary={summary} bets={bets} />
        <Note summary={summary} />

        <Section eyebrow="Section 01" title="Pilot Metrics" meta="3 of 18 metrics · computed from raw bet history">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {metrics.map((m) => <MetricCard key={m.code} m={m} />)}
          </div>
        </Section>

        {heat && (
          <Section eyebrow="D3-A Drilldown" title="Frequency Heatmap — day × hour" meta={`${summary.totalBets} bets · colour intensity = bet count`}>
            <Heatmap data={heat} />
          </Section>
        )}

        <Section eyebrow="D2-A Drilldown" title="Bet outcome sequence" meta="chronological · green = win · red = loss · height = stake">
          <Streak data={streak} />
        </Section>

        <Section eyebrow="D2-B Drilldown" title="Tilt detection signals" meta={`${tilt.length} tilt event${tilt.length === 1 ? '' : 's'} flagged`}>
          <TiltEvents events={tilt} />
        </Section>

        <Section eyebrow="Raw data" title={`Bet history · ${summary.totalBets} bets`} meta="click filters to isolate events">
          <BetsTable bets={bets} filter={filter} setFilter={setFilter} />
        </Section>

        <footer className="mt-10 flex justify-between border-t border-[#D8D4CC] pt-5 font-mono text-[10px] text-[#6B6560]">
          <span>WOTAN Project · Insights · Functional MVP</span>
        </footer>
      </div>
    </main>
  );
}

function Header({ summary }: any) {
  return (
    <div className="mb-7">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#6B6560]">WOTAN PROJECT · INSIGHTS · FUNCTIONAL DASHBOARD</div>
      <h1 className="mb-1 text-4xl font-bold tracking-tight">Investor Behaviour Analysis</h1>
      <p className="font-mono text-[11px] text-[#6B6560]">Sample User · {summary.totalBets} football bets · {summary.period} · {summary.source}</p>
    </div>
  );
}

function StakeUpload({ onUpload, onStakeSync, uploading, stakeSyncing, message, stakeToken, setStakeToken }: any) {
  const busy = uploading || stakeSyncing;

  return (
    <div className="mb-6 rounded-lg border border-[#D8D4CC] bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-semibold">Connect Stake & import real history</div>
          <div className="text-sm text-[#6B6560]">
            Fetch settled sports bets directly from Stake. Paste the x-access-token once; it is saved in this browser so future syncs do not need manual entry. JSON upload stays available as backup.
          </div>
          {message && <div className={`mt-2 font-mono text-[10px] ${message.includes('failed') || message.includes('required') ? 'text-[#8A2818]' : 'text-[#7A4E10]'}`}>{message}</div>}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="password"
            value={stakeToken}
            onChange={(e) => setStakeToken(e.target.value)}
            placeholder="Stake x-access-token"
            disabled={busy}
            className="w-full rounded border border-[#D8D4CC] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] sm:w-[260px]"
          />

          <button
            type="button"
            onClick={onStakeSync}
            disabled={busy}
            className={`rounded px-4 py-2 text-sm text-white ${busy ? 'bg-[#6B6560]' : 'bg-[#1A1A1A]'}`}
          >
            {stakeSyncing ? 'Fetching...' : 'Fetch Stake Bets'}
          </button>

          <label className={`cursor-pointer rounded border border-[#D8D4CC] px-4 py-2 text-sm ${busy ? 'bg-[#EDEAE4] text-[#6B6560]' : 'bg-white text-[#1A1A1A]'}`}>
            {uploading ? 'Importing...' : 'Upload JSON Backup'}
            <input
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                onUpload(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function Hero({ summary, bets }: any) {
  const currency = getDisplayCurrency(summary, bets);
  return (
    <section className="mb-6 grid grid-cols-1 gap-6 rounded-xl border border-[#D8D4CC] bg-white p-8 md:grid-cols-4">
      <div className="border-[#D8D4CC] pr-6 md:border-r">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B6560]">Investor Score</div>
        <ScoreValue score={summary.investorScore} large />
        <span className="mt-3 inline-block rounded bg-[#F5ECD8] px-3 py-1 font-mono text-[10px] uppercase text-[#7A4E10]">{summary.rating}</span>
        {summary.confidence && <div className="mt-2 font-mono text-[10px] text-[#6B6560]">Confidence: {summary.confidence}</div>}
      </div>
      <HeroStat label="Total Bets" value={summary.totalBets} sub={summary.level} />
      <HeroStat label="ROI" value={`${summary.roi}%`} sub={`${formatCurrency(summary.totalStaked, currency)} staked · ${formatCurrency(summary.totalReturned, currency)} returned`} negative={summary.roi < 0} />
      <HeroStat label="Win Rate" value={`${summary.winRate}%`} sub={`${summary.wins} wins · ${summary.losses} losses · avg odds ${summary.avgOdds}`} />
    </section>
  );
}

function ScoreValue({ score, large }: any) {
  if (score === null || score === undefined) {
    return <div className={`${large ? 'text-5xl' : 'text-4xl'} font-bold leading-none text-[#6B6560]`}>N/A</div>;
  }

  return (
    <div className={`${large ? 'text-6xl' : 'text-5xl'} font-bold leading-none text-[#7A4E10]`}>
      {score}<span className="text-xl font-normal text-[#6B6560]">/10</span>
    </div>
  );
}

function HeroStat({ label, value, sub, negative }: any) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B6560]">{label}</div>
      <div className={`text-[26px] font-semibold ${negative ? 'text-[#8A2818]' : ''}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] text-[#6B6560]">{sub}</div>
    </div>
  );
}

function Note({ summary }: any) {
  return null;
}

function Section({ eyebrow, title, meta, children }: any) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between border-b border-[#D8D4CC] pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6560]">{eyebrow}</div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        </div>
        <div className="font-mono text-[10px] text-[#6B6560]">{meta}</div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ m }: any) {
  const c = tone[m.tone]?.[0] || '#1A4E8A';
  const pct = typeof m.score === 'number' ? m.score * 10 : 0;

  return (
    <div className="rounded-lg border border-[#D8D4CC] bg-white p-6">
      <div className="mb-4 flex justify-between">
        <div>
          <div className="font-mono text-[10px] text-[#6B6560]">{m.code}</div>
          <div className="font-semibold">{m.title}</div>
          {m.confidence && <div className="mt-1 font-mono text-[9px] text-[#6B6560]">Confidence: {m.confidence}</div>}
        </div>
        <span className="h-fit rounded bg-[#EDEAE4] px-2 py-1 font-mono text-[10px]">{m.weight}%</span>
      </div>

      <div className="mb-3 flex items-end gap-2">
        {typeof m.score === 'number' ? <span className="text-5xl font-bold" style={{ color: c }}>{m.score}</span> : <span className="text-4xl font-bold text-[#6B6560]">N/A</span>}
        {typeof m.score === 'number' && <span className="text-[#6B6560]">/ 10</span>}
      </div>

      <div className="mb-4 h-2 rounded bg-[#EDEAE4]"><div className="h-2 rounded" style={{ width: `${pct}%`, background: c }} /></div>
      <p className="mb-4 text-sm leading-7 text-[#6B6560]">{m.summary}</p>
      <div className="grid grid-cols-2 gap-3 border-t border-[#D8D4CC] pt-4">
        {m.stats.map((s: any) => <div key={s[0]}><div className="font-mono text-[9px] uppercase tracking-wider text-[#6B6560]">{s[0]}</div><div className="font-semibold">{s[1]}</div></div>)}
      </div>
    </div>
  );
}

function Heatmap({ data }: any) {
  const cls = (c: any) => c.tilt ? 'bg-[#8A281888] outline outline-1 outline-[#8A2818]' : c.count >= 4 ? 'bg-[#C8922AEE]' : c.count === 3 ? 'bg-[#C8922A88]' : c.count === 2 ? 'bg-[#C8922A44]' : c.count === 1 ? 'bg-[#E0DDD3]' : 'bg-[#EDEAE4]';

  return (
    <div className="overflow-x-auto rounded-lg border border-[#D8D4CC] bg-white p-6">
      <div className="grid min-w-[760px] gap-0.5 font-mono text-[9px]" style={{ gridTemplateColumns: '60px repeat(24,1fr)' }}>
        <div />
        {data.hours.map((h: number) => <div className="text-center text-[#6B6560]" key={h}>{String(h).padStart(2, '0')}</div>)}
        {data.days.map((d: string) => (
          <div key={d} className="contents">
            <div className="pr-2 text-right text-[#6B6560]">{d}</div>
            {data.cells.filter((c: any) => c.day === d).map((c: any) => <div key={`${d}-${c.hour}`} title={`${d} ${c.hour}:00 — ${c.count} bet(s)`} className={`h-6 rounded-sm ${cls(c)}`} />)}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 font-mono text-[10px] text-[#6B6560]"><span>1 bet</span><span>2 bets</span><span>3 bets</span><span>4+ bets</span><span>Tilt window</span></div>
    </div>
  );
}

function Streak({ data }: any) {
  const rows = data?.rows || [];
  const stats = data?.stats || {};
  const max = Math.max(...rows.map((r: any) => r.stake), 1);

  return (
    <div className="rounded-lg border border-[#D8D4CC] bg-white p-6">
      <div className="flex h-32 items-end gap-1">
        {rows.length ? rows.map((r: any) => <div key={r.n} className={`${r.result === 'W' ? 'bg-[#1A7A52]' : 'bg-[#8A2818]'} flex-1 rounded-t ${r.flag ? 'outline outline-1 outline-[#8A2818]' : ''}`} style={{ height: `${Math.max(8, (r.stake / max) * 100)}%` }} title={`#${r.n} · ${formatCurrency(r.stake, r.currency)} · ${r.result}`} />) : <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-[#6B6560]">No bets imported yet</div>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Signal label="Longest Win Streak" val={`${stats.longestWin ?? 0} bets`} />
        <Signal active={(stats.longestLoss ?? 0) >= 3} label="Longest Loss Streak" val={`${stats.longestLoss ?? 0} bets`} />
        <Signal active={(stats.postLossDeltaNumber ?? 0) > 50} label="Post-loss Stake Δ" val={stats.postLossDelta || 'N/A'} />
        <Signal active={(stats.postWinDeltaNumber ?? 0) > 50} label="Post-win Stake Δ" val={stats.postWinDelta || 'N/A'} />
      </div>
    </div>
  );
}

function Signal({ label, val, active }: any) {
  return (
    <div className={`rounded-md p-4 ${active ? 'border-l-2 border-[#8A2818] bg-[#F5DED8]' : 'bg-[#EDEAE4]'}`}>
      <div className="font-mono text-[9px] uppercase text-[#6B6560]">{label}</div>
      <div className={`font-semibold ${active ? 'text-[#8A2818]' : ''}`}>{val}</div>
    </div>
  );
}

function TiltEvents({ events }: any) {
  return (
    <div className="rounded-lg border border-[#D8D4CC] bg-white p-6">
      {events.length ? events.map((e: any) => <div className="mb-6" key={e.title}><h3 className="font-semibold">{e.title}</h3><p className="mb-4 font-mono text-[10px] text-[#6B6560]">{e.subtitle}</p><div className="grid grid-cols-1 gap-3 md:grid-cols-3">{e.signals.map((s: any) => <Signal key={s[0]} active={s[2]} label={s[0]} val={s[1]} />)}</div></div>) : <p className="mb-4 font-mono text-[10px] text-[#6B6560]">No tilt events detected in the imported bet history.</p>}
      <div className="rounded border-l-4 border-[#1A4E8A] bg-[#EAF0F8] px-5 py-4 text-sm text-[#1A4E8A]"><strong>Signal model under evaluation</strong><br />Tilt detection is calculated from imported flags and simple session-risk rules. It becomes reliable after larger samples.</div>
    </div>
  );
}

function BetsTable({ bets, filter, setFilter }: any) {
  if (!bets) return null;

  const currency = getDisplayCurrency(undefined, bets);

  return (
    <div>
      <div className="mb-3 flex gap-2">{['all', 'tilt', 'win', 'loss'].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-2 text-xs ${filter === f ? 'bg-[#1A1A1A] text-white' : 'border border-[#D8D4CC] bg-white'}`}>{f === 'all' ? 'All bets' : f === 'tilt' ? 'Tilt events only' : f === 'win' ? 'Wins' : 'Losses'}</button>)}</div>
      <div className="overflow-hidden rounded-lg border border-[#D8D4CC] bg-white">
        <table className="w-full text-xs">
          <thead className="bg-[#1A1A1A] text-white">
            <tr>{['#', 'Date / Time', 'Match', 'Market', 'Odds', 'Stake', 'Result', 'P/L', 'Flag'].map(h => <th key={h} className="p-3 text-left font-mono text-[9px] uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody>
            {bets.rows.map((b: any) => {
              const rowCurrency = b.currency || currency;
              const stake = Number(b.stake || 0);
              const odds = Number(b.odds || 0);
              const profitLoss = b.result === 'W' ? Number((stake * odds - stake).toFixed(2)) : -stake;

              return (
                <tr key={b.id} className={`${b.flag === 'tilt' ? 'bg-[#F5DED8]' : 'even:bg-[#EDEAE4]'}`}>
                  <td className="p-3 font-mono">{String(b.n).padStart(2, '0')}</td>
                  <td className="p-3 font-mono">{new Date(b.placedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3">{b.match}</td>
                  <td className="p-3">{b.market}</td>
                  <td className="p-3 font-mono">{odds.toFixed(2)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(stake, rowCurrency)}</td>
                  <td className={`p-3 font-semibold ${b.result === 'W' ? 'text-[#1A7A52]' : 'text-[#8A2818]'}`}>{b.result}</td>
                  <td className={`p-3 font-semibold ${b.result === 'W' ? 'text-[#1A7A52]' : 'text-[#8A2818]'}`}>{formatCurrency(profitLoss, rowCurrency)}</td>
                  <td className="p-3">{b.flag && <span className="rounded bg-[#F5DED8] px-2 py-1 font-mono text-[9px] text-[#8A2818]">TILT</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="bg-[#EDEAE4] p-3 font-mono text-[10px] text-[#6B6560]">Showing {bets.count} bets · {formatCurrency(bets.totalStaked, currency)} staked · {formatCurrency(bets.totalReturned, currency)} returned</div>
      </div>
    </div>
  );
}
