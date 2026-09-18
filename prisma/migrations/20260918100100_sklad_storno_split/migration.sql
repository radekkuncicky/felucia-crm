-- Historický STORNO znamenal dvě věci s opačným účinkem na zásobu:
-- vrácení protokolu k úpravám (vrátka výdeje) vs. zrušení rezervace.
UPDATE "sklad_pohyby" SET "typ" = 'VRATKA_VYDEJE'
  WHERE "typ" = 'STORNO' AND "duvod" LIKE 'Vrácení protokolu%';
UPDATE "sklad_pohyby" SET "typ" = 'STORNO_REZERVACE'
  WHERE "typ" = 'STORNO';
