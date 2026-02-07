
-- Create a validation trigger to enforce numeric ranges on the JSONB data
CREATE OR REPLACE FUNCTION public.validate_contrast_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  shifts text[] := ARRAY['morning', 'afternoon', 'night'];
  contrast_types text[] := ARRAY['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];
  categories text[] := ARRAY['received', 'consumption', 'outstanding'];
  s text;
  c text;
  cat text;
  mls_val numeric;
  bottles_val numeric;
BEGIN
  -- Skip validation if data is empty default
  IF NEW.data IS NULL OR NEW.data = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  FOREACH s IN ARRAY shifts LOOP
    FOREACH c IN ARRAY contrast_types LOOP
      FOREACH cat IN ARRAY categories LOOP
        -- Extract values, default to 0 if missing
        mls_val := COALESCE((NEW.data -> s -> c -> cat ->> 'mls')::numeric, 0);
        bottles_val := COALESCE((NEW.data -> s -> c -> cat ->> 'bottles')::numeric, 0);

        -- Validate mls range (-100000 to 100000, outstanding can be negative)
        IF mls_val < -100000 OR mls_val > 100000 THEN
          RAISE EXCEPTION 'Invalid mls value for %.%.%: must be between -100000 and 100000', s, c, cat;
        END IF;

        -- Validate bottles range (-1000 to 1000, outstanding can be negative)
        IF bottles_val < -1000 OR bottles_val > 1000 THEN
          RAISE EXCEPTION 'Invalid bottles value for %.%.%: must be between -1000 and 1000', s, c, cat;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_contrast_data_trigger
BEFORE INSERT OR UPDATE ON public.daily_contrast_data
FOR EACH ROW
EXECUTE FUNCTION public.validate_contrast_data();
