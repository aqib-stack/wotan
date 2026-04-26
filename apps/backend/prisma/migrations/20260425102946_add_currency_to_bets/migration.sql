-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookmakerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookmakerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "match" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "result" TEXT NOT NULL,
    "flag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorScore" DOUBLE PRECISION NOT NULL,
    "rating" TEXT NOT NULL,
    "totalBets" INTEGER NOT NULL,
    "totalStaked" DOUBLE PRECISION NOT NULL,
    "totalReturned" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightMetricScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightMetricScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiltEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "betCount" INTEGER NOT NULL,
    "signals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiltEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bet_userId_placedAt_idx" ON "Bet"("userId", "placedAt");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
