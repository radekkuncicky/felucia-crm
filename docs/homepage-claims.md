# Homepage felucia.io - tvrzení a důkazy (stav 2026-10-01)

Každé tvrzení o funkci na https://felucia.io má důkaz v `docs/homepage-facts.md` (číslo = bod
části 2 "Inventura skutečných funkcí"). Texty: `components/marketing/homepage/content.ts`,
FAQ: `lib/landing.ts` (FAQS), ceny a limity: `components/marketing/homepage/planSouhrn.ts`.
Ukázková data (Jana Nováková, řada 101) jsou smyšlená a označená štítkem "Ukázková data".

## Meta, OG, JSON-LD
| Tvrzení | Důkaz |
|---|---|
| Od poptávky přes smlouvu, sklad a práci technika po vyúčtování a servis; jedna zakázka, jeden záznam | facts 1, 3, 4, 5, 6, 7, 8, 10, 11 |
| SoftwareApplication: ceny 490 / 1 490 / 2 490 Kč bez DPH za firmu a měsíc, Enterprise individuálně | facts 17, `lib/landing.ts` PLANS, ROZHODNUTÍ (bez DPH) |
| featureList = 16 položek mřížky #funkce | viz sekce Funkce níže |
| operatingSystem Web, iOS | facts 7 (iOS; Android připravujeme) |

## Hero a řetěz dokladů
| Tvrzení | Důkaz |
|---|---|
| Formáty OP-RR-NNN, NAB-RR-NNNN, SOD-RR-NNN, zakázka = číslo OP, PP-, VYU-, SZ-RR-NNNN | facts 16 |
| SOD podepsána, 2 podpisy, ověřeno SMS kódem | facts 3 (podpis za zhotovitele + klient s OTP) |
| Materiál vydán, protokol 10 m -> 12 m, VYU schváleno, servisní prohlídka naplánována | facts 5, 8, 9, 11 |

## Jak to funguje (6 kroků)
| Tvrzení | Důkaz |
|---|---|
| Lead jedním kliknutím na OP, údaje klienta se převezmou, hlídání duplicit | facts 1 |
| Nabídka z položek materiálu a práce z katalogu s cenami podle ceníku, nebo zkopírovaná z jiného případu | facts 2 (ceník = cenová hladina nad katalogem, ČÁSTEČNĚ - formulováno přesně) |
| PDF nabídky ve vlastním designu firmy | facts 2 (QuoteTemplate CUSTOM_HTML) |
| SOD ze šablony s proměnnými; firma podepíše v aplikaci, klient na počítači nebo mobilu s SMS kódem; podepsané PDF u OP | facts 3 |
| Podpis: v ceně Professional a Enterprise, Standard příplatek 99 Kč/licenci/měsíc do 100 smluv, Starter ne | facts 3, `lib/modulPodpisy.ts` |
| Zakázka vznikne sama po podpisu smlouvy, převezme klienta a položky nabídky | facts 4 |
| Termín montáže, technik a vedoucí zakázky | facts 6 |
| Materiál Objednáno, Rezervováno, Vydáno; naskladňuje Manažer zakázek | facts 5, 13 (sklad PLNY = Správce, Manažer zakázek) |
| Felucia Tech: Můj den, navigace, kontakt, podklady; odškrtnuté položky, použitý materiál, komentáře, fotky | facts 7 |
| Při montáži technik ceny nevidí | facts 7, 13 |
| Protokol plán vs skutečnost, podpis klienta na displeji telefonu | facts 7, 8 |
| Manažer zakázek protokol schválí, vyúčtování vznikne z protokolu se skutečně použitým množstvím; vyúčtování schvaluje | facts 9 |
| Zařízení se zárukou, kontrakty, plánované prohlídky; 6 fází Nová...Uzavřená; jen Professional a Enterprise | facts 11 |
| Role u kroků (Obchodník, Manažer zakázek, Hlavní technik, Technik) | facts 13 |

## Plán vs skutečnost (6.5)
| Tvrzení | Důkaz |
|---|---|
| Technik zapíše použité množství, protokol ho porovná s nabídkou, Manažer zakázek schválí, vyúčtování z protokolu | facts 8, 9 |
| Stavy Rozpracován, Podepsán, Schválen; VYU Návrh, Ke schválení, Schváleno | facts 8, 9 |

