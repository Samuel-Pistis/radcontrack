
CREATE TABLE public.contrast_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'morning',
  modality TEXT NOT NULL,
  patient_number TEXT NOT NULL,
  contrast_type TEXT NOT NULL,
  volume_ml NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contrast_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized email can view usage logs"
  ON public.contrast_usage_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'btradiographers@gmail.com');

CREATE POLICY "Authorized email can insert usage logs"
  ON public.contrast_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'btradiographers@gmail.com');

CREATE POLICY "Authorized email can update usage logs"
  ON public.contrast_usage_logs FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'btradiographers@gmail.com');

CREATE POLICY "Authorized email can delete usage logs"
  ON public.contrast_usage_logs FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'btradiographers@gmail.com');

CREATE TRIGGER update_contrast_usage_logs_updated_at
  BEFORE UPDATE ON public.contrast_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
