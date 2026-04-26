import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

type BetFilter = 'all' | 'tilt' | 'win' | 'loss';
type BetLike = {
  id?: string;
  n: number;
  placedAt: Date;
  match: string;
  market: string;
  odds: number;
  stake: number;
  currency: string;
  result: string;
  flag: string | null;
};

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  private async user() {
    let user = await this.prisma.user.findFirst({ where: { name: 'Sample User' } });
    if (!user) user = await this.prisma.user.create({ data: { name: 'Sample User' } });
    return user;
  }

  private async allBets() {
    const user = await this.user();
    return this.prisma.bet.findMany({
      where: { userId: user.id },
      orderBy: { placedAt: 'asc' },
    });
  }

  private resultReturn(b: { result: string; stake: number; odds: number }) {
    return b.result === 'W' ? b.stake * b.odds : 0;
  }

  private profit(b: { result: string; stake: number; odds: number }) {
    return this.resultReturn(b) - b.stake;
  }

  private roi(bets: BetLike[]) {
    const staked = bets.reduce((sum, b) => sum + b.stake, 0);
    const returned = bets.reduce((sum, b) => sum + this.resultReturn(b), 0);
    return staked ? Number((((returned - staked) / staked) * 100).toFixed(1)) : 0;
  }

  private currencyOfBets(bets: Array<{ currency?: string }>) {
    return String(bets[0]?.currency || 'PKR').toUpperCase();
  }

  private currencySymbol(currency?: string) {
    switch (String(currency || '').toUpperCase()) {
      case 'PKR': return '₨';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return String(currency || '');
    }
  }

  private rating(score: number | null, count: number) {
    if (count < 50 || score === null) return 'Insufficient Data';
    if (score >= 8.5) return 'Elite Investor';
    if (score >= 7) return 'Developing';
    if (score >= 5.5) return 'High Variance';
    return 'Undisciplined';
  }

  private confidence(count: number) {
    if (count < 5) return 'Very Low';
    if (count < 50) return 'Low';
    if (count < 100) return 'Medium';
    return 'High';
  }

  async getSummary() {
    const bets = await this.allBets();
    const totalBets = bets.length;
    const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
    const totalReturned = bets.reduce((s, b) => s + this.resultReturn(b), 0);
    const wins = bets.filter((b) => b.result === 'W').length;
    const losses = totalBets - wins;
    const avgOdds = totalBets ? bets.reduce((s, b) => s + b.odds, 0) / totalBets : 0;
    const roi = totalStaked ? ((totalReturned - totalStaked) / totalStaked) * 100 : 0;
    const winRate = totalBets ? (wins / totalBets) * 100 : 0;

    let investorScore: number | null = null;

    if (totalBets >= 50) {
      const d3a = this.scoreFrequency(bets) ?? 5;
      const d2a = this.scoreStreakBehaviour(bets) ?? 5;
      const d2b = this.scoreTilt(bets) ?? 5;
      const roiScore = this.scoreRoi(this.roi(bets));
      const winRateScore = this.clamp((winRate / 100) * 10, 0, 10);

      const d1 = this.clamp((d3a * 0.55) + (roiScore * 0.45), 0, 10);
      const d2 = this.clamp((d2a * 0.55) + (d2b * 0.45), 0, 10);
      const d3 = d3a;
      const d4 = this.clamp((roiScore * 0.65) + (winRateScore * 0.35), 0, 10);

      investorScore = Number(((d1 * 0.35) + (d2 * 0.25) + (d3 * 0.20) + (d4 * 0.20)).toFixed(1));
    }

    return {
      investorScore,
      rating: this.rating(investorScore, totalBets),
      confidence: this.confidence(totalBets),
      minimumBetsRequired: 50,
      totalBets,
      currency: this.currencyOfBets(bets),
      totalStaked: Number(totalStaked.toFixed(2)),
      totalReturned: Number(totalReturned.toFixed(2)),
      roi: Number(roi.toFixed(1)),
      winRate: Number(winRate.toFixed(0)),
      wins,
      losses,
      avgOdds: Number(avgOdds.toFixed(2)),
      level: this.level(totalBets),
      period: this.periodLabel(bets),
      source: '',
    };
  }

  async getMetrics() {
    const bets = await this.allBets();
    const frequency = this.frequencyStats(bets);
    const streak = this.streakStats(bets);
    const tilt = this.tiltStats(bets);

    return [
      {
        code: 'D3-A',
        title: 'Transaction Frequency & Density',
        weight: 6,
        score: this.scoreFrequency(bets),
        confidence: this.confidence(bets.length),
        tone: bets.length < 5 ? 'warn' : 'ok',
        summary: frequency.summary,
        stats: [
          ['Avg / day', `${frequency.avgPerDay} bets`],
          ['Peak session', frequency.peakCount ? `${frequency.peakCount} bets · ${frequency.peakDay}` : 'N/A'],
          ['Active days', `${frequency.activeDays} of ${frequency.totalDays}`],
          ['Late-hour %', `${frequency.latePct}%`],
        ],
      },
      {
        code: 'D2-A',
        title: 'Win/Loss Streak Behaviour',
        weight: 7,
        score: this.scoreStreakBehaviour(bets),
        confidence: bets.length < 5 ? 'Very Low' : this.confidence(bets.length),
        tone: streak.longestLoss >= 3 ? 'warn' : 'ok',
        summary: streak.summary,
        stats: [
          ['Longest win', `${streak.longestWin} bets`],
          ['Longest loss', `${streak.longestLoss} bets`],
          ['Post-loss stake Δ', streak.postLossDelta],
          ['Post-win stake Δ', streak.postWinDelta],
        ],
      },
      {
        code: 'D2-B',
        title: 'Tilt & Emotional Deviation',
        weight: 8,
        score: this.scoreTilt(bets),
        confidence: bets.length < 10 ? 'Very Low' : this.confidence(bets.length),
        tone: tilt.events ? 'bad' : 'ok',
        summary: tilt.summary,
        stats: [
          ['Tilt events', `${tilt.events}`],
          ['Bets in tilt', `${tilt.tiltBets} of ${bets.length} (${tilt.tiltPct}%)`],
          ['ROI during tilt', tilt.tiltBets ? `${tilt.tiltRoi}%` : 'N/A'],
          ['ROI outside tilt', bets.length - tilt.tiltBets ? `${tilt.outsideRoi}%` : 'N/A'],
        ],
      },
    ];
  }

  async getBets(filter: BetFilter = 'all') {
    let bets = await this.allBets();
    if (filter === 'tilt') bets = bets.filter((b) => b.flag === 'tilt');
    if (filter === 'win') bets = bets.filter((b) => b.result === 'W');
    if (filter === 'loss') bets = bets.filter((b) => b.result === 'L');

    const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
    const totalReturned = bets.reduce((s, b) => s + this.resultReturn(b), 0);

    return {
      rows: bets,
      count: bets.length,
      currency: this.currencyOfBets(bets),
      totalStaked: Number(totalStaked.toFixed(2)),
      totalReturned: Number(totalReturned.toFixed(2)),
    };
  }

  async getHeatmap() {
    const bets = await this.allBets();
    const days = this.daysForHeatmap(bets);
    const cells: any[] = [];

    for (const day of days) {
      for (let hour = 0; hour < 24; hour++) {
        const dayBets = bets.filter(
          (b) => this.dayLabel(b.placedAt) === day && b.placedAt.getHours() === hour,
        );
        cells.push({
          day,
          hour,
          count: dayBets.length,
          tilt: dayBets.some((b) => b.flag === 'tilt'),
        });
      }
    }

    return { days, hours: Array.from({ length: 24 }, (_, i) => i), cells };
  }

  async getStreak() {
    const bets = await this.allBets();
    return {
      rows: bets.map((b) => ({ n: b.n, stake: b.stake, currency: b.currency, result: b.result, flag: b.flag })),
      stats: this.streakStats(bets),
    };
  }

  async getTiltEvents() {
    const bets = await this.allBets();
    return this.buildTiltEvents(bets);
  }

  async importStakeJsonFiles(files: any[]) {
    const user = await this.user();
    await this.prisma.bet.deleteMany({ where: { userId: user.id } });

    let imported = 0;
    let skipped = 0;

    for (const file of files) {
      const raw = file.buffer.toString('utf8');
      const result = await this.importStakeJson(raw, false);
      imported += result.imported || 0;
      skipped += result.skipped || 0;
    }

    await this.renumberBets(user.id);
    await this.detectAndStoreTiltFlags(user.id);

    return {
      success: true,
      files: files.length,
      imported,
      skipped,
      message: `Imported ${imported} Stake bet${imported === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}. Skipped ${skipped} duplicate/invalid record${skipped === 1 ? '' : 's'}.`,
    };
  }

  async importStakeJson(rawJson: string, clearExisting = true) {
    let records: any[];

    try {
      records = JSON.parse(rawJson);
    } catch {
      throw new BadRequestException('Invalid Stake archive JSON file.');
    }

    if (!Array.isArray(records)) {
      throw new BadRequestException('Stake archive JSON must be an array.');
    }

    const user = await this.user();

    if (clearExisting) {
      await this.prisma.bet.deleteMany({ where: { userId: user.id } });
    }

    let imported = 0;
    let skipped = 0;

    const sorted = [...records].sort((a, b) => {
      const aTime = new Date(a?.data?.createdAt || a?.created_at || 0).getTime();
      const bTime = new Date(b?.data?.createdAt || b?.created_at || 0).getTime();
      return aTime - bTime;
    });

    for (const item of sorted) {
      const data = item?.data;
      const outcome = data?.outcomes?.[0];

      if (!data || data.type !== 'sportsbook') {
        skipped++;
        continue;
      }

      const stake = Number(data.amount || 0);
      const payout = Number(data.payout || 0);
      const odds = Number(outcome?.odds || data.potentialMultiplier || 1);
      const currency = String(data.currency || 'PKR').toUpperCase();
      const placedAt = new Date(data.createdAt || item.created_at);

      if (!Number.isFinite(stake) || stake <= 0 || !Number.isFinite(odds) || Number.isNaN(placedAt.getTime())) {
        skipped++;
        continue;
      }

      const match = this.stakeMatchLabel(outcome);
      const market = this.stakeMarketLabel(outcome);
      const result = payout > stake ? 'W' : 'L';

      const duplicate = await this.prisma.bet.findFirst({
        where: {
          userId: user.id,
          placedAt,
          match,
          market,
          odds,
          stake,
          currency,
        },
      });

      if (duplicate) {
        skipped++;
        continue;
      }

      await this.prisma.bet.create({
        data: {
          userId: user.id,
          n: 0,
          placedAt,
          match,
          market,
          odds,
          stake,
          currency,
          result,
          flag: null,
        },
      });

      imported++;
    }

    if (clearExisting) {
      await this.renumberBets(user.id);
      await this.detectAndStoreTiltFlags(user.id);
    }

    return {
      success: true,
      imported,
      skipped,
      message: `Imported ${imported} Stake bet${imported === 1 ? '' : 's'}. Skipped ${skipped} duplicate/invalid record${skipped === 1 ? '' : 's'}.`,
    };
  }

  private async renumberBets(userId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { placedAt: 'asc' },
    });

    for (let i = 0; i < bets.length; i++) {
      await this.prisma.bet.update({
        where: { id: bets[i].id },
        data: { n: i + 1 },
      });
    }
  }

  private async detectAndStoreTiltFlags(userId: string) {
    const bets = await this.prisma.bet.findMany({ where: { userId }, orderBy: { placedAt: 'asc' } });

    for (const bet of bets) {
      await this.prisma.bet.update({ where: { id: bet.id }, data: { flag: null } });
    }

    if (bets.length < 10) return;

    const flaggedIds = new Set<string>();

    for (let i = 0; i < bets.length; i++) {
      const current = bets[i];
      const previousFive = bets.slice(Math.max(0, i - 5), i);
      const recentLosses = previousFive.filter((b) => b.result === 'L').length;
      const previousAverageStake = previousFive.length
        ? previousFive.reduce((sum, b) => sum + b.stake, 0) / previousFive.length
        : current.stake;
      const stakeJump = previousAverageStake > 0 && current.stake >= previousAverageStake * 1.75;
      const lateHour = current.placedAt.getHours() >= 22 || current.placedAt.getHours() < 3;

      if (recentLosses >= 3 && stakeJump && lateHour) {
        flaggedIds.add(current.id);
      }
    }

    for (let i = 0; i < bets.length; i++) {
      const session = [bets[i]];
      for (let j = i + 1; j < bets.length; j++) {
        if (bets[j].placedAt.getTime() - bets[i].placedAt.getTime() <= 60 * 60 * 1000) {
          session.push(bets[j]);
        }
      }

      const sessionStake = session.reduce((sum, b) => sum + b.stake, 0);
      const sessionLosses = session.filter((b) => b.result === 'L').length;
      const lateSession = session.some((b) => b.placedAt.getHours() >= 22 || b.placedAt.getHours() < 3);

      if (session.length >= 4 && sessionLosses >= 3 && lateSession && sessionStake > 0) {
        session.forEach((b) => flaggedIds.add(b.id));
      }
    }

    for (const id of flaggedIds) {
      await this.prisma.bet.update({ where: { id }, data: { flag: 'tilt' } });
    }
  }

  private level(count: number) {
    if (count < 50) return 'Level 1 — Beta Signal';
    if (count < 100) return 'Level 2 — Basic Analysis';
    if (count < 200) return 'Level 3 — Behaviour Patterns';
    if (count < 500) return 'Level 4 — Full Discipline Analysis';
    return 'Level 5 — Complete Behavioural Model';
  }

  private scoreFrequency(bets: BetLike[]) {
    if (!bets.length) return null;
    const frequency = this.frequencyStats(bets);

    if (bets.length < 5) return Number((5 + Math.min(1.5, frequency.activeDays * 0.5)).toFixed(1));

    const activeRatio = frequency.totalDays ? frequency.activeDays / frequency.totalDays : 0;
    const densityPenalty = frequency.peakCount > Math.max(4, bets.length * 0.35) ? 1.5 : 0;
    const latePenalty = frequency.latePct > 40 ? 1 : 0;
    const score = 5 + (activeRatio * 4) - densityPenalty - latePenalty;
    return Number(this.clamp(score, 0, 10).toFixed(1));
  }

  private scoreStreakBehaviour(bets: BetLike[]) {
    if (bets.length < 5) return null;
    const streak = this.streakStats(bets);
    let score = 7;

    if (streak.longestLoss >= 3) score -= 1;
    if (streak.longestLoss >= 5) score -= 1.5;
    if ((streak.postLossDeltaNumber ?? 0) > 50) score -= 1.5;
    if ((streak.postWinDeltaNumber ?? 0) > 50) score -= 0.75;
    if (streak.longestWin >= 3 && (streak.postWinDeltaNumber ?? 0) <= 25) score += 0.5;

    return Number(this.clamp(score, 0, 10).toFixed(1));
  }

  private scoreTilt(bets: BetLike[]) {
    if (bets.length < 10) return null;
    const tilt = this.tiltStats(bets);
    let score = 8;

    score -= tilt.events * 1.25;
    score -= Math.min(3, tilt.tiltPct / 10);
    if (tilt.tiltBets && tilt.tiltRoi < -20) score -= 1;

    return Number(this.clamp(score, 0, 10).toFixed(1));
  }

  private scoreRoi(roi: number) {
    if (roi >= 15) return 9;
    if (roi >= 5) return 7.5;
    if (roi >= 0) return 6.5;
    if (roi >= -5) return 5.5;
    if (roi >= -15) return 4;
    return 2.5;
  }

  private frequencyStats(bets: BetLike[]) {
    const byDay = new Map<string, number>();
    let late = 0;

    for (const b of bets) {
      const d = this.dayLabel(b.placedAt);
      byDay.set(d, (byDay.get(d) || 0) + 1);
      if (b.placedAt.getHours() >= 22 || b.placedAt.getHours() < 3) late++;
    }

    let peakDay = '';
    let peakCount = 0;
    byDay.forEach((v, k) => {
      if (v > peakCount) {
        peakDay = k;
        peakCount = v;
      }
    });

    const totalDays = this.totalCalendarDays(bets);
    const avgPerDay = totalDays ? Number((bets.length / totalDays).toFixed(1)) : 0;
    const activeDays = byDay.size;
    const latePct = bets.length ? Math.round((late / bets.length) * 100) : 0;

    let summary = 'No imported bets are available yet.';
    if (bets.length > 0) {
      summary = `Betting activity covers ${activeDays} active day${activeDays === 1 ? '' : 's'} with an average of ${avgPerDay} bets per day. Peak activity was ${peakCount} bet${peakCount === 1 ? '' : 's'} on ${peakDay}. Late-hour activity represents ${latePct}% of bets.`;
      if (bets.length < 50) summary += ' This is still a beta signal because fewer than 50 bets are imported.';
    }

    return { avgPerDay, peakDay, peakCount, activeDays, totalDays, latePct, summary };
  }

  private streakStats(bets: BetLike[]) {
    let longestWin = 0;
    let longestLoss = 0;
    let currentResult = '';
    let currentCount = 0;

    for (const b of bets) {
      if (b.result === currentResult) {
        currentCount++;
      } else {
        currentResult = b.result;
        currentCount = 1;
      }

      if (b.result === 'W') longestWin = Math.max(longestWin, currentCount);
      if (b.result === 'L') longestLoss = Math.max(longestLoss, currentCount);
    }

    const postLossDeltaNumber = this.averageStakeDeltaAfterResult(bets, 'L');
    const postWinDeltaNumber = this.averageStakeDeltaAfterResult(bets, 'W');
    const postLossDelta = postLossDeltaNumber === null ? 'N/A' : `${postLossDeltaNumber > 0 ? '+' : ''}${postLossDeltaNumber}%`;
    const postWinDelta = postWinDeltaNumber === null ? 'N/A' : `${postWinDeltaNumber > 0 ? '+' : ''}${postWinDeltaNumber}%`;

    let summary = 'Not enough bets yet to identify meaningful win/loss streak behaviour.';
    if (bets.length > 0) {
      summary = `Current data shows a longest win streak of ${longestWin} bet${longestWin === 1 ? '' : 's'} and a longest loss streak of ${longestLoss} bet${longestLoss === 1 ? '' : 's'}.`;
      if (postLossDeltaNumber !== null) summary += ` Average stake after a loss changed by ${postLossDelta}.`;
      if (postWinDeltaNumber !== null) summary += ` Average stake after a win changed by ${postWinDelta}.`;
      if (bets.length < 5) summary += ' More bets are needed before this metric receives a score.';
    }

    return { longestWin, longestLoss, postLossDelta, postWinDelta, postLossDeltaNumber, postWinDeltaNumber, summary };
  }

  private averageStakeDeltaAfterResult(bets: BetLike[], result: 'W' | 'L') {
    const before: number[] = [];
    const after: number[] = [];

    for (let i = 1; i < bets.length; i++) {
      if (bets[i - 1].result === result) {
        before.push(bets[i - 1].stake);
        after.push(bets[i].stake);
      }
    }

    if (!before.length || !after.length) return null;
    const beforeAvg = before.reduce((s, v) => s + v, 0) / before.length;
    const afterAvg = after.reduce((s, v) => s + v, 0) / after.length;
    if (!beforeAvg) return null;
    return Math.round(((afterAvg - beforeAvg) / beforeAvg) * 100);
  }

  private tiltStats(bets: BetLike[]) {
    const tilt = bets.filter((b) => b.flag === 'tilt');
    const normal = bets.filter((b) => b.flag !== 'tilt');
    const events = this.groupTiltSessions(tilt).length;
    const tiltPct = bets.length ? Math.round((tilt.length / bets.length) * 100) : 0;
    const tiltRoi = this.roi(tilt);
    const outsideRoi = this.roi(normal);

    let summary = 'No tilt events are currently detected in the imported bet history.';
    if (bets.length < 10) {
      summary = 'Not enough bets yet to run reliable tilt detection. Import at least 10 bets for early tilt signals.';
    } else if (events > 0) {
      summary = `${events} tilt event${events === 1 ? '' : 's'} detected across ${tilt.length} bet${tilt.length === 1 ? '' : 's'}. ROI during tilt is ${tiltRoi}%.`;
    }

    return { events, tiltBets: tilt.length, tiltPct, tiltRoi, outsideRoi, summary };
  }

  private buildTiltEvents(bets: BetLike[]) {
    const sessions = this.groupTiltSessions(bets.filter((b) => b.flag === 'tilt'));

    return sessions.map((session, index) => {
      const first = session[0];
      const last = session[session.length - 1];
      const losses = session.filter((b) => b.result === 'L').length;
      const totalStake = session.reduce((s, b) => s + b.stake, 0);
      const avgStake = session.length ? totalStake / session.length : 0;

      return {
        title: `Event ${index + 1} — ${this.dayLabel(first.placedAt)}, ${this.timeLabel(first.placedAt)}–${this.timeLabel(last.placedAt)}`,
        subtitle: `${session.length} tilt bet${session.length === 1 ? '' : 's'} detected from imported history`,
        signals: [
          ['Session bets', `${session.length} bet${session.length === 1 ? '' : 's'}`, true],
          ['Loss count', `${losses} of ${session.length}`, losses > 0],
          ['Average stake', `${this.currencySymbol(first.currency)}${avgStake.toFixed(2)}`, true],
          ['Session stake', `${this.currencySymbol(first.currency)}${totalStake.toFixed(2)}`, true],
          ['Time window', `${this.timeLabel(first.placedAt)} – ${this.timeLabel(last.placedAt)}`, true],
          ['Result', losses === session.length ? 'All losses' : 'Mixed results', losses === session.length],
        ],
      };
    });
  }

  private groupTiltSessions(tiltBets: BetLike[]) {
    const sessions: BetLike[][] = [];
    const sorted = [...tiltBets].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

    for (const bet of sorted) {
      const lastSession = sessions[sessions.length - 1];
      const lastBet = lastSession?.[lastSession.length - 1];

      if (!lastBet || bet.placedAt.getTime() - lastBet.placedAt.getTime() > 60 * 60 * 1000) {
        sessions.push([bet]);
      } else {
        lastSession.push(bet);
      }
    }

    return sessions;
  }

  private daysForHeatmap(bets: BetLike[]) {
    if (!bets.length) return ['No bets'];
    return Array.from(new Set(bets.map((b) => this.dayLabel(b.placedAt))));
  }

  private totalCalendarDays(bets: BetLike[]) {
    if (!bets.length) return 0;
    const sorted = [...bets].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
    const first = new Date(sorted[0].placedAt);
    const last = new Date(sorted[sorted.length - 1].placedAt);
    first.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  }

  private periodLabel(bets: BetLike[]) {
    if (!bets.length) return 'No imported bets';
    const sorted = [...bets].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
    const first = sorted[0].placedAt;
    const last = sorted[sorted.length - 1].placedAt;
    return `${this.dayLabel(first)} – ${this.dayLabel(last)}, ${last.getFullYear()}`;
  }

  private dayLabel(date: Date) {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }

  private timeLabel(date: Date) {
    return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private stakeMatchLabel(outcome: any) {
    return outcome?.fixtureName || outcome?.fixture?.name || `Stake fixture ${outcome?.fixtureId || 'Unknown'}`;
  }

  private stakeMarketLabel(outcome: any) {
    return outcome?.marketName || outcome?.market?.name || (outcome?.marketId ? `Market ${outcome.marketId}` : 'Sportsbook');
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
