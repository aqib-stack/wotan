import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const filePath = "prisma/stake-bets.json";
  const raw = fs.readFileSync(filePath, "utf8");
  const records = JSON.parse(raw);

let user = await prisma.user.findFirst({
  where: {
    email: 'sample@wotan.local',
  },
});

if (!user) {
  user = await prisma.user.create({
  data: {
    fullName: 'Sample User',
    email: 'sample@wotan.local',
    passwordHash: 'sample-password-placeholder',
    status: 'APPROVED',
    subscriptionStatus: 'ACTIVE',
    emailVerified: true,
  },
});
}

  await prisma.bet.deleteMany();

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const data = item.data;
    const outcome = data.outcomes?.[0];

    const stake = Number(data.amount || 0);
    const payout = Number(data.payout || 0);
    const odds = Number(outcome?.odds || data.potentialMultiplier || 1);
    const currency = String(data.currency || "PKR").toUpperCase();

    await prisma.bet.create({
      data: {
        userId: user.id,
        n: i + 1,
        placedAt: new Date(data.createdAt || item.created_at),
        match: `Stake fixture ${outcome?.fixtureId || "Unknown"}`,
        market: outcome?.marketId ? `Market ${outcome.marketId}` : "Sportsbook",
        odds,
        stake,
        currency,
        result: payout > 0 ? "W" : "L",
        flag: null,
      },
    });
  }

  console.log(`✅ Imported ${records.length} Stake bets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());