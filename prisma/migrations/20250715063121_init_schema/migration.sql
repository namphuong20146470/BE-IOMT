/*
  Warnings:

  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bills` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `business_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `competitors` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contract_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contracts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_interactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dx_activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `interaction_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory_check` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opportunity_source` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_details` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `potential_customer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `priority_level` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotation_status` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotation_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_in` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_out` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `suppliers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_status` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_activity_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `warehouse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_vai_tro_fkey";

-- DropForeignKey
ALTER TABLE "bills" DROP CONSTRAINT "bills_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "business_tasks" DROP CONSTRAINT "business_tasks_do_uu_tien_fkey";

-- DropForeignKey
ALTER TABLE "business_tasks" DROP CONSTRAINT "business_tasks_trang_thai_cong_viec_fkey";

-- DropForeignKey
ALTER TABLE "competitors" DROP CONSTRAINT "competitors_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "contract_type" DROP CONSTRAINT "contract_type_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_loai_hop_dong_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_nguoi_tao_fkey";

-- DropForeignKey
ALTER TABLE "customer_group" DROP CONSTRAINT "customer_group_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "customer_interactions" DROP CONSTRAINT "customer_interactions_loai_tuong_tac_fkey";

-- DropForeignKey
ALTER TABLE "customer_interactions" DROP CONSTRAINT "customer_interactions_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "dx_activity_logs" DROP CONSTRAINT "dx_activity_logs_ten_nguoi_dung_fkey";

-- DropForeignKey
ALTER TABLE "interaction_type" DROP CONSTRAINT "interaction_type_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_ten_kho_fkey";

-- DropForeignKey
ALTER TABLE "inventory_check" DROP CONSTRAINT "inventory_check_nguoi_kiem_ke_fkey";

-- DropForeignKey
ALTER TABLE "inventory_check" DROP CONSTRAINT "inventory_check_so_luong_he_thong_ghi_nhan_fkey";

-- DropForeignKey
ALTER TABLE "inventory_check" DROP CONSTRAINT "inventory_check_ten_kho_fkey";

-- DropForeignKey
ALTER TABLE "opportunity_source" DROP CONSTRAINT "opportunity_source_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_hawb_1_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_hawb_2_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_hawb_3_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_hawb_4_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_hawb_5_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_ma_hop_dong_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_so_xac_nhan_don_hang_fkey";

-- DropForeignKey
ALTER TABLE "order_details" DROP CONSTRAINT "order_details_ten_khach_hang_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_nguoi_lap_don_fkey";

-- DropForeignKey
ALTER TABLE "potential_customer" DROP CONSTRAINT "potential_customer_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "potential_customer" DROP CONSTRAINT "potential_customer_nguon_tiep_can_fkey";

-- DropForeignKey
ALTER TABLE "potential_customer" DROP CONSTRAINT "potential_customer_nhom_khach_hang_fkey";

-- DropForeignKey
ALTER TABLE "priority_level" DROP CONSTRAINT "priority_level_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "product_type" DROP CONSTRAINT "product_type_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_ten_loai_hang_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_ten_nha_cung_cap_fkey";

-- DropForeignKey
ALTER TABLE "quotation_status" DROP CONSTRAINT "quotation_status_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "quotation_type" DROP CONSTRAINT "quotation_type_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_loai_bao_gia_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_tinh_trang_fkey";

-- DropForeignKey
ALTER TABLE "stock_in" DROP CONSTRAINT "stock_in_ma_bill_fkey";

-- DropForeignKey
ALTER TABLE "stock_in" DROP CONSTRAINT "stock_in_ma_hop_dong_fkey";

-- DropForeignKey
ALTER TABLE "stock_in" DROP CONSTRAINT "stock_in_ten_kho_fkey";

-- DropForeignKey
ALTER TABLE "stock_in" DROP CONSTRAINT "stock_in_ten_nha_cung_cap_fkey";

-- DropForeignKey
ALTER TABLE "stock_out" DROP CONSTRAINT "stock_out_nguoi_phu_trach_fkey";

-- DropForeignKey
ALTER TABLE "stock_out" DROP CONSTRAINT "stock_out_ten_khach_hang_fkey";

-- DropForeignKey
ALTER TABLE "stock_out" DROP CONSTRAINT "stock_out_ten_kho_fkey";

-- DropForeignKey
ALTER TABLE "task_status" DROP CONSTRAINT "task_status_nguoi_cap_nhat_fkey";

-- DropForeignKey
ALTER TABLE "user_activity_log" DROP CONSTRAINT "user_activity_log_ma_nguoi_dung_fkey";

-- DropForeignKey
ALTER TABLE "warehouse" DROP CONSTRAINT "warehouse_nguoi_tao_fkey";

-- DropForeignKey
ALTER TABLE "warehouse" DROP CONSTRAINT "warehouse_quan_ly_kho_fkey";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "bills";

-- DropTable
DROP TABLE "business_tasks";

-- DropTable
DROP TABLE "competitors";

-- DropTable
DROP TABLE "contract_type";

-- DropTable
DROP TABLE "contracts";

-- DropTable
DROP TABLE "customer_group";

-- DropTable
DROP TABLE "customer_interactions";

-- DropTable
DROP TABLE "customers";

-- DropTable
DROP TABLE "dx_activity_logs";

-- DropTable
DROP TABLE "interaction_type";

-- DropTable
DROP TABLE "inventory";

-- DropTable
DROP TABLE "inventory_check";

-- DropTable
DROP TABLE "opportunity_source";

-- DropTable
DROP TABLE "order_details";

-- DropTable
DROP TABLE "orders";

-- DropTable
DROP TABLE "potential_customer";

-- DropTable
DROP TABLE "priority_level";

-- DropTable
DROP TABLE "product_images";

-- DropTable
DROP TABLE "product_type";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "quotation_status";

-- DropTable
DROP TABLE "quotation_type";

-- DropTable
DROP TABLE "quotations";

-- DropTable
DROP TABLE "role";

-- DropTable
DROP TABLE "stock_in";

-- DropTable
DROP TABLE "stock_out";

-- DropTable
DROP TABLE "suppliers";

-- DropTable
DROP TABLE "task_status";

-- DropTable
DROP TABLE "user_activity_log";

-- DropTable
DROP TABLE "warehouse";

-- CreateTable
CREATE TABLE "auo_display" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "power_operating" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "operating_time" interval,
    "over_voltage_operating" BOOLEAN DEFAULT false,
    "over_current_operating" BOOLEAN DEFAULT false,
    "over_power_operating" BOOLEAN DEFAULT false,
    "status_operating" BOOLEAN DEFAULT false,
    "under_voltage_operating" BOOLEAN DEFAULT false,
    "power_socket_status" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auo_display_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_control_unit" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "power_operating" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "operating_time" interval,
    "over_voltage_operating" BOOLEAN DEFAULT false,
    "over_current_operating" BOOLEAN DEFAULT false,
    "over_power_operating" BOOLEAN DEFAULT false,
    "status_operating" BOOLEAN DEFAULT false,
    "under_voltage_operating" BOOLEAN DEFAULT false,
    "power_socket_status" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_control_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_endoflator" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "power_operating" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "operating_time" interval,
    "over_voltage_operating" BOOLEAN DEFAULT false,
    "over_current_operating" BOOLEAN DEFAULT false,
    "over_power_operating" BOOLEAN DEFAULT false,
    "status_operating" BOOLEAN DEFAULT false,
    "under_voltage_operating" BOOLEAN DEFAULT false,
    "power_socket_status" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electronic_endoflator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_environment_status" (
    "id" SERIAL NOT NULL,
    "leak_current_ma" REAL,
    "temperature_c" REAL,
    "humidity_percent" REAL,
    "over_temperature" BOOLEAN DEFAULT false,
    "over_humidity" BOOLEAN DEFAULT false,
    "soft_warning" BOOLEAN DEFAULT false,
    "strong_warning" BOOLEAN DEFAULT false,
    "shutdown_warning" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_environment_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "led_nova_100" (
    "id" SERIAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "power_operating" REAL,
    "frequency" REAL,
    "power_factor" REAL,
    "operating_time" interval,
    "over_voltage_operating" BOOLEAN DEFAULT false,
    "over_current_operating" BOOLEAN DEFAULT false,
    "over_power_operating" BOOLEAN DEFAULT false,
    "status_operating" BOOLEAN DEFAULT false,
    "under_voltage_operating" BOOLEAN DEFAULT false,
    "power_socket_status" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "led_nova_100_pkey" PRIMARY KEY ("id")
);
