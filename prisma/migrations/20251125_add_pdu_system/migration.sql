-- CreateEnum: PDU and Outlet Enums
CREATE TYPE "outlet_status" AS ENUM ('active', 'idle', 'inactive', 'error', 'maintenance');
CREATE TYPE "pdu_type" AS ENUM ('cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension');

-- CreateTable: power_distribution_units
CREATE TABLE "power_distribution_units" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "department_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "type" "pdu_type" NOT NULL DEFAULT 'cart',
    "description" VARCHAR(255),
    "location" VARCHAR(255),
    "floor" VARCHAR(50),
    "building" VARCHAR(100),
    "total_outlets" INTEGER NOT NULL DEFAULT 4,
    "max_power_watts" REAL DEFAULT 10000,
    "voltage_rating" REAL DEFAULT 220,
    "mqtt_base_topic" VARCHAR(255),
    "manufacturer" VARCHAR(100),
    "model_number" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "is_mobile" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "specifications" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "power_distribution_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable: outlets
CREATE TABLE "outlets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pdu_id" UUID NOT NULL,
    "outlet_number" INTEGER NOT NULL,
    "name" VARCHAR(100),
    "description" VARCHAR(255),
    "mqtt_topic_suffix" VARCHAR(100) NOT NULL,
    "max_power_watts" REAL DEFAULT 3000,
    "outlet_type" VARCHAR(50),
    "device_id" UUID,
    "assigned_at" TIMESTAMPTZ,
    "assigned_by" UUID,
    "status" "outlet_status" NOT NULL DEFAULT 'inactive',
    "last_data_at" TIMESTAMPTZ,
    "current_power" REAL,
    "current_voltage" REAL,
    "current_current" REAL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER DEFAULT 1,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- Add outlet_id to device_data
ALTER TABLE "device_data" ADD COLUMN "outlet_id" UUID;

-- Add outlet_id to device_data_logs  
ALTER TABLE "device_data_logs" ADD COLUMN "outlet_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "unique_org_pdu_code" ON "power_distribution_units"("organization_id", "code");
CREATE INDEX "idx_pdu_org" ON "power_distribution_units"("organization_id");
CREATE INDEX "idx_pdu_dept" ON "power_distribution_units"("department_id");
CREATE INDEX "idx_pdu_type" ON "power_distribution_units"("type");
CREATE INDEX "idx_pdu_active" ON "power_distribution_units"("is_active");
CREATE INDEX "idx_pdu_location" ON "power_distribution_units"("location");

CREATE UNIQUE INDEX "unique_pdu_outlet" ON "outlets"("pdu_id", "outlet_number");
CREATE UNIQUE INDEX "outlets_device_id_key" ON "outlets"("device_id");
CREATE INDEX "idx_outlets_pdu" ON "outlets"("pdu_id");
CREATE INDEX "idx_outlets_device" ON "outlets"("device_id");
CREATE INDEX "idx_outlets_status" ON "outlets"("status");
CREATE INDEX "idx_outlets_enabled" ON "outlets"("is_enabled");
CREATE INDEX "idx_outlets_number" ON "outlets"("outlet_number");

CREATE INDEX "idx_device_data_outlet_time" ON "device_data"("outlet_id", "timestamp" DESC);
CREATE INDEX "idx_device_data_logs_outlet_time" ON "device_data_logs"("outlet_id", "timestamp");

-- AddForeignKey
ALTER TABLE "power_distribution_units" ADD CONSTRAINT "power_distribution_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_distribution_units" ADD CONSTRAINT "power_distribution_units_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_distribution_units" ADD CONSTRAINT "power_distribution_units_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outlets" ADD CONSTRAINT "outlets_pdu_id_fkey" FOREIGN KEY ("pdu_id") REFERENCES "power_distribution_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_data" ADD CONSTRAINT "device_data_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "device_data_logs" ADD CONSTRAINT "device_data_logs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;