-- Story points on issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS story_points INTEGER;
