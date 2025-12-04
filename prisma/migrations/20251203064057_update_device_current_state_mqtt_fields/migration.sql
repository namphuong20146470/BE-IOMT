/*
  Warnings:

  - You are about to drop the column `active_power` on the `device_current_state` table. All the data in the column will be lost.
  - You are about to drop the column `apparent_power` on the `device_current_state` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "device_current_state" DROP COLUMN "active_power",
DROP COLUMN "apparent_power",
ADD COLUMN     "machine_state" BOOLEAN DEFAULT false,
ADD COLUMN     "over_voltage" BOOLEAN DEFAULT false,
ADD COLUMN     "power" REAL,
ADD COLUMN     "sensor_state" BOOLEAN DEFAULT false,
ADD COLUMN     "socket_state" BOOLEAN DEFAULT false,
ADD COLUMN     "under_voltage" BOOLEAN DEFAULT false;
