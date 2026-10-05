-- =============================================================================================
-- 0035 — a bought document records what it cost                                         ORDERED
--
-- A PAID FILING HAD NO PLACE FOR ITS PRICE. The analyst buys a filing from a registry and uploads
-- it, and the record kept the bytes and the provider but not the money spent on them.
--
-- THE UNIT IS IN THE NAME (M10). The column holds euros, two decimals. The analyst converts a
-- price in another currency at the day of the purchase, and the column holds no currency code.
--
-- NULLABLE, AND NOT ZERO BY DEFAULT. A free document and a document of unknown cost are two
-- facts, and a default of zero would merge them. The guard names NULL first, so a negative value
-- cannot pass by three-valued logic.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents ADD COLUMN cost_eur numeric(12,2)
  CONSTRAINT documents_cost_eur_not_negative CHECK (cost_eur IS NULL OR cost_eur >= 0);

RESET ROLE;
