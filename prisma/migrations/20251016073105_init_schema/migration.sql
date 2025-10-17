-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('active', 'inactive', 'maintenance', 'decommissioned');

-- CreateEnum
CREATE TYPE "access_level" AS ENUM ('read', 'write', 'admin', 'none');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('active', 'acknowledged', 'resolved', 'suppressed');

-- CreateEnum
CREATE TYPE "assignment_role" AS ENUM ('assignee', 'reviewer', 'escalation');

-- CreateEnum
CREATE TYPE "condition_type" AS ENUM ('greater_than', 'less_than', 'equal', 'between', 'not_equal');

-- CreateEnum
CREATE TYPE "escalation_level" AS ENUM ('L1', 'L2', 'L3', 'executive');

-- CreateEnum
CREATE TYPE "maintenance_type" AS ENUM ('preventive', 'corrective', 'emergency', 'calibration');

-- CreateEnum
CREATE TYPE "measurement_data_type" AS ENUM ('numeric', 'text', 'boolean', 'json');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('email', 'sms', 'webhook', 'push', 'slack', 'telegram');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed', 'retry');

-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('hospital', 'factory', 'school', 'office', 'laboratory');

-- CreateEnum
CREATE TYPE "report_format" AS ENUM ('pdf', 'excel', 'csv', 'json');

-- CreateEnum
CREATE TYPE "schedule_status" AS ENUM ('pending', 'completed', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "suppression_type" AS ENUM ('manual', 'scheduled', 'maintenance');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'permission_granted', 'permission_revoked', 'role_assigned', 'role_removed', 'access_denied', 'password_changed');

-- CreateTable
CREATE TABLE "device_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,

    CONSTRAINT "device_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "specifications" TEXT,
    "model_number" VARCHAR(100),
    "manufacturer_id" UUID,
    "supplier_id" UUID,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specifications" (
    "id" SERIAL NOT NULL,
    "device_model_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "field_name_vi" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(50),
    "description" TEXT,
    "display_order" INTEGER,
    "numeric_value" DECIMAL(15,4),
    "is_visible" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specification_fields" (
    "field_name" VARCHAR(100) NOT NULL,
    "field_name_vi" VARCHAR(100) NOT NULL,
    "field_name_en" VARCHAR(100),
    "unit" VARCHAR(50),
    "category" VARCHAR(50),
    "data_type" VARCHAR(20) DEFAULT 'text',
    "placeholder" VARCHAR(255),
    "help_text" TEXT,
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specification_fields_pkey" PRIMARY KEY ("field_name")
);

