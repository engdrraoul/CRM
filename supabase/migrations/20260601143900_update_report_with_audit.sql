-- Rapports journaliers - audited updates for draft/submitted/rejected/validated reports.
-- This migration exists separately from supabase/migration.sql so Supabase CLI
-- deploys the RPC and PostgREST can expose it through the schema cache.

ALTER TABLE public."DailyReport"
  ADD COLUMN IF NOT EXISTS "avgHandlingDuration" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public."ReportEditLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reportId" TEXT NOT NULL,
  "actorId" UUID REFERENCES public."User"(id) ON DELETE SET NULL,
  "actorRole" public."Role",
  action TEXT NOT NULL DEFAULT 'update',
  changes JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public."ReportEditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and superviseurs can read report edit logs" ON public."ReportEditLog";
CREATE POLICY "Admins and superviseurs can read report edit logs"
  ON public."ReportEditLog" FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

DROP POLICY IF EXISTS "Service role full access on report edit logs" ON public."ReportEditLog";
CREATE POLICY "Service role full access on report edit logs"
  ON public."ReportEditLog" FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS "idx_ReportEditLog_reportId" ON public."ReportEditLog"("reportId");
CREATE INDEX IF NOT EXISTS "idx_ReportEditLog_actorId" ON public."ReportEditLog"("actorId");
CREATE INDEX IF NOT EXISTS "idx_ReportEditLog_createdAt" ON public."ReportEditLog"("createdAt");

DROP FUNCTION IF EXISTS public.update_report_with_audit(
  TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN
);
DROP FUNCTION IF EXISTS public.update_report_with_audit(
  TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.update_report_with_audit(
  p_report_id TEXT,
  p_incoming_total INTEGER,
  p_outgoing_total INTEGER,
  p_handled INTEGER,
  p_missed INTEGER,
  p_rdv_total INTEGER,
  p_sms_total INTEGER,
  p_avg_handling_duration INTEGER DEFAULT 0,
  p_observations TEXT DEFAULT NULL,
  p_submit BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role public."Role";
  v_report public."DailyReport"%ROWTYPE;
  v_before JSONB;
  v_after JSONB;
  v_next_status public."DailyReportStatus";
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifie');
  END IF;

  SELECT role INTO v_actor_role FROM public."User" WHERE id = v_actor_id;
  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Utilisateur introuvable');
  END IF;

  SELECT * INTO v_report
  FROM public."DailyReport"
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Rapport introuvable');
  END IF;

  IF p_incoming_total < 0
     OR p_outgoing_total < 0
     OR p_handled < 0
     OR p_missed < 0
     OR p_rdv_total < 0
     OR p_sms_total < 0
     OR p_avg_handling_duration < 0 THEN
    RETURN jsonb_build_object('error', 'Les valeurs ne peuvent pas etre negatives');
  END IF;

  IF v_report.status = 'VALIDATED' THEN
    IF v_actor_role NOT IN ('ADMIN','SUPERVISEUR') THEN
      RETURN jsonb_build_object('error', 'Ce rapport valide ne peut etre modifie que par un superviseur ou un administrateur');
    END IF;

    IF v_actor_role = 'SUPERVISEUR' AND NOT EXISTS (
      SELECT 1 FROM public."CampaignMember" cm
      WHERE cm."userId" = v_actor_id
        AND cm."campaignId" = v_report."campaignId"
        AND cm."endDate" IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'Vous ne pouvez modifier que les rapports de vos campagnes');
    END IF;

    v_next_status := 'VALIDATED';
  ELSE
    IF NOT (
      v_actor_role IN ('ADMIN','COACH_QUALITE')
      OR v_report."userId" = v_actor_id
      OR (
        v_actor_role = 'SUPERVISEUR'
        AND EXISTS (
          SELECT 1 FROM public."CampaignMember" cm
          WHERE cm."userId" = v_actor_id
            AND cm."campaignId" = v_report."campaignId"
            AND cm."endDate" IS NULL
        )
      )
    ) THEN
      RETURN jsonb_build_object('error', 'Vous n''avez pas le droit de modifier ce rapport');
    END IF;

    IF p_submit THEN
      v_next_status := 'SUBMITTED';
    ELSIF v_report.status = 'REJECTED' THEN
      v_next_status := 'DRAFT';
    ELSE
      v_next_status := v_report.status;
    END IF;
  END IF;

  v_before := jsonb_build_object(
    'incomingTotal', v_report."incomingTotal",
    'outgoingTotal', v_report."outgoingTotal",
    'handled', v_report.handled,
    'missed', v_report.missed,
    'rdvTotal', v_report."rdvTotal",
    'smsTotal', v_report."smsTotal",
    'avgHandlingDuration', COALESCE(v_report."avgHandlingDuration", 0),
    'observations', v_report.observations,
    'status', v_report.status
  );

  UPDATE public."DailyReport"
     SET "incomingTotal"       = p_incoming_total,
         "outgoingTotal"       = p_outgoing_total,
         handled               = p_handled,
         missed                = p_missed,
         "rdvTotal"            = p_rdv_total,
         "smsTotal"            = p_sms_total,
         "avgHandlingDuration" = p_avg_handling_duration,
         observations          = p_observations,
         status                = v_next_status,
         "rejectionReason"     = CASE WHEN v_report.status = 'REJECTED' AND NOT p_submit THEN NULL ELSE "rejectionReason" END,
         "submittedAt"         = CASE WHEN p_submit THEN now() ELSE "submittedAt" END,
         "updatedAt"           = now()
   WHERE id = p_report_id;

  v_after := jsonb_build_object(
    'incomingTotal', p_incoming_total,
    'outgoingTotal', p_outgoing_total,
    'handled', p_handled,
    'missed', p_missed,
    'rdvTotal', p_rdv_total,
    'smsTotal', p_sms_total,
    'avgHandlingDuration', p_avg_handling_duration,
    'observations', p_observations,
    'status', v_next_status
  );

  INSERT INTO public."ReportEditLog" ("reportId", "actorId", "actorRole", action, changes, "createdAt")
  VALUES (
    p_report_id,
    v_actor_id,
    v_actor_role,
    CASE WHEN p_submit THEN 'submit' ELSE 'update' END,
    jsonb_build_object('before', v_before, 'after', v_after),
    now()
  );

  RETURN jsonb_build_object('ok', true, 'id', p_report_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_report_with_audit(
  TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN
) TO authenticated;

-- Keep submit_report validation in sync with report fields
CREATE OR REPLACE FUNCTION public.submit_report(p_report_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public."DailyReport"%ROWTYPE;
BEGIN
  SELECT * INTO v_report
  FROM public."DailyReport"
  WHERE id = p_report_id AND "userId" = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Rapport introuvable ou action non autorisée');
  END IF;

  IF v_report."incomingTotal" < 0
     OR v_report."outgoingTotal" < 0
     OR v_report."handled" < 0
     OR v_report."missed" < 0
     OR v_report."rdvTotal" < 0
     OR v_report."smsTotal" < 0
     OR COALESCE(v_report."avgHandlingDuration", 0) < 0 THEN
    RETURN jsonb_build_object('error', 'Les valeurs ne peuvent pas être négatives');
  END IF;

  IF v_report.status = 'VALIDATED' THEN
    RETURN jsonb_build_object('error', 'Ce rapport est déjà validé');
  END IF;

  UPDATE public."DailyReport"
     SET status        = 'SUBMITTED',
         "submittedAt" = now()
   WHERE id = p_report_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
