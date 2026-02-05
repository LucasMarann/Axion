-- Create route_insights table (1 active row per route)
CREATE TABLE IF NOT EXISTS public.route_insights (
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  insight TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mvp-v1',
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (route_id)
);

-- Enable RLS
ALTER TABLE public.route_insights ENABLE ROW LEVEL SECURITY;

-- Policies:
-- NOTE: We assume existing RLS on routes already restricts who can see a route.
-- We mirror that by allowing SELECT only if user can SELECT the route itself.
-- This keeps "backend never exposes beyond allowed" aligned with DB rules.

DROP POLICY IF EXISTS route_insights_select_via_routes ON public.route_insights;
CREATE POLICY route_insights_select_via_routes
ON public.route_insights
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.routes r
    WHERE r.id = route_insights.route_id
  )
);

-- Only internal roles should write insights. For MVP, restrict to authenticated and rely on backend JWT + route RLS.
-- If you have stronger separation (tenant/company), tighten later.
DROP POLICY IF EXISTS route_insights_upsert_authenticated ON public.route_insights;
CREATE POLICY route_insights_upsert_authenticated
ON public.route_insights
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS route_insights_update_authenticated ON public.route_insights;
CREATE POLICY route_insights_update_authenticated
ON public.route_insights
FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS route_insights_delete_authenticated ON public.route_insights;
CREATE POLICY route_insights_delete_authenticated
ON public.route_insights
FOR DELETE
TO authenticated
USING (true);