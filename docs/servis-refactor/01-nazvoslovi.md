# Servis refactor - názvosloví centrálního objektu

## Rozhodnutí

Centrální servisní objekt = **`ServisniZakazka`** (tabulka `servisni_zakazky`).
V UI uvnitř modulu SERVIS jen "Zakázka".

Vzniká **povýšením `ServisniNavsteva`** (rename modelu + tabulky), ne stavbou od nuly.

## Proč ne reuse `Zakazka` (typ=SERVISNI)

- `Zakazka` je svázaná s prodejním/montážním flow (op/Deal, etapy, sklad, OBCHODNI typ). Pro servisní zásah je to nadbytečná složitost.
- Kolize názvu: prodejní `Zakazka` zůstává. Servisní objekt musí mít odlišný název.
- Data: servisní `Zakazka` má 0 řádků, takže reuse nepřináší žádnou úsporu migrace, jen by zatáhl těžký model.

## Proč povýšit `ServisniNavsteva`

- Už nese 80 % potřebného: `stav`, `typ`, `technikId`, `nalezeneZavady`, `doporuceni`, `naklady*`, `fotky`, `podpisKlienta`, vazby na `kontrakt`/`zarizeni`/`klient`.
- 22 reálných řádků, všechny PLANOVANA - triviální migrace stavů.
- Paralela s `ServisniKontrakt` (stejný prefix `Servisni*`) je pro čtenáře kódu konzistentní.

## Dopady přejmenování

- Prisma model `ServisniNavsteva` -> `ServisniZakazka`; `@@map("servisni_navstevy")` -> `@@map("servisni_zakazky")`.
- Relace v `ServisniKontrakt`, `Zarizeni`, `Client`, `User`, `Organization`: `servisniNavstevy` -> `servisniZakazky`.
- `TENANT_MODELS` (lib/orgPrisma.ts): `ServisniNavsteva` -> `ServisniZakazka` + nový `ServisniPolozka`.
- Prisma klient: `db.servisniNavsteva` -> `db.servisniZakazka` napříč kódem.
- API cesty: zachováme `/api/servis/navstevy*` jako alias kvůli mobilní app (Fáze 2), nové UI bude volat `/api/servis/zakazky*`. Finální sjednocení cest po úpravě app.

## Child tabulka vyúčtování

`ServisniPolozka` (tabulka `servisni_polozky`) - položka vyúčtování servisní zakázky.
Záměrně lehčí a samostatná od `VyuctovaniPolozka` (ta zůstává u prodejní zakázky).

## Slovník pro UI

| Kód / model | UI v modulu SERVIS |
|---|---|
| ServisniZakazka | Zakázka |
| ServisniKontrakt | Kontrakt |
| Zarizeni | Zařízení |
| ServisniPolozka | Položka vyúčtování |
| Predávací protokol (pole na ServisniZakazka) | Protokol |
