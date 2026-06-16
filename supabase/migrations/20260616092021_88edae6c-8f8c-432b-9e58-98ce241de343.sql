
ALTER TABLE public.energy_sites ADD COLUMN IF NOT EXISTS surveyor_remarks text;
ALTER TABLE public.water_sites ADD COLUMN IF NOT EXISTS surveyor_remarks text;
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS completed_date text;
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS remarks text;

CREATE UNIQUE INDEX IF NOT EXISTS energy_sites_usn_key ON public.energy_sites(usn);
CREATE UNIQUE INDEX IF NOT EXISTS water_sites_serial_key ON public.water_sites(serial_number);
