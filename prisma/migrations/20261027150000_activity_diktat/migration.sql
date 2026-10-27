-- Diktát (procesní mapa C2): úkol bez rodiče, dokud ho uživatel / Dáša nepřipojí k leadu nebo OP.
-- Aktivita má nejvýš jednoho rodiče (dřív přesně jednoho).
ALTER TABLE "activities" DROP CONSTRAINT "activities_one_parent_chk";
ALTER TABLE "activities" ADD CONSTRAINT "activities_one_parent_chk" CHECK (num_nonnulls("dealId", "leadId") <= 1);
