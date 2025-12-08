/*
  Warnings:

  - You are about to drop the column `outlet_id` on the `device_data` table. All the data in the column will be lost.
  - You are about to drop the column `outlet_id` on the `device_data_logs` table. All the data in the column will be lost.
  - You are about to drop the column `total_outlets` on the `power_distribution_units` table. All the data in the column will be lost.
  - You are about to drop the `auo_display` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `camera_control_unit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `electronic_endoflator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `led_nova_100` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `outlets` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('completed', 'failed', 'partial', 'cancelled');

-- CreateEnum
CREATE TYPE "maintenance_severity" AS ENUM ('routine', 'urgent', 'emergency');

-- CreateEnum
CREATE TYPE "device_condition" AS ENUM ('excellent', 'good', 'fair', 'poor', 'critical');

-- CreateEnum
CREATE TYPE "device_visibility" AS ENUM ('public', 'department', 'private');

-- CreateEnum
CREATE TYPE "socket_status" AS ENUM ('active', 'idle', 'inactive', 'error', 'maintenance');

-- DropForeignKey
ALTER TABLE "device_data" DROP CONSTRAINT "device_data_outlet_id_fkey";

-- DropForeignKey
ALTER TABLE "device_data_logs" DROP CONSTRAINT "device_data_logs_outlet_id_fkey";

-- DropForeignKey
ALTER TABLE "outlets" DROP CONSTRAINT "outlets_assigned_by_fkey";

-- DropForeignKey
ALTER TABLE "outlets" DROP CONSTRAINT "outlets_device_id_fkey";

-- DropForeignKey
ALTER TABLE "outlets" DROP CONSTRAINT "outlets_pdu_id_fkey";

-- DropIndex
DROP INDEX "idx_device_data_outlet_time";

-- DropIndex
DROP INDEX "idx_device_data_logs_outlet_time";

-- AlterTable
ALTER TABLE "device" ADD COLUMN     "visibility" "device_visibility" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "device_data" DROP COLUMN "outlet_id",
ADD COLUMN     "socket_id" UUID;

-- AlterTable
ALTER TABLE "device_data_logs" DROP COLUMN "outlet_id",
ADD COLUMN     "socket_id" UUID;

-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "maintenance_history_id" UUID;

-- AlterTable
ALTER TABLE "power_distribution_units" DROP COLUMN "total_outlets",
ADD COLUMN     "total_sockets" INTEGER NOT NULL DEFAULT 4;

-- DropTable
DROP TABLE "auo_display";

-- DropTable
DROP TABLE "camera_control_unit";

-- DropTable
DROP TABLE "electronic_endoflator";

-- DropTable
DROP TABLE "led_nova_100";

-- DropTable
DROP TABLE "outlets";

-- DropEnum
DROP TYPE "outlet_status";

-- CreateTable
CREATE TABLE "maintenance_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "schedule_id" UUID,
    "maintenance_type" "maintenance_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "performed_date" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER,
    "performed_by" UUID,
    "technician_name" VARCHAR(255),
    "department_id" UUID,
    "cost" DECIMAL(12,2),
    "currency" VARCHAR(3) DEFAULT 'VND',
    "parts_replaced" JSONB DEFAULT '[]',
    "consumables_used" JSONB DEFAULT '[]',
    "status" "maintenance_status" NOT NULL DEFAULT 'completed',
    "severity" "maintenance_severity" NOT NULL DEFAULT 'routine',
    "issues_found" TEXT,
    "actions_taken" TEXT,
    "recommendations" TEXT,
    "device_condition" "device_condition",
    "performance_rating" SMALLINT,
    "next_maintenance_date" DATE,
    "next_maintenance_type" "maintenance_type",
    "attachments" JSONB DEFAULT '[]',
    "photos" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,

    CONSTRAINT "maintenance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_parts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "maintenance_id" UUID NOT NULL,
    "part_name" VARCHAR(255) NOT NULL,
    "part_number" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2),
    "total_cost" DECIMAL(12,2),
    "supplier" VARCHAR(255),
    "warranty_months" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sockets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pdu_id" UUID NOT NULL,
    "socket_number" INTEGER NOT NULL,
    "name" VARCHAR(100),
    "description" VARCHAR(255),
    "mqtt_topic_suffix" VARCHAR(100) NOT NULL,
    "max_power_watts" REAL DEFAULT 3000,
    "socket_type" VARCHAR(50),
    "device_id" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "assigned_by" UUID,
    "status" "socket_status" NOT NULL DEFAULT 'inactive',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER DEFAULT 1,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "mqtt_broker_host" VARCHAR(255),
    "mqtt_broker_port" INTEGER DEFAULT 1883,
    "mqtt_credentials" JSONB DEFAULT '{}',
    "mqtt_config" JSONB DEFAULT '{}',

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_current_state" (
    "device_id" UUID NOT NULL,
    "socket_id" UUID,
    "active_power" REAL,
    "apparent_power" REAL,
    "voltage" REAL,
    "current" REAL,
    "power_factor" REAL,
    "frequency" REAL,
    "is_connected" BOOLEAN DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_current_state_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "device_statistics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "outlet_id" UUID,
    "period_type" VARCHAR(10) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "total_measurements" INTEGER DEFAULT 0,
    "successful_measurements" INTEGER DEFAULT 0,
    "failed_measurements" INTEGER DEFAULT 0,
    "avg_voltage" DECIMAL(8,3),
    "min_voltage" DECIMAL(8,3),
    "max_voltage" DECIMAL(8,3),
    "avg_current" DECIMAL(8,3),
    "min_current" DECIMAL(8,3),
    "max_current" DECIMAL(8,3),
    "avg_power" DECIMAL(10,3),
    "min_power" DECIMAL(10,3),
    "max_power" DECIMAL(10,3),
    "total_energy_kwh" DECIMAL(12,6),
    "uptime_percentage" DECIMAL(5,2),
    "socket_active_percentage" DECIMAL(5,2),
    "voltage_alerts_count" INTEGER DEFAULT 0,
    "current_alerts_count" INTEGER DEFAULT 0,
    "power_alerts_count" INTEGER DEFAULT 0,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket1_data" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "power" REAL,
    "machine_state" BOOLEAN DEFAULT false,
    "socket_state" BOOLEAN DEFAULT false,
    "sensor_state" BOOLEAN DEFAULT false,
    "over_voltage" BOOLEAN DEFAULT false,
    "under_voltage" BOOLEAN DEFAULT false,

    CONSTRAINT "socket1_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket2_data" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "power" REAL,
    "machine_state" BOOLEAN DEFAULT false,
    "socket_state" BOOLEAN DEFAULT false,
    "sensor_state" BOOLEAN DEFAULT false,
    "over_voltage" BOOLEAN DEFAULT false,
    "under_voltage" BOOLEAN DEFAULT false,

    CONSTRAINT "socket2_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket3_data" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "power" REAL,
    "machine_state" BOOLEAN DEFAULT false,
    "socket_state" BOOLEAN DEFAULT false,
    "sensor_state" BOOLEAN DEFAULT false,
    "over_voltage" BOOLEAN DEFAULT false,
    "under_voltage" BOOLEAN DEFAULT false,

    CONSTRAINT "socket3_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket4_data" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "power" REAL,
    "machine_state" BOOLEAN DEFAULT false,
    "socket_state" BOOLEAN DEFAULT false,
    "sensor_state" BOOLEAN DEFAULT false,
    "over_voltage" BOOLEAN DEFAULT false,
    "under_voltage" BOOLEAN DEFAULT false,

    CONSTRAINT "socket4_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_maintenance_history_device" ON "maintenance_history"("device_id");

-- CreateIndex
CREATE INDEX "idx_maintenance_history_date" ON "maintenance_history"("performed_date" DESC);

-- CreateIndex
CREATE INDEX "idx_maintenance_history_org" ON "maintenance_history"("organization_id");

-- CreateIndex
CREATE INDEX "idx_maintenance_history_type" ON "maintenance_history"("maintenance_type");

-- CreateIndex
CREATE INDEX "idx_maintenance_history_status" ON "maintenance_history"("status");

-- CreateIndex
CREATE INDEX "idx_maintenance_history_performer" ON "maintenance_history"("performed_by");

-- CreateIndex
CREATE INDEX "idx_maintenance_device_date" ON "maintenance_history"("device_id", "performed_date" DESC);

-- CreateIndex
CREATE INDEX "idx_maintenance_parts_maintenance" ON "maintenance_parts"("maintenance_id");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_device_id_key" ON "sockets"("device_id");

-- CreateIndex
CREATE INDEX "idx_sockets_pdu" ON "sockets"("pdu_id");

-- CreateIndex
CREATE INDEX "idx_sockets_device" ON "sockets"("device_id");

-- CreateIndex
CREATE INDEX "idx_sockets_status" ON "sockets"("status");

-- CreateIndex
CREATE INDEX "idx_sockets_enabled" ON "sockets"("is_enabled");

-- CreateIndex
CREATE INDEX "idx_sockets_number" ON "sockets"("socket_number");

-- CreateIndex
CREATE INDEX "idx_sockets_mqtt_broker" ON "sockets"("mqtt_broker_host");

-- CreateIndex
CREATE UNIQUE INDEX "unique_pdu_socket" ON "sockets"("pdu_id", "socket_number");

-- CreateIndex
CREATE INDEX "idx_device_statistics_device_period" ON "device_statistics"("device_id", "period_type", "period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_device_statistics_unique" ON "device_statistics"("device_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "idx_device_visibility" ON "device"("visibility");

-- CreateIndex
CREATE INDEX "idx_device_org_visibility" ON "device"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "idx_device_connectivity_active_recent" ON "device_connectivity"("device_id", "is_active", "last_connected");

-- CreateIndex
CREATE INDEX "idx_device_data_socket_time" ON "device_data"("socket_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_device_data_logs_socket_time" ON "device_data_logs"("socket_id", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "device_data" ADD CONSTRAINT "device_data_outlet_id_fkey" FOREIGN KEY ("socket_id") REFERENCES "sockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_data_logs" ADD CONSTRAINT "device_data_logs_outlet_id_fkey" FOREIGN KEY ("socket_id") REFERENCES "sockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_parts" ADD CONSTRAINT "maintenance_parts_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "maintenance_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sockets" ADD CONSTRAINT "outlets_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sockets" ADD CONSTRAINT "outlets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sockets" ADD CONSTRAINT "outlets_pdu_id_fkey" FOREIGN KEY ("pdu_id") REFERENCES "power_distribution_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_current_state" ADD CONSTRAINT "device_current_state_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_current_state" ADD CONSTRAINT "device_current_state_socket_id_fkey" FOREIGN KEY ("socket_id") REFERENCES "sockets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_statistics" ADD CONSTRAINT "device_statistics_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_statistics" ADD CONSTRAINT "device_statistics_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "sockets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
