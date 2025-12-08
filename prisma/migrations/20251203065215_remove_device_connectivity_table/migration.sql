/*
  Warnings:

  - You are about to drop the `device_connectivity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "device_connectivity" DROP CONSTRAINT "device_connectivity_device_id_fkey";

-- DropTable
DROP TABLE "device_connectivity";
