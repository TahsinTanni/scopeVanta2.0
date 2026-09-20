-- AlterTable
ALTER TABLE "proposal_shares" ADD COLUMN     "release_hash" TEXT,
ADD COLUMN     "release_id" TEXT,
ADD COLUMN     "released_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_shares_release_id_key" ON "proposal_shares"("release_id");
