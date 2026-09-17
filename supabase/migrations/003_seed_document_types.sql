insert into public.document_types (name, description, is_required)
values
  ('Personal Record', 'Personal/student record documents', true),
  ('Academic Record', 'Academic and scholastic records', true),
  ('Completion and Certification Records', 'Completion and certification documents', true),
  ('RLE / Clinical Records', 'RLE and clinical documentation', true),
  ('Others', 'Other supporting documents', false)
on conflict (name) do nothing;
