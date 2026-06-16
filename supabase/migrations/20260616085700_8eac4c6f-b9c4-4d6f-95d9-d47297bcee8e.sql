
CREATE TABLE public.energy_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text, acc_no text, premise text,
  usn text UNIQUE NOT NULL,
  msn text, type text, mru text, premise_desc text, location text,
  linked_main_water_meter text, sub_water_meter text, mps_as_per_loc text,
  building_name text, building_id text, action_required text,
  assigned_surveyor text, date_survey_completed text,
  week_of_submission text, new_data text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.energy_sites TO anon, authenticated;
GRANT ALL ON public.energy_sites TO service_role;
ALTER TABLE public.energy_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read energy" ON public.energy_sites FOR SELECT USING (true);
CREATE POLICY "public write energy" ON public.energy_sites FOR INSERT WITH CHECK (true);
CREATE POLICY "public update energy" ON public.energy_sites FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete energy" ON public.energy_sites FOR DELETE USING (true);

CREATE TABLE public.water_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text, acc_no text, premise text, main_installation text,
  serial_number text UNIQUE NOT NULL,
  msn text, size text, mru text, premise_desc text, location text,
  linked_main_water_meter text, mps_as_per_loc text,
  building_name text, building_id text, action_required text,
  assigned_surveyor text, date_survey_completed text,
  week_of_submission text, new_data text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_sites TO anon, authenticated;
GRANT ALL ON public.water_sites TO service_role;
ALTER TABLE public.water_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read water" ON public.water_sites FOR SELECT USING (true);
CREATE POLICY "public write water" ON public.water_sites FOR INSERT WITH CHECK (true);
CREATE POLICY "public update water" ON public.water_sites FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete water" ON public.water_sites FOR DELETE USING (true);

CREATE TABLE public.verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usn text NOT NULL,
  site_type text NOT NULL,
  surveyor_name text,
  visited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  wrong_fields text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verifications TO anon, authenticated;
GRANT ALL ON public.verifications TO service_role;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read verifications" ON public.verifications FOR SELECT USING (true);
CREATE POLICY "public write verifications" ON public.verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "public update verifications" ON public.verifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete verifications" ON public.verifications FOR DELETE USING (true);