## Kancelář a terén (#technici)
| Tvrzení | Důkaz |
|---|---|
| Adresa, kontakt, pokyny, podklady v telefonu; navigace jedním klepnutím; fotky; podpis v políčku na displeji | facts 7 |
| Bez signálu se uloží odškrtnuté položky, komentáře, fotky i servisní protokol; podpis a změna stavu až online | facts 7 (outbox) |
| Aplikace pro iOS, Android připravujeme | ROZHODNUTÍ, facts 7 |

## Servis (#servis)
| Tvrzení | Důkaz |
|---|---|
| Zařízení v evidenci u zákazníka i zakázky, záruka, historie zásahů, kontrakt | facts 11 |
| Felucia hlídá termíny prohlídek (další se založí podle intervalu); technik zapíše zásah v telefonu | facts 11 |
| Servisní modul v plánech Professional a Enterprise | facts 11, 17 |

## Funkce (#funkce)
| Položka | Důkaz |
|---|---|
| Elektronický podpis ověřený SMS kódem; uloží se čas, ověřené číslo, IP, otisk dokumentu; historie smlouvy | facts 3 (Co se při podpisu ukládá) |
| Šablony smluv s proměnnými, náhled | facts 3 (proměnné vč. adresa_dila, cena, termín) |
| PDF nabídky ve vašem designu | facts 2 |
| Kopírování nabídek | facts 2 |
| Hlídání duplicitních klientů | facts 1 |
| Stav materiálu u zakázky | facts 5 |
| Plán vs skutečnost v protokolu | facts 8 |
| Schvalování protokolů a vyúčtování (Manažer zakázek nebo Správce) | facts 9 |
| Stavový pruh zakázky, prodloužení u etap | facts 6 |
| Historie zakázky (komentáře a aktivita) | facts 6 |
| Zařízení, záruky a kontrakty | facts 11 |
| Další prohlídka sama | facts 11 |
| Role a oprávnění (5 rolí) | facts 13 |
| Vlastní subdoména | facts 14 |
| Anonymizace klienta podle GDPR | facts 15 |
| Podpis klienta na displeji | facts 7, 8 |

## Dáša
| Tvrzení | Důkaz |
|---|---|
| Najde OP, klienta, produkt; založí klienta a OP; připraví nabídku podle vzoru; zapíše aktivitu; změní stav OP | facts 12 (`lib/dasaTools.ts`) |
| Limity Standard 200, Professional 1 000 kreditů měsíčně, Enterprise bez limitu | `lib/dasaLimits.ts`, docs/homepage-1b-report.md |
| (o AI a osobních údajích web nic netvrdí) | ZMĚNY PO AUDITU bod 6 |

## Data a důvěra
| Tvrzení | Důkaz |
|---|---|
| Oddělený prostor, vlastní subdoména, oddělení v aplikaci i v databázi | facts 14 (orgPrisma + RLS) |
| Vlastní server Hetzner v EU | facts 15 (/privacy 6.3) |
| Denní šifrované zálohy, 14 dní, kopie mimo server | facts 15 |
| Anonymizace klienta, odkaz /privacy | facts 15 |
| Provozovatel EFIKU SOLUTIONS s.r.o., IČO 29703972, Ostrava; vyvinuto v provozu montážní firmy | `lib/landing.ts` OPERATOR, ROZHODNUTÍ |

## Ceny (#ceny)
| Tvrzení | Důkaz |
|---|---|
| Ceny bez DPH za firmu a měsíc | ROZHODNUTÍ, `lib/landing.ts` PLANS |
| Uživatelé, OP, produkty, šablony, servis, white-label, vlastní oprávnění, subdoména, odezva podpory | facts 17, `lib/planLimits.ts` |
| Elektronický podpis podle plánu | facts 3, `lib/modulPodpisy.ts` |
| Dáša podle plánu | `lib/dasaLimits.ts` |
| API klíče a webhooky ve všech plánech | facts 14 (bez gatingu plánem) |

## FAQ
| Otázka | Důkaz |
|---|---|
| Pro jaké firmy | zadání (cílovka), bez tvrzení o funkci |
| Co technik zvládne v telefonu | facts 7, 11 |
| Vidí technik ceny | facts 7, 13 |
| Funguje aplikace bez signálu | facts 7, ZMĚNY PO AUDITU bod 8 |
| Kdo vidí naše data | facts 13, 14 |
| Jak probíhá ukázka / zavedení | obchodní proces, bez tvrzení o funkci |
| Jaká data lze importovat | facts část 1 (FAQ), `app/(dashboard)/settings/import-products` |
| Je nutné připojení | facts 7 |
