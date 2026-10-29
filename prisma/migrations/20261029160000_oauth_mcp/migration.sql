-- OAuth 2.1 pro MCP konektor: dynamicky registrovaní klienti, autorizační kódy (PKCE), připojení (tokeny)
-- CreateTable
CREATE TABLE "oauth_klienti" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_klienti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_kody" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "klientId" TEXT NOT NULL,
    "kodHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT,
    "expiruje" TIMESTAMP(3) NOT NULL,
    "pouzito" TIMESTAMP(3),
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_kody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_pripojeni" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "klientId" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "accessExpiruje" TIMESTAMP(3) NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "refreshExpiruje" TIMESTAMP(3) NOT NULL,
    "posledniPouziti" TIMESTAMP(3),
    "zruseno" TIMESTAMP(3),
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_pripojeni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_klienti_clientId_key" ON "oauth_klienti"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_kody_kodHash_key" ON "oauth_kody"("kodHash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_pripojeni_accessHash_key" ON "oauth_pripojeni"("accessHash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_pripojeni_refreshHash_key" ON "oauth_pripojeni"("refreshHash");

-- CreateIndex
CREATE INDEX "oauth_pripojeni_orgId_userId_idx" ON "oauth_pripojeni"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "oauth_kody" ADD CONSTRAINT "oauth_kody_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_kody" ADD CONSTRAINT "oauth_kody_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_kody" ADD CONSTRAINT "oauth_kody_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "oauth_klienti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_pripojeni" ADD CONSTRAINT "oauth_pripojeni_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_pripojeni" ADD CONSTRAINT "oauth_pripojeni_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_pripojeni" ADD CONSTRAINT "oauth_pripojeni_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "oauth_klienti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

