-- AlterTable
ALTER TABLE "discovery_shares" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "proposal_shares" ADD COLUMN     "expires_at" TIMESTAMP(3);
