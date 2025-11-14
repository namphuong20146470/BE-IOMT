/*
  Warnings:

  - You are about to drop the `specification_fields` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `specifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "specifications" DROP CONSTRAINT "fk_spec_field_name";

-- DropForeignKey
ALTER TABLE "specifications" DROP CONSTRAINT "specifications_device_model_id_fkey";

-- AlterTable
ALTER TABLE "device_models" ADD COLUMN     "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "specifications" JSONB DEFAULT '{}',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "specification_fields";

-- DropTable
DROP TABLE "specifications";

-- CreateIndex
CREATE INDEX "idx_device_models_specifications" ON "device_models" USING GIN ("specifications");