-- CreateTable
CREATE TABLE "device" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "model_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "department_id" UUID,
    "serial_number" VARCHAR(255) NOT NULL,
    "asset_tag" VARCHAR(100),
    "status" "device_status" NOT NULL DEFAULT 'active',
    "purchase_date" DATE,
    "installation_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "location" VARCHAR(255),
    "notes" TEXT,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_info" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "warranty_start" DATE NOT NULL,
    "warranty_end" DATE NOT NULL,
    "provider" VARCHAR(255) NOT NULL,

    CONSTRAINT "warranty_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_connectivity" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "mqtt_user" VARCHAR(100),
    "mqtt_pass" VARCHAR(255),
    "mqtt_topic" VARCHAR(255),
    "broker_host" VARCHAR(255),
    "broker_port" INTEGER DEFAULT 1883,
    "ssl_enabled" BOOLEAN DEFAULT false,
    "heartbeat_interval" INTEGER DEFAULT 300,
    "last_connected" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_connectivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "type" "organization_type" NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "license_number" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT,
    "website" TEXT,
    "description" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "code" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_warning_logs" (
    "id" SERIAL NOT NULL,
    "device_type" TEXT NOT NULL,
    "device_name" TEXT,
    "device_id" INTEGER,
    "warning_type" TEXT NOT NULL,
    "warning_severity" TEXT NOT NULL,
    "measured_value" DOUBLE PRECISION,
    "threshold_value" DOUBLE PRECISION,
    "warning_message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "resolved_at" TIMESTAMP(3),
    "acknowledged_by" INTEGER,
    "resolution_notes" TEXT,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_warning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "target" VARCHAR(100),
    "details" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_assignments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "alert_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by" UUID,
    "role" "assignment_role" NOT NULL DEFAULT 'assignee',
    "escalation_level" "escalation_level" DEFAULT 'L1',
    "priority" INTEGER DEFAULT 1,
    "auto_escalate_minutes" INTEGER DEFAULT 30,
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "alert_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_metrics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_alerts" INTEGER DEFAULT 0,
    "critical_alerts" INTEGER DEFAULT 0,
    "high_alerts" INTEGER DEFAULT 0,
    "medium_alerts" INTEGER DEFAULT 0,
    "low_alerts" INTEGER DEFAULT 0,
    "resolved_alerts" INTEGER DEFAULT 0,
    "average_resolution_time_minutes" INTEGER DEFAULT 0,
    "false_positive_rate" DECIMAL(5,2) DEFAULT 0.00,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "device_id" UUID,
    "measurement_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "condition" "condition_type" NOT NULL,
    "threshold_value" DOUBLE PRECISION,
    "threshold_min" DOUBLE PRECISION,
    "threshold_max" DOUBLE PRECISION,
    "severity" "alert_severity" NOT NULL DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cooldown_minutes" INTEGER DEFAULT 15,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_suppressions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "device_id" UUID,
    "measurement_id" UUID,
    "rule_id" UUID,
    "type" "suppression_type" NOT NULL DEFAULT 'manual',
    "reason" TEXT NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "device_data_id" UUID,
    "severity" "alert_severity" NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'active',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "current_value" DOUBLE PRECISION,
    "threshold_info" JSONB,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "resolution_notes" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "layout_config" TEXT,
    "widget_config" TEXT,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_values" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_data_id" UUID NOT NULL,
    "value_numeric" DOUBLE PRECISION,
    "value_text" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_data" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "data_payload" JSONB NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_latest_data" (
    "device_id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "latest_value" DOUBLE PRECISION,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_latest_data_pkey" PRIMARY KEY ("device_id","measurement_id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "schedule_type" "maintenance_type" NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "schedule_status" NOT NULL DEFAULT 'pending',

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20),
    "data_type" "measurement_data_type" NOT NULL DEFAULT 'numeric',
    "validation_rules" TEXT,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "alert_id" UUID NOT NULL,
    "user_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER DEFAULT 1,
    "max_attempts" INTEGER DEFAULT 3,
    "error_message" TEXT,
    "response_data" JSONB,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "query_config" TEXT NOT NULL,
    "output_format" "report_format" NOT NULL DEFAULT 'pdf',
    "generated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "department_id" UUID,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warning_notifications" (
    "id" SERIAL NOT NULL,
    "warning_id" INTEGER NOT NULL,
    "send_time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" INTEGER NOT NULL,

    CONSTRAINT "warning_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "device_info" TEXT,
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_activity" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "organization_id" UUID,
    "action" "audit_action" NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "success" BOOLEAN DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "group_id" UUID,
    "depends_on" UUID[] DEFAULT ARRAY[]::UUID[],
    "conditions" JSONB DEFAULT '{}',
    "priority" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "parent_id" UUID,
    "scope" VARCHAR(20) DEFAULT 'global',

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" UUID,
    "is_custom" BOOLEAN DEFAULT true,
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "organization_id" UUID,
    "department_id" UUID,
    "valid_from" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "valid_from" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_hierarchy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "parent_role_id" UUID NOT NULL,
    "child_role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_hierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "max_users" INTEGER DEFAULT 1000,
    "session_timeout_minutes" INTEGER DEFAULT 480,
    "password_policy" JSONB DEFAULT '{"min_length": 8, "max_age_days": 90, "require_numbers": true, "require_special": false, "require_lowercase": true, "require_uppercase": true}',
    "allowed_permissions" TEXT[],
    "two_factor_required" BOOLEAN DEFAULT false,
    "ip_whitelist" INET[],
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "organization_types" "organization_type"[],
    "permission_ids" UUID[],
    "is_default" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_access" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID NOT NULL,
    "access_level" "access_level" NOT NULL DEFAULT 'read',

    CONSTRAINT "resource_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_policies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "organization_id" UUID,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "permission_ids" UUID[],
    "deny_permission_ids" UUID[],
    "is_active" BOOLEAN DEFAULT true,
    "priority" INTEGER DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100),
    "website" VARCHAR(255),
    "contact_info" JSONB,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_backup" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "id_role" VARCHAR(20),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100),
    "website" VARCHAR(255),
    "contact_info" JSONB,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_backup" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(100),
    "role_id" INTEGER,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_data_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "device_id" UUID NOT NULL,
    "data_json" JSONB NOT NULL,
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_data_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_cache" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "permissions" JSON NOT NULL DEFAULT '[]',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_permission_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_device_categories_parent" ON "device_categories"("parent_id");

-- CreateIndex
CREATE INDEX "idx_device_categories_name" ON "device_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_model_id_key" ON "device_models"("model_number");

-- CreateIndex
CREATE INDEX "idx_device_models_category" ON "device_models"("category_id");

-- CreateIndex
CREATE INDEX "idx_specifications_device_model_id" ON "specifications"("device_model_id");

-- CreateIndex
CREATE INDEX "idx_specifications_field_name" ON "specifications"("field_name");

-- CreateIndex
CREATE INDEX "idx_specifications_numeric" ON "specifications"("numeric_value");

-- CreateIndex
CREATE INDEX "idx_specifications_visible" ON "specifications"("device_model_id", "is_visible", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "specifications_device_model_field_unique" ON "specifications"("device_model_id", "field_name");

-- CreateIndex
CREATE INDEX "idx_spec_fields_category" ON "specification_fields"("category", "sort_order");

-- CreateIndex
CREATE INDEX "idx_spec_fields_active" ON "specification_fields"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "idx_device_serial" ON "device"("serial_number");

-- CreateIndex
CREATE INDEX "idx_device_model" ON "device"("model_id");

-- CreateIndex
CREATE INDEX "idx_device_organization" ON "device"("organization_id");

-- CreateIndex
CREATE INDEX "idx_device_department" ON "device"("department_id");

-- CreateIndex
CREATE INDEX "idx_device_status" ON "device"("status");

-- CreateIndex
CREATE INDEX "idx_warranty_info_device" ON "warranty_info"("device_id");

-- CreateIndex
CREATE INDEX "idx_warranty_info_end_date" ON "warranty_info"("warranty_end");

-- CreateIndex
CREATE INDEX "idx_device_connectivity_device" ON "device_connectivity"("device_id");

-- CreateIndex
CREATE INDEX "idx_device_connectivity_active" ON "device_connectivity"("is_active");

-- CreateIndex
CREATE INDEX "idx_device_connectivity_last_connected" ON "device_connectivity"("last_connected");

-- CreateIndex
CREATE INDEX "idx_organizations_active" ON "organizations"("is_active");

-- CreateIndex
CREATE INDEX "idx_organizations_name" ON "organizations"("name");

-- CreateIndex
CREATE INDEX "idx_organizations_type" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "idx_departments_code" ON "departments"("code");

-- CreateIndex
CREATE INDEX "idx_departments_organization" ON "departments"("organization_id");

-- CreateIndex
CREATE INDEX "device_warning_logs_device_type_timestamp_idx" ON "device_warning_logs"("device_type", "timestamp");

-- CreateIndex
CREATE INDEX "device_warning_logs_warning_type_timestamp_idx" ON "device_warning_logs"("warning_type", "timestamp");

-- CreateIndex
CREATE INDEX "device_warning_logs_status_timestamp_idx" ON "device_warning_logs"("status", "timestamp");

-- CreateIndex
CREATE INDEX "idx_alert_assignments_alert" ON "alert_assignments"("alert_id");

-- CreateIndex
CREATE INDEX "idx_alert_assignments_escalation" ON "alert_assignments"("escalation_level");

-- CreateIndex
CREATE INDEX "idx_alert_assignments_role" ON "alert_assignments"("role");

-- CreateIndex
CREATE INDEX "idx_alert_assignments_user" ON "alert_assignments"("user_id");

-- CreateIndex
CREATE INDEX "idx_alert_metrics_date" ON "alert_metrics"("date" DESC);

-- CreateIndex
CREATE INDEX "idx_alert_metrics_org_date" ON "alert_metrics"("organization_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alert_metrics_organization_id_date_key" ON "alert_metrics"("organization_id", "date");

-- CreateIndex
CREATE INDEX "idx_alert_rules_active" ON "alert_rules"("is_active");

-- CreateIndex
CREATE INDEX "idx_alert_rules_device" ON "alert_rules"("device_id");

-- CreateIndex
CREATE INDEX "idx_alert_rules_measurement" ON "alert_rules"("measurement_id");

-- CreateIndex
CREATE INDEX "idx_alert_rules_organization" ON "alert_rules"("organization_id");

-- CreateIndex
CREATE INDEX "idx_alert_rules_severity" ON "alert_rules"("severity");

-- CreateIndex
CREATE INDEX "idx_alert_suppressions_active" ON "alert_suppressions"("is_active");

-- CreateIndex
CREATE INDEX "idx_alert_suppressions_device" ON "alert_suppressions"("device_id");

-- CreateIndex
CREATE INDEX "idx_alert_suppressions_org" ON "alert_suppressions"("organization_id");

-- CreateIndex
CREATE INDEX "idx_alert_suppressions_rule" ON "alert_suppressions"("rule_id");

-- CreateIndex
CREATE INDEX "idx_alert_suppressions_time" ON "alert_suppressions"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "idx_alerts_device" ON "alerts"("device_id");

-- CreateIndex
CREATE INDEX "idx_alerts_measurement" ON "alerts"("measurement_id");

-- CreateIndex
CREATE INDEX "idx_alerts_rule" ON "alerts"("rule_id");

-- CreateIndex
CREATE INDEX "idx_alerts_severity" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "idx_alerts_triggered_at" ON "alerts"("triggered_at" DESC);

-- CreateIndex
CREATE INDEX "idx_dashboards_organization" ON "dashboards"("organization_id");

-- CreateIndex
CREATE INDEX "idx_data_values_device_data" ON "data_values"("device_data_id");

-- CreateIndex
CREATE INDEX "idx_data_values_recorded_at" ON "data_values"("recorded_at" DESC);

-- CreateIndex
CREATE INDEX "idx_device_data_device_time" ON "device_data"("device_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_device_data_measurement_time" ON "device_data"("measurement_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_device_data_payload_gin" ON "device_data" USING GIN ("data_payload");

-- CreateIndex
CREATE INDEX "idx_device_data_timestamp" ON "device_data"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_device_latest_data_updated" ON "device_latest_data"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_maintenance_schedules_device" ON "maintenance_schedules"("device_id");

-- CreateIndex
CREATE INDEX "idx_maintenance_schedules_due_date" ON "maintenance_schedules"("due_date");

-- CreateIndex
CREATE INDEX "idx_maintenance_schedules_status" ON "maintenance_schedules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "measurements_name_key" ON "measurements"("name");

-- CreateIndex
CREATE INDEX "idx_measurements_data_type" ON "measurements"("data_type");

-- CreateIndex
CREATE INDEX "idx_measurements_name" ON "measurements"("name");

-- CreateIndex
CREATE INDEX "idx_notification_logs_alert" ON "notification_logs"("alert_id");

-- CreateIndex
CREATE INDEX "idx_notification_logs_channel" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "idx_notification_logs_created_at" ON "notification_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_logs_status" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "idx_notification_logs_user" ON "notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_reports_generated_at" ON "reports"("generated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_reports_organization" ON "reports"("organization_id");

-- CreateIndex
CREATE INDEX "idx_system_settings_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "idx_system_settings_organization" ON "system_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_organization_id_key_key" ON "system_settings"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "users_v2_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_v2_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_v2_active" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "idx_users_v2_department" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "idx_users_v2_full_name" ON "users"("full_name");

-- CreateIndex
CREATE INDEX "idx_users_v2_organization" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("access_token");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_sessions_active" ON "user_sessions"("is_active");

-- CreateIndex
CREATE INDEX "idx_user_sessions_expires" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_user_sessions_last_activity" ON "user_sessions"("last_activity");

-- CreateIndex
CREATE INDEX "idx_user_sessions_access_token" ON "user_sessions"("access_token");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_org" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_success" ON "audit_logs"("success");

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");

-- CreateIndex
CREATE INDEX "idx_permission_groups_active" ON "permission_groups"("is_active");

-- CreateIndex
CREATE INDEX "idx_permission_groups_sort" ON "permission_groups"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "idx_permissions_group" ON "permissions"("group_id");

-- CreateIndex
CREATE INDEX "idx_permissions_active" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "idx_permissions_priority" ON "permissions"("priority");

-- CreateIndex
CREATE INDEX "idx_permissions_name" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "idx_permissions_parent_id" ON "permissions"("parent_id");

-- CreateIndex
CREATE INDEX "idx_permissions_resource_action" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "idx_permissions_resource_active" ON "permissions"("resource", "is_active");

-- CreateIndex
CREATE INDEX "idx_permissions_scope" ON "permissions"("scope");

-- CreateIndex
CREATE INDEX "idx_permissions_scope_resource" ON "permissions"("scope", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key1" ON "roles"("name");

-- CreateIndex
CREATE INDEX "idx_roles_organization" ON "roles"("organization_id");

-- CreateIndex
CREATE INDEX "idx_roles_custom" ON "roles"("is_custom");

-- CreateIndex
CREATE INDEX "idx_roles_active" ON "roles"("is_active");

-- CreateIndex
CREATE INDEX "idx_roles_sort" ON "roles"("sort_order");

-- CreateIndex
CREATE INDEX "idx_roles_system" ON "roles"("is_system_role");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_user" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_role" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_organization" ON "user_roles"("organization_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_department" ON "user_roles"("department_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_validity" ON "user_roles"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "idx_user_roles_assigned" ON "user_roles"("assigned_by");

-- CreateIndex
CREATE INDEX "idx_user_roles_active" ON "user_roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_organization_id_department_id_key" ON "user_roles"("user_id", "role_id", "organization_id", "department_id");

-- CreateIndex
CREATE INDEX "idx_user_permissions_user" ON "user_permissions"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_permissions_permission" ON "user_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_user_permissions_granted" ON "user_permissions"("granted_by");

-- CreateIndex
CREATE INDEX "idx_user_permissions_validity" ON "user_permissions"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "idx_user_permissions_active" ON "user_permissions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "idx_role_hierarchy_parent" ON "role_hierarchy"("parent_role_id");

-- CreateIndex
CREATE INDEX "idx_role_hierarchy_child" ON "role_hierarchy"("child_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_hierarchy_parent_role_id_child_role_id_key" ON "role_hierarchy"("parent_role_id", "child_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE INDEX "idx_role_templates_active" ON "role_templates"("is_active");

-- CreateIndex
CREATE INDEX "idx_role_templates_default" ON "role_templates"("is_default");

-- CreateIndex
CREATE INDEX "idx_role_templates_created_by" ON "role_templates"("created_by");

-- CreateIndex
CREATE INDEX "idx_resource_access_user" ON "resource_access"("user_id");

-- CreateIndex
CREATE INDEX "idx_resource_access_resource" ON "resource_access"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_resource_access_unique" ON "resource_access"("user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_access_policies_active" ON "access_policies"("is_active");

-- CreateIndex
CREATE INDEX "idx_access_policies_org" ON "access_policies"("organization_id");

-- CreateIndex
CREATE INDEX "idx_access_policies_priority" ON "access_policies"("priority");

-- CreateIndex
CREATE INDEX "idx_access_policies_validity" ON "access_policies"("valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles_backup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "unique_id_role" ON "roles_backup"("id_role");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users_backup"("username");

-- CreateIndex
CREATE INDEX "idx_device_data_logs_device" ON "device_data_logs"("device_id");

-- CreateIndex
CREATE INDEX "idx_device_data_logs_timestamp" ON "device_data_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_permission_cache_user" ON "user_permission_cache"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_permission_cache_user" ON "user_permission_cache"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_permission_cache_expires" ON "user_permission_cache"("expires_at");

-- AddForeignKey
ALTER TABLE "device_categories" ADD CONSTRAINT "device_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "device_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "device_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_field_name_fkey" FOREIGN KEY ("field_name") REFERENCES "specification_fields"("field_name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranty_info" ADD CONSTRAINT "warranty_info_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_connectivity" ADD CONSTRAINT "device_connectivity_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_warning_logs" ADD CONSTRAINT "device_warning_logs_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users_backup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_backup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_assignments" ADD CONSTRAINT "alert_assignments_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_assignments" ADD CONSTRAINT "alert_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_assignments" ADD CONSTRAINT "alert_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_metrics" ADD CONSTRAINT "alert_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_suppressions" ADD CONSTRAINT "alert_suppressions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_suppressions" ADD CONSTRAINT "alert_suppressions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_suppressions" ADD CONSTRAINT "alert_suppressions_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_suppressions" ADD CONSTRAINT "alert_suppressions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alert_suppressions" ADD CONSTRAINT "alert_suppressions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_data_id_fkey" FOREIGN KEY ("device_data_id") REFERENCES "device_data"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "data_values" ADD CONSTRAINT "data_values_device_data_id_fkey" FOREIGN KEY ("device_data_id") REFERENCES "device_data"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_data" ADD CONSTRAINT "device_data_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_data" ADD CONSTRAINT "device_data_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_latest_data" ADD CONSTRAINT "device_latest_data_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_latest_data" ADD CONSTRAINT "device_latest_data_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_v2_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_v2_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warning_notifications" ADD CONSTRAINT "warning_notifications_warning_id_fkey" FOREIGN KEY ("warning_id") REFERENCES "device_warning_logs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_hierarchy" ADD CONSTRAINT "role_hierarchy_child_role_id_fkey" FOREIGN KEY ("child_role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_hierarchy" ADD CONSTRAINT "role_hierarchy_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_templates" ADD CONSTRAINT "role_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_access" ADD CONSTRAINT "resource_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users_backup" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles_backup"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_permission_cache" ADD CONSTRAINT "fk_user_permission_cache_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
