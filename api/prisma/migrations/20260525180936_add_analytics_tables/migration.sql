-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "from_status" "TaskStatus",
    "to_status" "TaskStatus" NOT NULL,
    "changed_by_user_id" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_analytics_settings" (
    "team_id" UUID NOT NULL,
    "workload_max_median_warn" DOUBLE PRECISION NOT NULL,
    "workload_max_median_crit" DOUBLE PRECISION NOT NULL,
    "review_p75_days_warn" DOUBLE PRECISION NOT NULL,
    "review_p75_days_crit" DOUBLE PRECISION NOT NULL,
    "throughput_drop_pct_warn" DOUBLE PRECISION NOT NULL,
    "throughput_drop_pct_crit" DOUBLE PRECISION NOT NULL,
    "overdue_count_warn" INTEGER NOT NULL,
    "overdue_count_crit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_analytics_settings_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'ACTIVE',
    "room_name" TEXT NOT NULL,
    "started_by_user_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "call_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("call_id","user_id")
);

-- CreateIndex
CREATE INDEX "task_status_history_task_id_changed_at_idx" ON "task_status_history"("task_id", "changed_at");

-- CreateIndex
CREATE INDEX "task_status_history_team_id_to_status_changed_at_idx" ON "task_status_history"("team_id", "to_status", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "calls_room_name_key" ON "calls"("room_name");

-- CreateIndex
CREATE INDEX "calls_team_id_status_idx" ON "calls"("team_id", "status");

-- CreateIndex
CREATE INDEX "calls_team_id_started_at_idx" ON "calls"("team_id", "started_at");

-- CreateIndex
CREATE INDEX "call_participants_team_id_user_id_idx" ON "call_participants"("team_id", "user_id");

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_team_id_changed_by_user_id_fkey" FOREIGN KEY ("team_id", "changed_by_user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "team_analytics_settings" ADD CONSTRAINT "team_analytics_settings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_team_id_started_by_user_id_fkey" FOREIGN KEY ("team_id", "started_by_user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_team_id_user_id_fkey" FOREIGN KEY ("team_id", "user_id") REFERENCES "team_members"("team_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
