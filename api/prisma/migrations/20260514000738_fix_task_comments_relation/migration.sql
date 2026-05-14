/*
  Warnings:

  - You are about to drop the column `author_id` on the `task_comments` table. All the data in the column will be lost.
  - Added the required column `team_id` to the `task_comments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_author_id_fkey";

-- AlterTable
ALTER TABLE "task_comments" DROP COLUMN "author_id",
ADD COLUMN     "author_user_id" UUID,
ADD COLUMN     "team_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "task_comments_team_id_author_user_id_idx" ON "task_comments"("team_id", "author_user_id");

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_team_id_author_user_id_fkey" FOREIGN KEY ("team_id", "author_user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
