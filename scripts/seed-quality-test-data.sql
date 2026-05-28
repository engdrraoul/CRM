-- Données test module Qualité (externalCallId prefix TEST-)
-- Usage : validation UX locale uniquement — supprimer après tests via bouton "Supprimer données test" ou :
--   DELETE FROM public."QualityEvaluation" WHERE "externalCallId" LIKE 'TEST-%';
--
-- Préférez le bouton dev dans Pilotage ou seedQualityTestData() côté app (conseillers réels requis).

-- Exemple manuel si besoin (remplacer UUIDs) :
-- INSERT INTO public."QualityEvaluation" (...) VALUES (...);
