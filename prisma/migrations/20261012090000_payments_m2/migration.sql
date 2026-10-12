-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'TEST';

-- DropIndex
DROP INDEX "Payment_providerOrderId_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "attentionAt" TIMESTAMP(3),
ADD COLUMN     "attentionReason" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Payment_providerOrderId_idx" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE INDEX "Payment_attentionAt_idx" ON "Payment"("attentionAt");

