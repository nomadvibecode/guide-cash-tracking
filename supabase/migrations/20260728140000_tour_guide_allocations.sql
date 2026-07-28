-- Create a join table for tour guide allocations
CREATE TABLE tour_allocations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tour_id BIGINT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tour_id, guide_id)
);

-- RLS Policies for tour_allocations
ALTER TABLE tour_allocations ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Allow admins full access" ON tour_allocations
  FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- Authenticated users can view allocations for tours they are part of
CREATE POLICY "Allow authenticated users to view their tour allocations" ON tour_allocations
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT guide_id FROM tour_allocations WHERE tour_id = tour_allocations.tour_id
    )
  );

-- Remove the old single guide column from the tours table
ALTER TABLE tours DROP COLUMN IF EXISTS tour_guide_id;
