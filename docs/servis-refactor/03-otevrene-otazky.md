# Otevřené otázky před Fází 1 naostro

Potřebuju tvoje rozhodnutí, než upravím schema a vygeneruju migraci.

## 1. Směr sjednocení - potvrzení
Návrh: povýšit `ServisniNavsteva` na `ServisniZakazka`, prodejní `Zakazka` (typ=SERVISNI, 0 řádků) NEpoužít a její UI `/zakazky/servisni` později nahradit. Souhlas?

## 2. Co s `/zakazky/servisni` a `ZakazkaTyp.SERVISNI`
Má 0 řádků. Varianty:
- a) Nechat route jako redirect do nového SERVIS modulu, enum hodnotu ponechat (bezpečné).
- b) Route smazat hned ve Fázi 3, enum hodnotu označit jako deprecated.
Co preferuješ?

## 3. "Naplánovaná" vs. přiřazený technik
Je zakázka NAPLANOVANA hned, když má termín, nebo až když má termín I technika? Tohle určuje, co spadne do sekce Nástěnky "nezaplánované". Návrh: NAPLANOVANA = má termín; "bez technika" je samostatný filtr/štítek, ne stav. OK?

## 4. Číslování servisních zakázek
Dnes `cisloNavstevy` je často prázdné. Chceš automatickou číselnou řadu (např. SZ-2026-0001) per tenant? Pokud ano, formát a od jakého čísla?

## 5. DPH default u položek
Návrh `dphSazba` default 21. `ZakazkaPolozka` má default 12, `VyuctovaniPolozka` taky. Sjednotit servisní položky na 21, nebo 12 jako zbytek?

## 6. Vztah položek a "kryto kontraktem"
Příznak `krytoKontraktem` je na položce. Stačí to takhle (uživatel ručně označí, co kryje smlouva), nebo chceš pravidlo, které to předvyplní podle typu kontraktu? Návrh pro Fázi 1: ruční příznak, automatika později.

## 7. Faktura - rozsah Fáze 5
"Podklad faktury jedním klikem" - je cílem PDF podklad (jako SOD/protokol), nebo i export do účetního systému (Pohoda/Money/ABRA)? Pro teď počítám jen s PDF podkladem. Potvrď.

## 8. Mobilní app - zpětná kompatibilita
Po přejmenování stavů (PLANOVANA -> NAPLANOVANA) přestane `/api/servis/upcoming` a `/stats` vracet data, pokud nepřemapujeme. Dvě cesty:
- a) Endpointy budou ve Fázi 2 mapovat nové stavy zpět na staré názvy (app needá hned měnit).
- b) Upravíme i app felucia-tech (Radkův Mac) ve stejné vlně.
Kterou cestou? (Souvisí s tím, kdy budeš sahat na app.)

## 9. Kalendář (Fáze 4) - technická volba
Drag-drop týdenní dispečink se sloupci podle techniků. Máme v projektu nějakou kalendářovou knihovnu, nebo postavit vlastní? A "ukázat v hlavním kalendáři Felucie pod štítkem SERVIS" - kde přesně je hlavní kalendář (`/muj-den`? jiná stránka)? Potřebuju potvrdit cílovou obrazovku.

## 10. Pořadí prací
Roadmapa má 6 fází. Potvrď, že jdeme striktně Fáze 1 -> 6, nebo chceš některou předřadit (např. hned opravit bezpečnostní díru v protokolu, což je dnes ve Fázi 5).
