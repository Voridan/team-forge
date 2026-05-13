/*
  Warnings:

  - The values [AUTH0] on the enum `AuthProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `auth0_id` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[auth_provider,external_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuthProvider_new" AS ENUM ('LOCAL', 'GOOGLE');
ALTER TABLE "users" ALTER COLUMN "auth_provider" TYPE "AuthProvider_new" USING ("auth_provider"::text::"AuthProvider_new");
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "public"."AuthProvider_old";
COMMIT;

-- DropIndex
DROP INDEX "users_auth0_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "auth0_id",
ADD COLUMN     "external_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_external_id_key" ON "users"("auth_provider", "external_id");
