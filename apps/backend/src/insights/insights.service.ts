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
  result: string;
  flag: string | null;
};

type StakeMetadata = {
  fixtureNameById: Record<string, string>;
  marketNameById: Record<string, string>;
  outcomeNameById: Record<string, string>;
  byBetId: Record<
    string,
    {
      match?: string;
      market?: string;
      selection?: string;
    }
  >;
};

function emptyStakeMetadata(): StakeMetadata {
  return {
    fixtureNameById: {},
    marketNameById: {},
    outcomeNameById: {},
    byBetId: {},
  };
}

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  private async user(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  private async allBets(userId: string) {
    return this.prisma.bet.findMany({
      where: { userId },
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

  async getSummary(userId: string) {
    const bets = await this.allBets(userId);
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

  async getMetrics(userId: string) {
    const bets = await this.allBets(userId);
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

  async getBets(userId: string, filter: BetFilter = 'all', limit = 200) {
    const safeLimit = this.safeLimit(limit, 200, 500);
    const where: any = { userId };

    if (filter === 'tilt') where.flag = 'tilt';
    if (filter === 'win') where.result = 'W';
    if (filter === 'loss') where.result = 'L';

    const [rows, count, totals] = await this.prisma.$transaction([
      this.prisma.bet.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        take: safeLimit,
      }),
      this.prisma.bet.count({ where }),
      this.prisma.bet.findMany({
        where,
        select: { stake: true, odds: true, result: true },
      }),
    ]);

    const totalStaked = totals.reduce((s, b) => s + b.stake, 0);
    const totalReturned = totals.reduce((s, b) => s + this.resultReturn(b), 0);

    return {
      rows: rows.reverse(),
      count,
      returnedRows: rows.length,
      limit: safeLimit,
      totalStaked: Number(totalStaked.toFixed(2)),
      totalReturned: Number(totalReturned.toFixed(2)),
    };
  }

  async getHeatmap(userId: string) {
    const bets = await this.allBets(userId);
    const days = this.daysForHeatmap(bets);
    const grouped = new Map<string, { count: number; tilt: boolean }>();

    for (const bet of bets) {
      const day = this.dayLabel(bet.placedAt);
      const hour = bet.placedAt.getHours();
      const key = `${day}|${hour}`;
      const current = grouped.get(key) || { count: 0, tilt: false };
      current.count += 1;
      current.tilt = current.tilt || bet.flag === 'tilt';
      grouped.set(key, current);
    }

    const cells: any[] = [];
    for (const day of days) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = grouped.get(`${day}|${hour}`) || { count: 0, tilt: false };
        cells.push({ day, hour, count: cell.count, tilt: cell.tilt });
      }
    }

    return { days, hours: Array.from({ length: 24 }, (_, i) => i), cells };
  }

  async getStreak(userId: string) {
    const bets = await this.allBets(userId);
    return {
      rows: bets.map((b) => ({ n: b.n, stake: b.stake, result: b.result, flag: b.flag })),
      stats: this.streakStats(bets),
    };
  }

  async getTiltEvents(userId: string) {
    const bets = await this.allBets(userId);
    return this.buildTiltEvents(bets);
  }

  async importStakeLive(userId: string, stakeToken: string, maxBets = 500) {
    const token = stakeToken?.trim();
    if (!token) {
      throw new BadRequestException('Stake x-access-token is required to fetch live Stake bet history.');
    }

    const user = await this.user(userId);
    const entries = await this.fetchStakeSportBetEntries(token, maxBets);

    await this.prisma.bet.deleteMany({ where: { userId: user.id } });

    let imported = 0;
    let skipped = 0;

    const rows = this.stakeSportBetEntriesToRows(entries).sort(
      (a, b) => a.placedAt.getTime() - b.placedAt.getTime(),
    );

    const createRows: any[] = [];

    for (const row of rows) {
      if (
        !row.match ||
        row.match.startsWith('Stake fixture') ||
        !row.market ||
        row.market.startsWith('Market ') ||
        !Number.isFinite(row.stake) ||
        row.stake <= 0 ||
        !Number.isFinite(row.odds) ||
        Number.isNaN(row.placedAt.getTime())
      ) {
        skipped++;
        continue;
      }

      createRows.push({
        userId: user.id,
        n: createRows.length + 1,
        placedAt: row.placedAt,
        match: row.match,
        market: row.market,
        odds: row.odds,
        stake: row.stake,
        currency: row.currency,
        result: row.result,
        flag: null,
      });
    }

    if (createRows.length) {
      await this.prisma.bet.createMany({ data: createRows });
    }

    imported = createRows.length;
    await this.detectAndStoreTiltFlags(user.id);

    return {
      success: true,
      imported,
      skipped,
      fetched: entries.length,
      message: `Fetched ${entries.length} Stake bet${entries.length === 1 ? '' : 's'} and imported ${imported}. Skipped ${skipped} incomplete/unsupported record${skipped === 1 ? '' : 's'}.`,
    };
  }

  async importStakeBrowserEntries(userId: string, entries: any[]) {
    if (!Array.isArray(entries)) {
      throw new BadRequestException('Stake browser sync payload must include an entries array.');
    }

    const user = await this.user(userId);
    await this.prisma.bet.deleteMany({ where: { userId: user.id } });

    let imported = 0;
    let skipped = 0;

    const rows = this.stakeSportBetEntriesToRows(entries).sort(
      (a, b) => a.placedAt.getTime() - b.placedAt.getTime(),
    );

    const createRows: any[] = [];

    for (const row of rows) {
      if (
        !row.match ||
        row.match.startsWith('Stake fixture') ||
        !row.market ||
        row.market.startsWith('Market ') ||
        !Number.isFinite(row.stake) ||
        row.stake <= 0 ||
        !Number.isFinite(row.odds) ||
        Number.isNaN(row.placedAt.getTime())
      ) {
        skipped++;
        continue;
      }

      createRows.push({
        userId: user.id,
        n: createRows.length + 1,
        placedAt: row.placedAt,
        match: row.match,
        market: row.market,
        odds: row.odds,
        stake: row.stake,
        currency: row.currency,
        result: row.result,
        flag: null,
      });
    }

    if (createRows.length) {
      await this.prisma.bet.createMany({ data: createRows });
    }

    imported = createRows.length;
    await this.detectAndStoreTiltFlags(user.id);

    return {
      success: true,
      imported,
      skipped,
      fetched: entries.length,
      message: `Fetched ${entries.length} Stake bet${entries.length === 1 ? '' : 's'} from browser and imported ${imported}. Skipped ${skipped} incomplete/unsupported record${skipped === 1 ? '' : 's'}.`,
    };
  }
  async importStakeJsonFiles(userId: string, files: any[], stakeToken?: string) {
    const user = await this.user(userId);

    const rawFiles = files.map((file) => file.buffer.toString('utf8'));
    const fixtureIds = this.extractStakeFixtureIds(rawFiles);

    const metadata = stakeToken?.trim()
      ? await this.fetchStakeMetadata(stakeToken.trim(), fixtureIds).catch((error) => {
          console.warn('Stake metadata enrichment failed:', error?.message || error);
          return emptyStakeMetadata();
        })
      : emptyStakeMetadata();

    await this.prisma.bet.deleteMany({ where: { userId: user.id } });

    let imported = 0;
    let skipped = 0;

    for (const raw of rawFiles) {
      const result = await this.importStakeJson(userId, raw, false, metadata);
      imported += result.imported || 0;
      skipped += result.skipped || 0;
    }

    await this.renumberBets(user.id);
    await this.detectAndStoreTiltFlags(user.id);

    const enrichedCount =
      Object.keys(metadata.fixtureNameById).length +
      Object.keys(metadata.marketNameById).length +
      Object.keys(metadata.outcomeNameById).length;

    return {
      success: true,
      files: files.length,
      imported,
      skipped,
      enriched: enrichedCount > 0,
      fixtureIdsFound: fixtureIds.length,
      message: `Imported ${imported} Stake bet${imported === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}. Skipped ${skipped} duplicate/invalid record${skipped === 1 ? '' : 's'}.${enrichedCount > 0 ? ' Fixture, market and selection names were enriched from Stake.' : stakeToken?.trim() ? ' Stake token was received, but no matching fixture/market names were returned by Stake.' : ''}`,
    };
  }

  async importStakeJson(userId: string, rawJson: string, clearExisting = true, metadata: StakeMetadata = emptyStakeMetadata()) {
    let records: any[];

    try {
      records = JSON.parse(rawJson);
    } catch {
      throw new BadRequestException('Invalid Stake archive JSON file.');
    }

    if (!Array.isArray(records)) {
      throw new BadRequestException('Stake archive JSON must be an array.');
    }

    const user = await this.user(userId);

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
      const placedAt = new Date(data.createdAt || item.created_at);

      if (!Number.isFinite(stake) || stake <= 0 || !Number.isFinite(odds) || Number.isNaN(placedAt.getTime())) {
        skipped++;
        continue;
      }

      const resolved = this.resolveStakeLabels(data, outcome, metadata);
      const match = resolved.match;
      const market = resolved.market;
      const result = payout > stake ? 'W' : 'L';

      const duplicate = await this.prisma.bet.findFirst({
        where: {
          userId: user.id,
          placedAt,
          match,
          market,
          odds,
          stake,
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
          currency: String(data.currency || 'PKR').toUpperCase(),
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
      select: { id: true },
    });

    const updates = bets.map((bet, index) =>
      this.prisma.bet.update({
        where: { id: bet.id },
        data: { n: index + 1 },
      }),
    );

    await this.runInChunks(updates, 100);
  }

  private async detectAndStoreTiltFlags(userId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { placedAt: 'asc' },
      select: { id: true, placedAt: true, stake: true, result: true },
    });

    await this.prisma.bet.updateMany({ where: { userId, flag: 'tilt' }, data: { flag: null } });
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

    let left = 0;
    for (let right = 0; right < bets.length; right++) {
      while (bets[right].placedAt.getTime() - bets[left].placedAt.getTime() > 60 * 60 * 1000) {
        left++;
      }

      const session = bets.slice(left, right + 1);
      if (session.length < 4) continue;

      const sessionStake = session.reduce((sum, b) => sum + b.stake, 0);
      const sessionLosses = session.filter((b) => b.result === 'L').length;
      const lateSession = session.some((b) => b.placedAt.getHours() >= 22 || b.placedAt.getHours() < 3);

      if (sessionLosses >= 3 && lateSession && sessionStake > 0) {
        session.forEach((b) => flaggedIds.add(b.id));
      }
    }

    const ids = Array.from(flaggedIds);
    for (let i = 0; i < ids.length; i += 100) {
      await this.prisma.bet.updateMany({
        where: { id: { in: ids.slice(i, i + 100) } },
        data: { flag: 'tilt' },
      });
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
          ['Average stake', `€${avgStake.toFixed(2)}`, true],
          ['Session stake', `€${totalStake.toFixed(2)}`, true],
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

  private extractStakeFixtureIds(rawFiles: string[]) {
    const fixtureIds = new Set<string>();

    for (const raw of rawFiles) {
      try {
        const records = JSON.parse(raw);
        if (!Array.isArray(records)) continue;

        for (const item of records) {
          const outcomes = item?.data?.outcomes;
          if (!Array.isArray(outcomes)) continue;

          for (const outcome of outcomes) {
            const fixtureId = outcome?.fixtureId || outcome?.fixture?.id;
            if (fixtureId) fixtureIds.add(String(fixtureId));
          }
        }
      } catch {
        // Invalid JSON is handled later by importStakeJson().
      }
    }

    return Array.from(fixtureIds);
  }

  private async fetchStakeSportBetEntries(stakeToken: string, maxBets = 500) {
    // Same data source as Stake > My Bets > Sports.
    // This endpoint needs a Stake x-access-token, but no JSON upload is needed.
    const query = `
      query SportSportList($limit: Int!, $offset: Int!) {
        user {
          id
          name
          sportBetList(limit: $limit, offset: $offset) {
            id
            iid
            bet {
              __typename
              ... on SportBet {
                id
                amount
                currency
                status
                payout
                createdAt
                updatedAt
                potentialMultiplier
                bet { iid }
                outcomes {
                  id
                  odds
                  status
                  outcome { id name odds }
                  market { id name status provider }
                  fixture {
                    id
                    name
                    status
                    provider
                    tournament { name slug category { name slug sport { name slug } } }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const entries: any[] = [];
    const pageSize = 50;
    const safeMax = Math.max(1, Math.min(Number(maxBets) || 500, 1000));

    for (let offset = 0; offset < safeMax; offset += pageSize) {
      const json: any = await this.stakeGraphql(stakeToken, {
        operationName: 'SportSportList',
        query,
        variables: { limit: Math.min(pageSize, safeMax - offset), offset },
      });

      const list = json?.data?.user?.sportBetList || [];
      if (!list.length) break;

      entries.push(...list);
      if (list.length < pageSize || entries.length >= safeMax) break;
    }

    return entries.slice(0, safeMax);
  }

  private stakeSportBetEntriesToRows(entries: any[]) {
    const rows: Array<{
      placedAt: Date;
      match: string;
      market: string;
      odds: number;
      stake: number;
      currency: string;
      result: string;
    }> = [];

    for (const entry of entries) {
      const bet = entry?.bet;
      if (!bet || bet.__typename !== 'SportBet') continue;

      const outcomes = Array.isArray(bet.outcomes) ? bet.outcomes : [];
      if (!outcomes.length) continue;

      const placedAt = new Date(bet.createdAt);
      const stake = Number(bet.amount || 0);
      const payout = Number(bet.payout || 0);
      const currency = String(bet.currency || 'PKR').toUpperCase();
      const fallbackResult = payout > stake ? 'W' : 'L';

      for (const outcome of outcomes) {
        const fixture = outcome?.fixture;
        const market = outcome?.market;
        const selection = outcome?.outcome;
        const odds = Number(outcome?.odds || bet.potentialMultiplier || selection?.odds || 1);

        rows.push({
          placedAt,
          match: fixture?.name || `Stake fixture ${fixture?.id || 'Unknown'}`,
          market: selection?.name
            ? `${market?.name || 'Sportsbook'} · ${selection.name}`
            : market?.name || 'Sportsbook',
          odds,
          stake,
          currency,
          result: outcome?.status === 'won' ? 'W' : outcome?.status === 'lost' ? 'L' : fallbackResult,
        });
      }
    }

    return rows;
  }

  private async fetchStakeMetadata(stakeToken: string, fixtureIds: string[] = []): Promise<StakeMetadata> {
    const metadata = emptyStakeMetadata();

    await this.fetchStakeUserBetListMetadata(stakeToken, metadata);

    const missingFixtureIds = fixtureIds.filter((fixtureId) => !metadata.fixtureNameById[fixtureId]);
    for (const fixtureId of missingFixtureIds) {
      await this.fetchStakeFixtureMetadata(stakeToken, fixtureId, metadata).catch((error) => {
        console.warn(`Stake fixture enrichment failed for ${fixtureId}:`, error?.message || error);
      });
    }

    return metadata;
  }

  private async fetchStakeUserBetListMetadata(stakeToken: string, metadata: StakeMetadata) {
    // Same data source as Stake > My Bets > Sports.
    // Keep this query simple: no status enum and no SportsbookXMultiBet union fields.
    // Your normal archive records are SportBet records, and these fields return
    // readable fixture, market and selection names.
    const query = `
      query SportSportList($limit: Int!, $offset: Int!) {
        user {
          id
          name
          sportBetList(limit: $limit, offset: $offset) {
            id
            iid
            bet {
              __typename
              ... on SportBet {
                id
                amount
                currency
                status
                payout
                createdAt
                updatedAt
                potentialMultiplier
                bet { iid }
                outcomes {
                  id
                  odds
                  status
                  outcome { id name odds }
                  market { id name status provider }
                  fixture {
                    id
                    name
                    status
                    provider
                    tournament { name slug category { name slug sport { name slug } } }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let loaded = 0;

    for (let offset = 0; offset < 500; offset += 50) {
      const json: any = await this.stakeGraphql(stakeToken, {
        operationName: 'SportSportList',
        query,
        variables: { limit: 50, offset },
      });

      const list = json?.data?.user?.sportBetList || [];
      if (!list.length) break;

      loaded += list.length;

      for (const entry of list) {
        const bet = entry?.bet || {};
        const betIds = [entry?.id, entry?.iid, bet?.id, bet?.bet?.iid].filter(Boolean).map(String);
        const outcomes = Array.isArray(bet?.outcomes) ? bet.outcomes : [];

        for (const o of outcomes) {
          this.addStakeMetadata(metadata, o?.fixture, o?.market, o?.outcome, betIds);
        }
      }

      if (list.length < 50) break;
    }

    console.log('Stake sportBetList metadata loaded:', {
      betsChecked: loaded,
      fixtures: Object.keys(metadata.fixtureNameById).length,
      markets: Object.keys(metadata.marketNameById).length,
      outcomes: Object.keys(metadata.outcomeNameById).length,
      betIds: Object.keys(metadata.byBetId).length,
    });
  }

  private async fetchStakeFixtureMetadata(stakeToken: string, fixtureId: string, metadata: StakeMetadata) {
    const query = `
      query Fixture($id: String!) {
        fixture(id: $id) {
          id
          name
          tournament {
            name
            category { name sport { name slug } }
          }
          markets {
            id
            name
            outcomes { id name odds }
          }
        }
      }
    `;

    const json = await this.stakeGraphql(stakeToken, {
      operationName: 'Fixture',
      query,
      variables: { id: fixtureId },
    });

    const fixture = json?.data?.fixture;
    if (!fixture?.id) return;

    if (fixture.name) metadata.fixtureNameById[String(fixture.id)] = fixture.name;

    const markets = Array.isArray(fixture.markets) ? fixture.markets : [];
    for (const market of markets) {
      if (market?.id && market?.name) metadata.marketNameById[String(market.id)] = market.name;

      const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
      for (const outcome of outcomes) {
        if (outcome?.id && outcome?.name) metadata.outcomeNameById[String(outcome.id)] = outcome.name;
      }
    }
  }

  private async stakeGraphql(stakeToken: string, body: any) {
    const cleanToken = stakeToken.replace(/^Bearer\s+/i, '').trim();

    const response = await fetch('https://stake.com/_api/graphql', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://stake.com',
        referer: 'https://stake.com/my-bets/sports/settled',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
        'x-access-token': cleanToken,
        authorization: `Bearer ${cleanToken}`,
        'x-language': 'en',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let json: any;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      console.warn('Stake GraphQL HTTP error:', response.status, JSON.stringify(json).slice(0, 1000));
      throw new BadRequestException(`Stake metadata request failed with status ${response.status}`);
    }

    if (json?.errors?.length) {
      console.warn('Stake GraphQL errors:', JSON.stringify(json.errors, null, 2));
      throw new BadRequestException(json.errors[0]?.message || 'Stake metadata request failed.');
    }

    return json;
  }

  private addStakeMetadata(metadata: StakeMetadata, fixture: any, market: any, outcome: any, betIds: string[] = []) {
    if (fixture?.id && fixture?.name) metadata.fixtureNameById[String(fixture.id)] = String(fixture.name);
    if (market?.id && market?.name) metadata.marketNameById[String(market.id)] = String(market.name);
    if (outcome?.id && outcome?.name) metadata.outcomeNameById[String(outcome.id)] = String(outcome.name);

    const readable = {
      match: fixture?.name ? String(fixture.name) : undefined,
      market: market?.name ? String(market.name) : undefined,
      selection: outcome?.name ? String(outcome.name) : undefined,
    };

    for (const id of betIds) {
      if (!id) continue;
      metadata.byBetId[String(id)] = { ...metadata.byBetId[String(id)], ...readable };
    }
  }

  private resolveStakeLabels(data: any, outcome: any, metadata: StakeMetadata) {
    const betMeta = metadata.byBetId[data?.id] || metadata.byBetId[data?.iid] || {};
    const fixtureId = outcome?.fixtureId || outcome?.fixture?.id;
    const marketId = outcome?.marketId || outcome?.market?.id;
    const outcomeId = outcome?.outcomeId || outcome?.outcome?.id;

    const match =
      betMeta.match ||
      (fixtureId ? metadata.fixtureNameById[fixtureId] : undefined) ||
      this.stakeMatchLabel(outcome);

    const marketName =
      betMeta.market ||
      (marketId ? metadata.marketNameById[marketId] : undefined) ||
      this.stakeMarketLabel(outcome);

    const selection =
      betMeta.selection ||
      (outcomeId ? metadata.outcomeNameById[outcomeId] : undefined) ||
      outcome?.outcomeName ||
      outcome?.outcome?.name;

    return {
      match,
      market: selection ? `${marketName} · ${selection}` : marketName,
    };
  }

  private stakeMatchLabel(outcome: any) {
    return outcome?.fixtureName || outcome?.fixture?.name || `Stake fixture ${outcome?.fixtureId || 'Unknown'}`;
  }

  private stakeMarketLabel(outcome: any) {
    return outcome?.marketName || outcome?.market?.name || (outcome?.marketId ? `Market ${outcome.marketId}` : 'Sportsbook');
  }

  private safeLimit(value: any, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  private async runInChunks(items: any[], chunkSize: number) {
    for (let i = 0; i < items.length; i += chunkSize) {
      await this.prisma.$transaction(items.slice(i, i + chunkSize));
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
