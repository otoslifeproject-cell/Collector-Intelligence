-- One matched pair lot with two preserved member observations.
create or replace function public.ci_approve_saved_intake_v1(
  p_run_id uuid,
  p_object_indices integer[],
  p_reviews jsonb default '{}'::jsonb
)
returns table(item_id uuid, item_code text, object_index integer, title text)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $body$
declare
  v_owner uuid := auth.uid();
  v_run public.ai_analysis_runs%rowtype;
  v_count integer;
  v_index integer;
  v_photo_index integer;
  v_d jsonb;
  v_override jsonb;
  v_manifest jsonb;
  v_prelim jsonb;
  v_user_notes text;
  v_title text;
  v_maker text;
  v_attribution text;
  v_object_type text;
  v_period text;
  v_condition text;
  v_region text;
  v_status text;
  v_readiness text;
  v_photo jsonb;
  v_path text;
  v_item public.items%rowtype;
  v_ev jsonb;
  v_task jsonb;
  v_photo_count integer;
  v_snapshots jsonb := '{}'::jsonb;
  v_pair_indices integer[];
  v_other jsonb;
  v_pair_notes text;
begin
  if v_owner is null then raise exception 'Sign in before approving saved AI results'; end if;
  if p_run_id is null or coalesce(cardinality(p_object_indices),0)=0 then
    raise exception 'Choose at least one saved draft object';
  end if;
  if coalesce(jsonb_typeof(p_reviews),'object') <> 'object' then
    raise exception 'Invalid owner review format';
  end if;
  if exists(select 1 from unnest(p_object_indices) as n where n is null or n < 0)
    or (select count(distinct n) from unnest(p_object_indices) as n) <> cardinality(p_object_indices) then
    raise exception 'Selected object indices must be unique and non-negative';
  end if;

  select * into v_run from public.ai_analysis_runs
    where id=p_run_id and owner_id=v_owner for update;
  if not found then raise exception 'Saved analysis not found for signed-in owner'; end if;
  v_count := coalesce(jsonb_array_length(v_run.result->'objects'),0);
  if v_count=0 or exists(select 1 from unnest(p_object_indices) as n where n >= v_count) then
    raise exception 'Selected object not found in original saved analysis';
  end if;

  -- Completed identical requests may be safely repeated and return the same records.
  if v_run.status='APPROVED' then
    if (select count(*) from public.items i where i.owner_id=v_owner and i.source_analysis_run_id=p_run_id)
       = cardinality(p_object_indices)
       and (select array_agg(i.source_object_index order by i.source_object_index)
            from public.items i where i.owner_id=v_owner and i.source_analysis_run_id=p_run_id)
       = (select array_agg(n order by n) from unnest(p_object_indices) as n)
    then
      return query select i.id,i.item_code,i.source_object_index,i.title
       from public.items i where i.owner_id=v_owner and i.source_analysis_run_id=p_run_id
       order by i.source_object_index;
      return;
    end if;
    raise exception 'Saved report was approved previously with different records; inspect Inventory';
  end if;
  if v_run.status <> 'DRAFT' or v_run.mode not in ('single','batch') then
    raise exception 'Only a saved object-intake DRAFT can be approved';
  end if;
  if exists(select 1 from public.items i where i.source_analysis_run_id=p_run_id and i.owner_id=v_owner) then
    raise exception 'Legacy partial approval detected: resolve existing records before retrying';
  end if;

  v_manifest := v_run.result->'image_manifest';
  if jsonb_typeof(v_manifest) is distinct from 'array'
     or jsonb_array_length(v_manifest) <> v_run.input_photo_count
     or v_run.input_photo_count < 1 then
    raise exception 'Original photograph manifest missing or incomplete; no catalogue records created';
  end if;

  -- All writes below commit together. A failed photo/evidence write rolls back every item.
  for v_index in select n from unnest(p_object_indices) as n order by n loop
    v_d := v_run.result->'objects'->v_index;
    v_override := coalesce(p_reviews->(v_index::text),v_run.result#>array['owner_review','objects',v_index::text],'{}'::jsonb);
    v_pair_indices:=null;
    v_pair_notes:=null;
    if jsonb_typeof(v_override) is distinct from 'object' then
      raise exception 'Invalid review for object %',v_index+1;
    end if;

    -- Explicit owner-approved pair: two pieces become ONE catalogue lot.
    if v_override ? 'pair_source_indices' then
      if v_run.mode <> 'single' or v_count <> 2 or v_index <> 0
         or cardinality(p_object_indices) <> 1 or p_object_indices[1] <> 0
         or jsonb_typeof(v_override->'pair_source_indices') <> 'array' then
        raise exception 'Pair approval requires explicit single-run two-piece grouping';
      end if;
      select array_agg(x::integer order by x::integer) into v_pair_indices
        from jsonb_array_elements_text(v_override->'pair_source_indices') x
        where x ~ '^[0-9]+$';
      if v_pair_indices is distinct from array[0,1]::integer[] then
        raise exception 'Pair must preserve both physical member indices';
      end if;
      v_other:=v_run.result->'objects'->1;
      v_pair_notes:=concat_ws(E'\n',
        'ONE CATALOGUE LOT: matched pair of two separately observed physical pieces.',
        'Original member 1: '||coalesce(v_d->>'working_title','Unknown')||' — '||coalesce(v_d->>'condition_summary','Condition not recorded'),
        'Original member 2: '||coalesce(v_other->>'working_title','Unknown')||' — '||coalesce(v_other->>'condition_summary','Condition not recorded'),
        'Original member objects and photos remain preserved in AI run '||p_run_id::text
      );
      v_d:=jsonb_set(v_d,'{image_indices}',(
        select coalesce(jsonb_agg(DISTINCT x),'[]'::jsonb)
        from (select x from jsonb_array_elements(v_d->'image_indices') x
              union select x from jsonb_array_elements(v_other->'image_indices') x) indexed
      ),true);
      v_d:=jsonb_set(v_d,'{evidence}',
        coalesce(v_d->'evidence','[]'::jsonb)||coalesce(v_other->'evidence','[]'::jsonb),true);
      v_d:=jsonb_set(v_d,'{next_evidence}',
        coalesce(v_d->'next_evidence','[]'::jsonb)||coalesce(v_other->'next_evidence','[]'::jsonb),true);
    end if;
    v_title := coalesce(nullif(btrim(v_override->>'working_title'),''),
      nullif(btrim(v_d->>'working_title'),''),'Unidentified object');
    v_object_type := coalesce(nullif(btrim(v_override->>'object_type'),''),
      nullif(btrim(v_d->>'object_type'),''));
    v_maker := case when v_override ? 'maker' then nullif(btrim(v_override->>'maker'),'')
      else nullif(btrim(v_d->>'maker'),'') end;
    v_attribution := case when v_override ? 'current_attribution' then nullif(btrim(v_override->>'current_attribution'),'')
      else nullif(btrim(v_d->>'current_attribution'),'') end;
    v_period := case when v_override ? 'period_wording' then nullif(btrim(v_override->>'period_wording'),'')
      else nullif(btrim(v_d->>'period_wording'),'') end;
    v_region := case when v_override ? 'region_country' then nullif(btrim(v_override->>'region_country'),'')
      else nullif(btrim(v_d->>'region_country'),'') end;
    v_condition := case when v_override ? 'condition_summary' then nullif(btrim(v_override->>'condition_summary'),'')
      else nullif(btrim(v_d->>'condition_summary'),'') end;
    v_prelim := coalesce(v_d->'preliminary_value','{}'::jsonb);
    v_status := case
      when coalesce((v_d->>'specialist_review')::boolean,false) then 'SPECIALIST_REVIEW'
      when v_d->>'status' in ('CATALOGUED','RESEARCH','ONE_QUICK_CHECK','SPECIALIST_REVIEW','READY_TO_SELL') then v_d->>'status'
      else 'CATALOGUED' end;
    v_readiness := case
      when v_status='SPECIALIST_REVIEW' then 'SPECIALIST_REVIEW'
      when v_d->>'sale_readiness' in ('SELL_NOW','ONE_QUICK_CHECK_THEN_SELL','RESEARCH_FIRST','SPECIALIST_REVIEW')
         then v_d->>'sale_readiness' else 'RESEARCH_FIRST' end;

    if jsonb_typeof(v_d->'image_indices') is distinct from 'array'
       or jsonb_array_length(v_d->'image_indices')=0 then
      raise exception 'Object % has no source photograph indices',v_index+1;
    end if;

    -- Prove each indexed path exists in THIS signed-in owner's intake folder.
    for v_photo in select x from jsonb_array_elements(v_d->'image_indices') as x loop
      if jsonb_typeof(v_photo) <> 'number' or (v_photo::text !~ '^[0-9]+$') then
        raise exception 'Invalid photo index for object %',v_index+1;
      end if;
      v_photo_index := (v_photo::text)::integer;
      select count(*),max(m->>'storage_path') into v_photo_count,v_path
        from jsonb_array_elements(v_manifest) m
        where m->>'index'=v_photo_index::text;
      if v_photo_count<>1 or v_path is null or v_path not like v_owner::text || '/intake/%'
         or not exists(select 1 from storage.objects s
           where s.bucket_id='item-images' and s.name=v_path) then
        raise exception 'Source photo % for object % is not confirmed in private storage',v_photo_index,v_index+1;
      end if;
    end loop;

    insert into public.items(
      owner_id,source_analysis_run_id,source_object_index,catalogue_review_status,
      title,category,object_type,maker,current_attribution,period_wording,region_country,
      material,colour,identification_confidence,dating_confidence,valuation_confidence,
      rarity_desirability,condition_summary,marks_signatures_labels,
      acquisition_price,acquisition_currency,storage_location,status,sale_readiness,
      currency,quick_sale_value,balanced_value_low,balanced_value_high,floor_price,catalogue_note,notes
    ) values (
      v_owner,p_run_id,v_index,'OWNER_REVIEWED',
      v_title,nullif(v_d->>'category',''),v_object_type,v_maker,v_attribution,v_period,v_region,
      nullif(v_d->>'material',''),nullif(v_d->>'colour',''),
      nullif(v_d->>'identification_confidence','')::smallint,
      nullif(v_d->>'dating_confidence','')::smallint,
      nullif(v_d->>'valuation_confidence','')::smallint,
      nullif(v_d->>'rarity_desirability',''),v_condition,nullif(v_d->>'marks_signatures_labels',''),
      case when cardinality(p_object_indices)=1 then nullif(v_run.user_context->>'purchase_price','')::numeric else null end,
      coalesce(nullif(v_run.user_context->>'currency',''),'GBP'),
      nullif(v_run.user_context->>'storage_location',''),v_status,v_readiness,
      coalesce(nullif(v_prelim->>'currency',''),'GBP'),
      nullif(v_prelim->>'quick_sale','')::numeric,
      nullif(v_prelim->>'balanced_low','')::numeric,
      nullif(v_prelim->>'balanced_high','')::numeric,
      nullif(v_prelim->>'floor','')::numeric,
      nullif(v_d->>'catalogue_note',''),
      concat_ws(E'\n',
        case when nullif(v_run.user_context->>'user_notes','') is not null then 'User intake notes: '||(v_run.user_context->>'user_notes') end,
        case when nullif(v_prelim->>'basis','') is not null then 'UNVERIFIED AI valuation basis: '||(v_prelim->>'basis') end,
        v_pair_notes)
    ) returning * into v_item;

    for v_photo in select x from jsonb_array_elements(v_d->'image_indices') as x loop
      v_photo_index := (v_photo::text)::integer;
      select m->>'storage_path' into v_path from jsonb_array_elements(v_manifest) m
       where m->>'index'=v_photo_index::text;
      insert into public.item_photos(
        owner_id,item_id,storage_path,file_name,caption,photo_role,position,is_hero
      ) values (
        v_owner,v_item.id,v_path,
        (select m->>'file_name' from jsonb_array_elements(v_manifest) m where m->>'index'=v_photo_index::text),
        'Original AI intake photo #'||(v_photo_index+1),'Original intake photograph',
        v_photo_index, v_photo_index=(select min((x::text)::integer) from jsonb_array_elements(v_d->'image_indices') x)
      );
    end loop;

    for v_ev in select x from jsonb_array_elements(coalesce(v_d->'evidence','[]'::jsonb)) as x loop
      if nullif(btrim(v_ev->>'claim'),'') is null then continue; end if;
      insert into public.item_evidence(
        owner_id,item_id,claim,provenance,certainty_class,stance,source_reference,verification_status,notes
      ) values (
        v_owner,v_item.id,v_ev->>'claim',
        case when v_ev->>'provenance'='PHOTO' then 'PHOTO' else 'INFERENCE' end,
        case when v_ev->>'certainty_class' in ('FACT','STRONG_ATTRIBUTION','POSSIBLE_ATTRIBUTION','UNKNOWN')
          then v_ev->>'certainty_class' else 'UNKNOWN' end,
        case when v_ev->>'stance' in ('SUPPORTS','WEAKENS','NEUTRAL') then v_ev->>'stance' else 'NEUTRAL' end,
        'Unverified original AI visual intake; run '||p_run_id::text,
        'UNVERIFIED',nullif(v_ev->>'notes','')
      );
    end loop;

    if v_maker is not null or v_attribution is not null then
      insert into public.attribution_history(
        owner_id,item_id,attribution_text,maker,region_country,period_wording,confidence,
        attribution_status,evidence_summary
      ) values (
        v_owner,v_item.id,coalesce(v_attribution,v_maker),v_maker,v_region,v_period,
        nullif(v_d->>'identification_confidence','')::smallint,'CURRENT',
        'Provisional AI-assisted intake; owner review does not independently verify maker.'
      );
    end if;

    for v_task in select x from jsonb_array_elements(coalesce(v_d->'next_evidence','[]'::jsonb)) as x loop
      if nullif(btrim(v_task->>'title'),'') is null then continue; end if;
      insert into public.research_tasks(owner_id,item_id,task_type,title,information_value,notes)
      values (
        v_owner,v_item.id,'EVIDENCE',v_task->>'title',
        nullif(v_task->>'information_value','')::smallint,v_task->>'why'
      );
    end loop;

    v_snapshots := v_snapshots||jsonb_build_object(v_index::text,
      jsonb_build_object(
        'working_title',v_title,'object_type',v_object_type,'maker',v_maker,
        'current_attribution',v_attribution,'period_wording',v_period,
        'region_country',v_region,'condition_summary',v_condition,
        'pair_source_indices',v_pair_indices,'saved_at',now()
      ));
  end loop;

  update public.ai_analysis_runs
   set status='APPROVED',approved_at=now(),
       result=jsonb_set(v_run.result,'{owner_review}',
         coalesce(v_run.result->'owner_review','{}'::jsonb)||jsonb_build_object('approved_snapshot',v_snapshots),true)
   where id=p_run_id and owner_id=v_owner;

  return query
    select i.id,i.item_code,i.source_object_index,i.title from public.items i
    where i.owner_id=v_owner and i.source_analysis_run_id=p_run_id
    order by i.source_object_index;
end
$body$;

revoke all on function public.ci_approve_saved_intake_v1(uuid,integer[],jsonb) from public,anon;
grant execute on function public.ci_approve_saved_intake_v1(uuid,integer[],jsonb) to authenticated;
