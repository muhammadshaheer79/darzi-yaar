
-- =====================
-- profiles
-- =====================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =====================
-- clients
-- =====================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clients_user_id_idx ON public.clients(user_id);
CREATE INDEX clients_user_name_idx ON public.clients(user_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tailor manages own clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================
-- garment_types (catalog)
-- =====================
CREATE TABLE public.garment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.garment_types TO authenticated;
GRANT ALL ON public.garment_types TO service_role;
ALTER TABLE public.garment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read garment types" ON public.garment_types
  FOR SELECT TO authenticated USING (true);

-- =====================
-- garment_fields (catalog)
-- =====================
CREATE TABLE public.garment_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  garment_type_id UUID NOT NULL REFERENCES public.garment_types(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  unit TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  display_order INT NOT NULL DEFAULT 0,
  is_notes BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (garment_type_id, field_key)
);
GRANT SELECT ON public.garment_fields TO authenticated;
GRANT ALL ON public.garment_fields TO service_role;
ALTER TABLE public.garment_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read garment fields" ON public.garment_fields
  FOR SELECT TO authenticated USING (true);

-- =====================
-- job_cards
-- =====================
CREATE TABLE public.job_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  garment_type_id UUID NOT NULL REFERENCES public.garment_types(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','needs_review','confirmed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX job_cards_user_id_idx ON public.job_cards(user_id, created_at DESC);
CREATE INDEX job_cards_client_id_idx ON public.job_cards(client_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT ALL ON public.job_cards TO service_role;
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tailor manages own job cards" ON public.job_cards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================
-- job_card_values
-- =====================
CREATE TABLE public.job_card_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value TEXT,
  confidence TEXT CHECK (confidence IN ('high','low')),
  UNIQUE (job_card_id, field_key)
);
CREATE INDEX job_card_values_card_idx ON public.job_card_values(job_card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_card_values TO authenticated;
GRANT ALL ON public.job_card_values TO service_role;
ALTER TABLE public.job_card_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tailor manages values on own job cards" ON public.job_card_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.user_id = auth.uid())
  );

-- =====================
-- updated_at trigger
-- =====================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated  BEFORE UPDATE ON public.profiles  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated   BEFORE UPDATE ON public.clients   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_job_cards_updated BEFORE UPDATE ON public.job_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- Auto-create profile on signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- Seed garment types + fields
-- =====================
INSERT INTO public.garment_types (slug, name, display_order) VALUES
  ('mens-shalwar-kameez', 'Men''s Shalwar Kameez', 1),
  ('womens-shalwar-kameez', 'Women''s Shalwar Kameez / Kurti', 2);

-- Men's fields
INSERT INTO public.garment_fields (garment_type_id, field_key, field_label, unit, min_value, max_value, display_order, is_notes)
SELECT id, k.field_key, k.field_label, k.unit, k.min_value, k.max_value, k.display_order, k.is_notes
FROM public.garment_types g,
  (VALUES
    ('chest',          'Chest',           'inches', 5, 70, 1, false),
    ('shoulder',       'Shoulder',        'inches', 5, 70, 2, false),
    ('sleeve_length',  'Sleeve Length',   'inches', 5, 70, 3, false),
    ('kameez_length',  'Kameez Length',   'inches', 5, 70, 4, false),
    ('neck',           'Neck',            'inches', 5, 70, 5, false),
    ('shalwar_length', 'Shalwar Length',  'inches', 5, 70, 6, false),
    ('waist',          'Waist',           'inches', 5, 70, 7, false),
    ('notes',          'Notes',           NULL,     NULL, NULL, 8, true)
  ) AS k(field_key, field_label, unit, min_value, max_value, display_order, is_notes)
WHERE g.slug = 'mens-shalwar-kameez';

-- Women's fields
INSERT INTO public.garment_fields (garment_type_id, field_key, field_label, unit, min_value, max_value, display_order, is_notes)
SELECT id, k.field_key, k.field_label, k.unit, k.min_value, k.max_value, k.display_order, k.is_notes
FROM public.garment_types g,
  (VALUES
    ('bust',                'Bust',                    'inches', 5, 70, 1, false),
    ('shoulder',            'Shoulder',                'inches', 5, 70, 2, false),
    ('sleeve_length',       'Sleeve Length',           'inches', 5, 70, 3, false),
    ('kameez_length',       'Kameez / Kurti Length',   'inches', 5, 70, 4, false),
    ('neck',                'Neck',                    'inches', 5, 70, 5, false),
    ('waist',               'Waist',                   'inches', 5, 70, 6, false),
    ('hip',                 'Hip',                     'inches', 5, 70, 7, false),
    ('shalwar_length',      'Shalwar / Trouser Length','inches', 5, 70, 8, false),
    ('notes',               'Notes',                   NULL,     NULL, NULL, 9, true)
  ) AS k(field_key, field_label, unit, min_value, max_value, display_order, is_notes)
WHERE g.slug = 'womens-shalwar-kameez';
