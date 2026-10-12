-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "wholesaleIntro" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceDueAt" TIMESTAMP(3),
ADD COLUMN     "paymentTerms" "WholesalePaymentTerms" NOT NULL DEFAULT 'PREPAID';

-- AlterTable
ALTER TABLE "WholesaleProfile" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "creditDays" INTEGER,
ADD COLUMN     "expectedVolume" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "socialUrl" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- Existing applications were submitted when the profile was created.
UPDATE "WholesaleProfile" SET "submittedAt" = "createdAt";
