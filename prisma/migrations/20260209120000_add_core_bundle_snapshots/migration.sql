CREATE TABLE "CoreBundleSnapshot" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "vaultDecimals" INTEGER NOT NULL,
    "totalAssetsRaw" TEXT NOT NULL,
    "totalSupplyRaw" TEXT NOT NULL,
    "sharePriceRaw" TEXT NOT NULL,
    "totalAssets" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "sharePrice" TEXT NOT NULL,
    "growthPct" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoreBundleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoreBundleSnapshot_chainId_vaultAddress_blockNumber_key"
ON "CoreBundleSnapshot"("chainId", "vaultAddress", "blockNumber");

CREATE INDEX "CoreBundleSnapshot_chainId_vaultAddress_blockTimestamp_idx"
ON "CoreBundleSnapshot"("chainId", "vaultAddress", "blockTimestamp");

CREATE INDEX "CoreBundleSnapshot_createdAt_idx"
ON "CoreBundleSnapshot"("createdAt");
