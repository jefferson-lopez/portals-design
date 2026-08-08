-- Grants are already revoked; remove the former broad FOR ALL policies too so
-- future grants cannot accidentally reopen direct writes.
drop policy if exists "Portal editors can manage documents" on public.portal_documents;
drop policy if exists "Editors can write assets" on public.portal_assets;
