-- Milestone 6: lets a client flag their own situation as more complex
-- than usual, right from the tax organizer, instead of hoping staff
-- notices from the notes fields. Run after schema_tax_organizer.sql.

alter table tax_organizer_responses
  add column if not exists needs_attention boolean not null default false;

alter table tax_organizer_responses
  add column if not exists attention_notes text;
