-- Fase 2: partial score (0..1) for multi-answer activity formats.
ALTER TABLE "activity_attempts" ADD COLUMN "score" DOUBLE PRECISION;
