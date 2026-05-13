/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredCurrency" TEXT NOT NULL DEFAULT 'PKR',
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "stakeUsername" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "BookmakerConnection_userId_idx" ON "BookmakerConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- AddForeignKey
ALTER TABLE "BookmakerConnection" ADD CONSTRAINT "BookmakerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
