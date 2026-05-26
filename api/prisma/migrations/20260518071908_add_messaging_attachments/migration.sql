-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'UPLOADED', 'LINKED');

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChannelType" NOT NULL DEFAULT 'PUBLIC',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "author_user_id" UUID,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "uploader_user_id" UUID,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "linked_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channels_team_id_archived_at_idx" ON "channels"("team_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "channels_team_id_name_key" ON "channels"("team_id", "name");

-- CreateIndex
CREATE INDEX "messages_channel_id_created_at_idx" ON "messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_team_id_author_user_id_idx" ON "messages"("team_id", "author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_status_created_at_idx" ON "attachments"("status", "created_at");

-- CreateIndex
CREATE INDEX "attachments_linked_message_id_idx" ON "attachments"("linked_message_id");

-- CreateIndex
CREATE INDEX "attachments_team_id_uploader_user_id_idx" ON "attachments"("team_id", "uploader_user_id");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_team_id_author_user_id_fkey" FOREIGN KEY ("team_id", "author_user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_team_id_uploader_user_id_fkey" FOREIGN KEY ("team_id", "uploader_user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_linked_message_id_fkey" FOREIGN KEY ("linked_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
