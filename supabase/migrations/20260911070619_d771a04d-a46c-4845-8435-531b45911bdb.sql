CREATE TABLE public.geofix_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utility text NOT NULL,
  serial text NOT NULL,
  msn text,
  acc_no text,
  premise text,
  area text,
  mru text,
  meter_type text,
  premise_desc text,
  manufacturer text,
  latitude double precision,
  longitude double precision,
  raw_location text,
  building_name text,
  building_id text,
  install_status text,
  action_required text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geofix_meters_serial_idx ON public.geofix_meters (upper(serial));
CREATE INDEX geofix_meters_msn_idx ON public.geofix_meters (upper(msn));
CREATE INDEX geofix_meters_acc_idx ON public.geofix_meters (acc_no);
CREATE INDEX geofix_meters_premise_idx ON public.geofix_meters (premise);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofix_meters TO anon, authenticated;
GRANT ALL ON public.geofix_meters TO service_role;
ALTER TABLE public.geofix_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofix meters read" ON public.geofix_meters FOR SELECT USING (true);
CREATE POLICY "geofix meters insert" ON public.geofix_meters FOR INSERT WITH CHECK (true);
CREATE POLICY "geofix meters update" ON public.geofix_meters FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.geofix_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid,
  utility text,
  serial text NOT NULL,
  scenario text NOT NULL,
  old_latitude double precision,
  old_longitude double precision,
  new_latitude double precision,
  new_longitude double precision,
  found_serial text,
  found_placement text,
  found_meter_new_latitude double precision,
  found_meter_new_longitude double precision,
  building_name text,
  area text,
  remarks text,
  submitted_by text NOT NULL,
  submitted_by_name text,
  week_label text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geofix_requests_created_idx ON public.geofix_requests (created_at DESC);
CREATE INDEX geofix_requests_user_idx ON public.geofix_requests (submitted_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofix_requests TO anon, authenticated;
GRANT ALL ON public.geofix_requests TO service_role;
ALTER TABLE public.geofix_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofix requests read" ON public.geofix_requests FOR SELECT USING (true);
CREATE POLICY "geofix requests insert" ON public.geofix_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "geofix requests update" ON public.geofix_requests FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.geofix_field_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofix_field_users TO anon, authenticated;
GRANT ALL ON public.geofix_field_users TO service_role;
ALTER TABLE public.geofix_field_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofix users read" ON public.geofix_field_users FOR SELECT USING (true);
CREATE POLICY "geofix users insert" ON public.geofix_field_users FOR INSERT WITH CHECK (true);
CREATE POLICY "geofix users update" ON public.geofix_field_users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "geofix users delete" ON public.geofix_field_users FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.geofix_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER geofix_meters_touch BEFORE UPDATE ON public.geofix_meters FOR EACH ROW EXECUTE FUNCTION public.geofix_touch_updated_at();
CREATE TRIGGER geofix_requests_touch BEFORE UPDATE ON public.geofix_requests FOR EACH ROW EXECUTE FUNCTION public.geofix_touch_updated_at();
CREATE TRIGGER geofix_field_users_touch BEFORE UPDATE ON public.geofix_field_users FOR EACH ROW EXECUTE FUNCTION public.geofix_touch_updated_at();