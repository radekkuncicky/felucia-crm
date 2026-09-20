-- Jednorázově při nasazení hashování tokenů (SEC-36): existující nepoužité
-- reset/magic tokeny jsou v DB surové, nový kód hledá SHA-256 hash.
-- Spustit JEDNOU těsně před restartem s novým kódem (podruhé by hashovalo hash!).
UPDATE password_reset_tokens SET token = encode(sha256(token::bytea), 'hex') WHERE used = false AND "expiresAt" > now();
UPDATE magic_link_tokens    SET token = encode(sha256(token::bytea), 'hex') WHERE used = false AND "expiresAt" > now();
DELETE FROM password_reset_tokens WHERE used = true OR "expiresAt" <= now();
DELETE FROM magic_link_tokens    WHERE used = true OR "expiresAt" <= now();
