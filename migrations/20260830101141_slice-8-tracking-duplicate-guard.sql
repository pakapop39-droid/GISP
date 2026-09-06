-- Prevent accidental duplicate principal milestones while allowing multiple
-- DELAY and NOTE events in the append-only timeline.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_shipment_milestone()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('DELAY', 'NOTE') AND EXISTS (
    SELECT 1 FROM public.shipment_status_history
    WHERE shipment_id = NEW.shipment_id AND status = NEW.status
  ) THEN
    RAISE EXCEPTION 'SHIPMENT_MILESTONE_ALREADY_RECORDED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shipment_status_history_no_duplicate_milestone
BEFORE INSERT ON public.shipment_status_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_shipment_milestone();
