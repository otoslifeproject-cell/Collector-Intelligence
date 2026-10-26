-- UNAPPLIED TO PRODUCTION. Guarded disposable CI only.
create function public.ci_research_scope_keys_v1(p_context jsonb) returns text[]
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare i public.items%rowtype;s public.ai_analysis_runs%rowtype;source_id uuid;object_index integer;pair jsonb;indices integer[];object_count integer;
begin
 if auth.uid() is null or jsonb_typeof(p_context) is distinct from 'object' then raise exception 'Authenticated source context required';end if;
 if p_context->>'item_id' is not null then
  select * into i from public.items where id=(p_context->>'item_id')::uuid and owner_id=auth.uid();
  if not found then raise exception 'Owned research item unavailable';end if;
  if i.source_analysis_run_id is null then return array['item:'||i.id::text];end if;
  source_id:=i.source_analysis_run_id;object_index:=i.source_object_index;
 else
  source_id:=(p_context->>'source_analysis_run_id')::uuid;
  if jsonb_typeof(p_context->'source_object_index') is distinct from 'number' or p_context->>'source_object_index' !~ '^[0-9]+$' then raise exception 'Explicit source index required';end if;
  object_index:=(p_context->>'source_object_index')::integer;pair:=p_context->'pair_source_indices';
 end if;
 select * into s from public.ai_analysis_runs where id=source_id and owner_id=auth.uid() and mode in ('single','batch');
 if not found or jsonb_typeof(s.result->'objects') is distinct from 'array' or s.result->>'analysis_stage' is distinct from 'COMPLETE' then raise exception 'Completed owned original source unavailable';end if;
 object_count:=jsonb_array_length(s.result->'objects');
 if object_index is null or object_index<0 or object_index>=object_count then raise exception 'Physical source mapping unresolved';end if;
 if i.id is not null then pair:=s.result->'owner_review'->'approved_snapshot'->object_index::text->'pair_source_indices';end if;
 if pair is not null and pair<>'null'::jsonb then
  if jsonb_typeof(pair) is distinct from 'array' then raise exception 'Invalid pair scope';end if;
  if jsonb_array_length(pair)>0 then
   if jsonb_array_length(pair)<>2 or exists(select 1 from jsonb_array_elements(pair) x where jsonb_typeof(x)<>'number' or x::text !~ '^[0-9]+$') then raise exception 'Invalid pair members';end if;
   select array_agg(x::integer order by x::integer) into indices from jsonb_array_elements_text(pair) x;
   if indices[1]=indices[2] or indices[1]<0 or indices[2]>=object_count or not(object_index=any(indices)) then raise exception 'Invalid pair mapping';end if;
  end if;
 end if;
 if indices is null then indices:=array[object_index];end if;
 return array(select 'source:'||source_id::text||':'||n::text from unnest(indices) n order by n);
end $$;
revoke all on function public.ci_research_scope_keys_v1(jsonb) from public,anon;
grant execute on function public.ci_research_scope_keys_v1(jsonb) to authenticated;

create function public.ci_claim_scoped_paid_research_v1(p_run_id uuid) returns text
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.ai_analysis_runs%rowtype;o public.ai_analysis_runs%rowtype;keys text[];other_keys text[];key text;
begin
 if auth.uid() is null then raise exception 'Sign in to research';end if;
 select * into r from public.ai_analysis_runs where id=p_run_id and owner_id=auth.uid() and mode='research';
 if not found then raise exception 'Research run unavailable for owner';end if;
 if r.result->>'analysis_stage'='COMPLETE' then return public.ci_claim_paid_research_v1(p_run_id);end if;
 keys:=public.ci_research_scope_keys_v1(r.user_context);
 -- Sorted member locks serialize pair/member overlap and draft/catalogue aliases.
 foreach key in array keys loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'|'||key,0));end loop;
 for o in select * from public.ai_analysis_runs where owner_id=auth.uid() and mode='research' and id<>p_run_id and result->>'analysis_stage'='PROCESSING' loop
  begin other_keys:=public.ci_research_scope_keys_v1(o.user_context);
  exception when others then raise exception 'Recover unresolved earlier research claim before a paid run';end;
  if keys&&other_keys then raise exception 'Overlapping physical source already processing; recover without another charge';end if;
 end loop;
 return public.ci_claim_paid_research_v1(p_run_id);
end $$;
revoke all on function public.ci_claim_scoped_paid_research_v1(uuid) from public,anon;
grant execute on function public.ci_claim_scoped_paid_research_v1(uuid) to authenticated;
