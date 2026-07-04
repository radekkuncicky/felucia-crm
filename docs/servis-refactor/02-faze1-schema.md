# Fáze 1 - datový model (NÁVRH, nespouštět)

Cíl Fáze 1: povýšit `ServisniNavsteva` na `ServisniZakazka`, zavést sjednocený životní cyklus stavů, child tabulku položek vyúčtování a billing příznaky. Migrace 22 existujících návštěv beze ztráty.

Tento dokument je návrh ke schválení. Finální migrace se vygeneruje až po odsouhlasení přes `npx prisma migrate dev --name servis_zakazka` (ne `db push`, ne ručně na produkci). Přiložený SQL (`draft-migration.sql`) je ilustrativní pro review logiky.

## 1. Nový enum stavů

```prisma
enum ServisniZakazkaStav {
  NOVA          // založená, bez termínu (typicky reaktivní porucha)
  NAPLANOVANA   // má termín (a obvykle technika)
  PROBIHA       // technik na místě / rozpracováno
  DOKONCENA     // práce hotová, protokol podepsán
  VYUCTOVANA    // vznikl podklad faktury
  UZAVRENA      // zaplaceno / uzavřeno
  CEKA          // blokováno (na díly nebo klienta), důvod v cekaDuvod
  ZRUSENA       // zrušeno
  REKLAMACE     // znovuotevřeno po uzavření
}
```

Hlavní cesta: NOVA -> NAPLANOVANA -> PROBIHA -> DOKONCENA -> VYUCTOVANA -> UZAVRENA.
Odbočky: CEKA, ZRUSENA, REKLAMACE.

"Prošlý termín" NENÍ stav - počítá se dynamicky (`stav = NAPLANOVANA AND planovanyTermin < now`). Proto v enumu není PRESLA.

## 2. Nový enum typu položky

```prisma
enum ServisniPolozkaTyp {
  PRACE
  MATERIAL
  DOPRAVA
  JINE
}
```

`NavstevaTyp` (PLANOVANY_SERVIS, PORUCHA, ...) zůstává beze změny.

## 3. Mapování starých stavů na nové (migrace dat)

| ServisStav (dnes) | ServisniZakazkaStav (nově) | Pozn. |
|---|---|---|
| PLANOVANA | NAPLANOVANA | má termín; 22 reálných řádků |
| POTVRZENA | NAPLANOVANA | potvrzeno = stále naplánováno; 0 řádků |
| PROBIHA | PROBIHA | 0 řádků |
| DOKONCENA | DOKONCENA | 0 řádků |
| ZRUSENA | ZRUSENA | 0 řádků |
| PRESLA | NAPLANOVANA | prošlost se počítá dynamicky; 0 řádků |

Reálně migrujeme jen 22x PLANOVANA -> NAPLANOVANA. Žádná ztráta dat.
Otevřená otázka: má "naplánovaná" vyžadovat přiřazeného technika? (viz 03-otevrene-otazky)

## 4. Diff modelu ServisniNavsteva -> ServisniZakazka

