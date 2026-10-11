# KPI pro vedení - doplňující otázky na Radka

Datum: 2026-10-11 · Navazuje na [01-specifikace.md](01-specifikace.md)

Prvních 14 otázek je zodpovězeno a zapracováno (pravidla R1-R18 ve specifikaci). Tyto doplňující
otázky vyplynuly z odpovědí a z datového modelu. Obchodní pravidla jsem nedomýšlel, kde to dává
smysl, jsou uvedené varianty.

## Klíčová (určuje pořadí fází)

### Q1. Faktury v CRM: ručně, nebo rovnou z ABRA Flexi?
KPI 1, 2, 4 a 5 stojí na fakturách a úhradách, které CRM dnes nezná.
- a) ruční zadání faktury a úhrady v CRM (fáze 2). Rychlejší start, ale dvojí práce vedle ABRA a
  bez historie.
- b) počkat na ABRA Flexi (fáze 3b). Bez dvojí práce, s historií od 1. 1. 2026, ale termín závisí
  na přístupech.
- c) ručně hned, ABRA později nahradí ruční zadání (model je pro obě cesty stejný).

Kdo by případně faktury v CRM zadával?

## Zálohy (KPI 1)

### Q2. Výjimky ve jmenovateli
Výjimka se nepočítá jako splněná (R3). Zůstává ve jmenovateli (tedy zhoršuje podíl), nebo se ze
jmenovatele vyřadí a ukazuje se jen zvlášť?

### Q3. Kdy se SOD hodnotí
SOD podepsaná včera ještě nemá za sebou 14 dní ani objednávku. Má se do KPI započítat až po
uplynutí rozhodného data (a do té doby být „čeká / hrozí“)? Do kterého týdne pak patří: týden
podpisu, nebo týden rozhodného data?

### Q4. Dodatky SOD
CRM dodatky neeviduje. Jak je NANTO dělá dnes (papír, nová SOD, úprava ceny ve stávající)? Stačí
v CRM evidovat dodatek jako změnu ceny s datem podpisu?

## Fakturace (KPI 2)

### Q5. Dny
Podpis v pondělí 16:00, faktura v úterý 9:00 = 1 den (rozdíl kalendářních dat)? Faktura v den
předání = 0?

### Q6. Hlavní číslo dlaždice
Průměr dní, nebo podíl předání vyfakturovaných do 1 dne?

### Q7. Zakázka bez manažera
Komu jde upozornění „K vyfakturování“, když zakázka nemá manažera (`vedouciId`)? Jednatelům?

## Hotovost (KPI 3)

### Q8. Vzorec a účty
Hotovost = zůstatek účtů − čerpání kontokorentu? Je účtů víc (zadávat zvlášť, nebo součet)?

## Marže (KPI 4)

### Q9. Zálohy ve vyúčtovací faktuře
Odečítá vyúčtovací faktura NANTO uhrazené zálohy (vystavuje se na celek, nebo jen na doplatek)?
Podle toho se výnos počítá buď jen z vyúčtovací faktury, nebo ze součtu záloh a doplatku.

### Q10. Materiál mimo sklad
Kupuje se materiál přímo na zakázku mimo CRM (bez výdeje ze skladu)? Pokud ano, evidovat ho jako
náklad zakázky ručně, nebo až z ABRA?

### Q11. Sazba montážníka pro jednatele
Je to výchozí sazba organizace (380 Kč/h), nebo zvláštní nastavitelná „sazba montážníka“?

### Q12. Provize
Komu se provize vyplácejí (obchodník, partner, doporučitel) a podle čeho se určí částka? Stačí
ruční zadání částky na zakázce?

### Q13. Měsíc vyhodnocení
Ve kterém měsíci zakázka vstoupí do KPI: měsíc schválení posledního vyúčtování, nebo měsíc
vystavení poslední vyúčtovací faktury? A u etapové zakázky až po poslední etapě?

### Q14. Hlavní číslo dlaždice
Podíl zakázek s marží ≥ 35 %, nebo vážená marže všech vyúčtovaných zakázek v měsíci?

## Materiál bez zakázky (KPI 5)

### Q15. Tržby ve jmenovateli
Fakturované tržby bez DPH za měsíc (stejně jako výnos u KPI 4)?

### Q16. Historie
Výdeje bez zakázky od 1. 1. 2026 nemají kategorii. Projít je ručně a provozní spotřebu označit,
nebo historii brát tak, jak je?

### Q17. Výdej bez zakázky a bez kategorie
Má systém takový výdej zakázat, nebo ho povolit a jen započítat do KPI?

## Zdroje a Ads (KPI 6, 7)

### Q18. Zakázky podle zdroje
Počítají se podle měsíce výhry OP, nebo podle měsíce vzniku leadu (jako konverze)?

### Q19. Kdo doporučil
Výběr existujícího klienta, volný text, nebo obojí?

### Q20. Povinný zdroj a web formulář
Lead z webového formuláře zdroj nezná. Má být povinný až při kvalifikaci / převodu na OP? Doplnit
zdroj zpětně u leadů od 1. 1. 2026?

### Q21. Cena za případ z Ads
Útrata měsíce M se dělí případy vyhranými v M, nebo vyhranými případy z leadů vzniklých v M?

## Party (KPI 8)

### Q22. Etapy
Zakázka se třemi etapami = tři dokončení (tři podepsané předávací protokoly), nebo jedno (až
poslední etapa)?

### Q23. Historie
Přiřadit partu zpětně zakázkám od 1. 1. 2026?

## Jednatelé (KPI 9)

### Q24. Příznak, nebo role
Navrhuji příznak „jednatel“ u uživatele (role zůstane ADMIN) místo nové role, protože nová role
by zasáhla oprávnění a aplikace felucia-tech / felucia-sales. Souhlas? Kdo jsou jednatelé NANTO?

## Zisk (KPI 10)

### Q25. Tržby pro procento
Zadávat tržby ručně spolu s výsledkem (z účetnictví), nebo brát fakturované tržby z CRM?

## Zobrazení

### Q26. Kdo je „vedení“
Kromě jednatelů ještě někdo (např. konkrétní manažer)? Stačí jim KPI přidělit jednotlivě, nebo
mají dostávat i pondělní souhrn?

### Q27. Průběžný měsíc
Měsíční KPI ukazovat za poslední uzavřený měsíc, nebo i průběžně za aktuální měsíc?

### Q28. Oranžová „do 10 % od cíle“
- Relativně (marže: 35 % × 0,9 = 31,5 %), nebo v procentních bodech (25-35 %)?
- U cílů s nulou (KPI 3 kladná hotovost, KPI 9 nula hodin) 10 % nedává smysl. Jaké pásmo tam?
  Např. KPI 9: oranžová do X hodin měsíčně, KPI 3: oranžová při kladné hotovosti, ale čerpání
  kontokorentu nad Y % limitu?
- Pro KPI 6, 7 a 8 cíl zadán není. Bez semaforu, jen hodnota a trend?

### Q29. Seznam „K vyfakturování“
Kdo ho vidí: jen vedení, nebo i manažeři zakázek (svoje zakázky)?

### Q30. Zapnutí modulu pro NANTO
- a) jednorázově v DB
- b) přepínač modulů v superadmin panelu (užitečné pro další firmy)

## ABRA (fáze 3b)

### Q31. Párování faktur na zakázku
Je ve fakturách v ABRA číslo zakázky (nebo jiný klíč, např. variabilní symbol), podle kterého se
faktura spáruje se zakázkou / etapou v CRM?
