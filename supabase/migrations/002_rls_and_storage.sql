-- COLLECTOR INTELLIGENCE — SECURITY + PRIVATE IMAGE STORAGE
-- DEDICATED CI PROJECT ONLY.

alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.item_evidence enable row level security;
alter table public.attribution_history enable row level security;
alter table public.comparables enable row level security;
alter table public.valuation_history enable row level security;
alter table public.listings enable row level security;
alter table public.sale_outcomes enable row level security;
alter table public.contacts enable row level security;
alter table public.research_tasks enable row level security;
alter table public.knowledge_records enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'items','item_photos','item_evidence','attribution_history','comparables',
    'valuation_history','listings','sale_outcomes','contacts','research_tasks','knowledge_records'
  ]
  loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t
    );
  end loop;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'item-images','item-images',false,26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set public=false;

drop policy if exists "CI owners can read images" on storage.objects;
create policy "CI owners can read images" on storage.objects for select to authenticated
using (bucket_id='item-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "CI owners can upload images" on storage.objects;
create policy "CI owners can upload images" on storage.objects for insert to authenticated
with check (bucket_id='item-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "CI owners can update images" on storage.objects;
create policy "CI owners can update images" on storage.objects for update to authenticated
using (bucket_id='item-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id='item-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "CI owners can delete images" on storage.objects;
create policy "CI owners can delete images" on storage.objects for delete to authenticated
using (bucket_id='item-images' and (storage.foldername(name))[1] = auth.uid()::text);
