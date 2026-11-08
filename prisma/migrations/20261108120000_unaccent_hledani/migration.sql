-- Hledání bez diakritiky (klienti): unaccent je od PG13 "trusted", vytvoří ho owner DB.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- IMMUTABLE obal (unaccent() sám je STABLE), použitelný i do indexů.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
