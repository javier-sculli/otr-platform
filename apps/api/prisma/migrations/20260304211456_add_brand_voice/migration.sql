-- CreateTable
CREATE TABLE "brand_voices" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_voices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_voices_client_id_key" ON "brand_voices"("client_id");

-- AddForeignKey
ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