```prisma
model ServisniZakazka {
  id               String              @id @default(cuid())
  orgId            String
  kontraktId       String?
  zarizeniId       String?
  klientId         String?
  cislo            String?             // dnes cisloNavstevy (rename)
  typ              NavstevaTyp         @default(PLANOVANY_SERVIS)
  stav             ServisniZakazkaStav @default(NOVA)   // byl ServisStav @default(PLANOVANA)

  // plánování
  planovanyTermin  DateTime?           // POZOR: dnes NOT NULL; reaktivní zakázka termín nemá -> nullable
  skutecnyTermin   DateTime?
  trvaniMinut      Int?
  technikId        String?
  cekaDuvod        String?             // NOVÉ: důvod stavu CEKA

  // protokol / výsledek práce (beze změny)
  poznamka         String?
  zprava           String?
  nalezeneZavady   String?
  doporuceni       String?
  nakladyCas       Decimal?            @db.Decimal(10, 2)
  nakladyMaterial  Decimal?            @db.Decimal(12, 2)
  fotky            Json                @default("[]")
  podpisKlienta    String?
  protokolDokoncen DateTime?           // NOVÉ: brána do fakturace (kdy byl protokol uzavřen)

  // billing (NOVÉ)
  vyfakturovano       Boolean          @default(false)
  vyfakturovanoDatum  DateTime?
  zaplaceno           Boolean          @default(false)
  zaplacenoDatum      DateTime?

  vytvoreno        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt   // NOVÉ

  organization Organization      @relation(fields: [orgId], references: [id])
  kontrakt     ServisniKontrakt? @relation(fields: [kontraktId], references: [id], onDelete: Cascade)
  zarizeni     Zarizeni?         @relation(fields: [zarizeniId], references: [id])
  klient       Client?           @relation(fields: [klientId], references: [id])
  technik      User?             @relation(fields: [technikId], references: [id])
  polozky      ServisniPolozka[]                    // NOVÉ

  @@index([orgId, stav])
  @@index([orgId, planovanyTermin])
  @@map("servisni_zakazky")
}
```

Změny oproti dnešku:
- model + tabulka přejmenovány,
- `stav` přechází na `ServisniZakazkaStav`,
- `planovanyTermin` nově nullable (reaktivní zakázka bez termínu),
- `cisloNavstevy` -> `cislo`,
- přidáno: `cekaDuvod`, `protokolDokoncen`, `vyfakturovano(+Datum)`, `zaplaceno(+Datum)`, `updatedAt`, relace `polozky`, indexy.

## 5. Nová child tabulka ServisniPolozka

```prisma
model ServisniPolozka {
  id               String             @id @default(cuid())
  orgId            String
  servisniZakazkaId String
  typ              ServisniPolozkaTyp @default(PRACE)
  popis            String
  mnozstvi         Decimal            @default(1) @db.Decimal(12, 2)
  jednotka         String             @default("ks")
  cenaZaJednotku   Decimal?           @db.Decimal(12, 2)
  krytoKontraktem  Boolean            @default(false)
  dphSazba         Decimal            @default(21) @db.Decimal(5, 2)
  poradi           Int                @default(0)

  organization    Organization    @relation(fields: [orgId], references: [id])
  servisniZakazka ServisniZakazka @relation(fields: [servisniZakazkaId], references: [id], onDelete: Cascade)

  @@index([servisniZakazkaId])
  @@map("servisni_polozky")
}
```

## 6. Úpravy vazeb v ostatních modelech

- `ServisniKontrakt.servisniNavstevy` -> `servisniZakazky ServisniZakazka[]`.
- `Zarizeni.servisniNavstevy` -> `servisniZakazky ServisniZakazka[]`.
- `Client` / `User` / `Organization`: přejmenovat zpětné relace na `servisniZakazky` + přidat `servisniPolozky` na `Organization`.
- `lib/orgPrisma.ts` `TENANT_MODELS`: `'ServisniNavsteva'` -> `'ServisniZakazka'`, přidat `'ServisniPolozka'`.

## 7. Co Fáze 1 NEdělá

- Nemění API chování ani UI (to je Fáze 2+).
- Neřeší mobilní zpětnou kompatibilitu (Fáze 2).
- Neruší `/zakazky/servisni` ani `ZakazkaTyp.SERVISNI` (rozhodne se, viz otevřené otázky).
- Nepřevádí protokol PDF na hardened cestu (Fáze 5).

## 8. Postup aplikace (až po schválení)

1. Upravit `prisma/schema.prisma` dle tohoto návrhu.
2. `npx prisma migrate dev --name servis_zakazka` (lokálně, vygeneruje migraci včetně data-migrace stavů - tu doplníme ručně do vygenerované migrace, viz draft-migration.sql).
3. Projít typecheck (rename `db.servisniNavsteva` -> `db.servisniZakazka` v kódu).
4. Aktualizovat `TENANT_MODELS` + test izolace.
5. Teprve pak Fáze 2.
