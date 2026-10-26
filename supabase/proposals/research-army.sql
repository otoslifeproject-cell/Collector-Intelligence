-- PREPRODUCTION PROPOSAL ONLY. Unapplied live. No provider dispatch, new brain,
-- paid runtime or marketplace operation. Reuse existing immutable research rows.
-- Dependencies: item-research-assessments.sql and reviewed-item-assessments.sql.
create schema if not exists ci_army_internal;
revoke all on schema ci_army_internal from public,anon,service_role;
grant usage on schema ci_army_internal to authenticated;

create function ci_army_internal.report_valid_v1(p jsonb,p_terminal boolean) returns boolean
language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare k text; h jsonb; r jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>11
  or exists(select 1 from jsonb_object_keys(p) x where x not in ('categoryIds','question','query','tool','summary','sourceUrls','photoIds','unresolvedIssues','hypotheses','disagreements','outcome')) then return false; end if;
 foreach k in array array['question','query','tool','summary','unresolvedIssues'] loop
  if jsonb_typeof(p->k) is distinct from 'string' or length(p->>k)>(case when k='question' then 3000 when k='query' then 2000 when k='tool' then 200 else 6000 end)
   or length(btrim(p->>k))<(case when k='question' then 10 when k in ('query','tool') then 1 when p_terminal and k='summary' then 20 when p_terminal and k='unresolvedIssues' then 2 else 0 end) then return false; end if;
 end loop;
 if jsonb_typeof(p->'categoryIds') is distinct from 'array' or jsonb_array_length(p->'categoryIds')>7
  or (select count(distinct x#>>'{}') from jsonb_array_elements(p->'categoryIds') x)<>jsonb_array_length(p->'categoryIds')
  or exists(select 1 from jsonb_array_elements(p->'categoryIds') x where jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('PHOTOGRAPH_EXAM','SIGNATURE_READING','MAKER_ARCHIVE','AUCTION_REALISED','MARKETPLACE_SOLD','CONDITION_REVIEW','SALES_ECONOMICS')) then return false; end if;
 if p->>'outcome' is null or p->>'outcome' not in ('INCONCLUSIVE','BLOCKED','FAILED') then return false; end if;
 if jsonb_typeof(p->'photoIds') is distinct from 'array' or jsonb_array_length(p->'photoIds')>100
  or exists(select 1 from jsonb_array_elements(p->'photoIds') x where jsonb_typeof(x)<>'string' or (x#>>'{}')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
  or (select count(distinct x#>>'{}') from jsonb_array_elements(p->'photoIds') x)<>jsonb_array_length(p->'photoIds') then return false; end if;
 if jsonb_typeof(p->'sourceUrls') is distinct from 'array' or jsonb_array_length(p->'sourceUrls')>100
  or (select count(distinct x#>>'{}') from jsonb_array_elements(p->'sourceUrls') x)<>jsonb_array_length(p->'sourceUrls') then return false; end if;
 for r in select value from jsonb_array_elements(p->'sourceUrls') loop
  if jsonb_typeof(r)<>'string' or length(r#>>'{}')>2000 or (r#>>'{}')!~'^https://[^/@[:space:]]+([/?#]|$)' or (r#>>'{}')~'^https://(localhost|127\.0\.0\.1|\[::1\])([:/?#]|$)' then return false; end if;
 end loop;
 if jsonb_typeof(p->'disagreements') is distinct from 'array' or jsonb_array_length(p->'disagreements')>30
  or exists(select 1 from jsonb_array_elements(p->'disagreements') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}'))<1 or length(x#>>'{}')>2000) then return false; end if;
 if jsonb_typeof(p->'hypotheses') is distinct from 'array' or jsonb_array_length(p->'hypotheses')>30 then return false; end if;
 for h in select value from jsonb_array_elements(p->'hypotheses') loop
  if jsonb_typeof(h)<>'object' or (select count(*) from jsonb_object_keys(h))<>4
   or exists(select 1 from jsonb_object_keys(h) x where x not in ('candidate','status','reason','sourceUrls'))
   or jsonb_typeof(h->'candidate') is distinct from 'string' or length(btrim(h->>'candidate'))<2 or length(h->>'candidate')>500
   or jsonb_typeof(h->'reason') is distinct from 'string' or length(btrim(h->>'reason'))<10 or length(h->>'reason')>3000
   or h->>'status' is null or h->>'status' not in ('SUPPORTED','REJECTED','UNRESOLVED')
   or jsonb_typeof(h->'sourceUrls') is distinct from 'array' or jsonb_array_length(h->'sourceUrls')>100 then return false; end if;
  for r in select value from jsonb_array_elements(h->'sourceUrls') loop
   if jsonb_typeof(r)<>'string' or length(r#>>'{}')>2000 or (r#>>'{}')!~'^https://[^/@[:space:]]+([/?#]|$)' then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function ci_army_internal.report_valid_v1(jsonb,boolean) from public,anon,service_role;

-- All native writes go through the bounded owner/private-review procedures.
-- A direct client cannot forge, mutate, hide or delete a native receipt.
create function public.ci_guard_native_research_army_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
declare native boolean;
begin
 native:=(case when tg_op<>'DELETE' then new.result->>'analysis_stage' in ('ARMY_PLAN','ARMY_ROLE') or new.result ? 'research_army_v1' or new.user_context ? 'research_army_workflow_id' or new.user_context ? 'research_army_event_id' else false end)
  or (case when tg_op<>'INSERT' then old.result->>'analysis_stage' in ('ARMY_PLAN','ARMY_ROLE') or old.result ? 'research_army_v1' or old.user_context ? 'research_army_workflow_id' or old.user_context ? 'research_army_event_id' else false end);
 if coalesce(native,false) then
  if tg_op<>'INSERT' then raise exception 'Native research receipts are append-only'; end if;
  if current_user in ('anon','authenticated','service_role') then raise exception 'Use the bounded native research receipt procedure'; end if;
  if new.owner_id is null or new.mode<>'research' or new.model<>'NATIVE_MANUAL_WORKFLOW_V1' or new.result->'research_army_v1'->>'eventId' is distinct from new.id::text then raise exception 'Malformed native research receipt'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.ci_guard_native_research_army_v1() from public,anon,authenticated,service_role;
create trigger native_research_army_immutable before insert or update or delete on public.ai_analysis_runs for each row execute function public.ci_guard_native_research_army_v1();
create index native_research_army_scope_idx on public.ai_analysis_runs(owner_id,(user_context->>'item_id'),(user_context->>'research_army_workflow_id'),created_at,id)
 where user_context ? 'research_army_workflow_id';

create function ci_army_internal.record_owner_event_v1(p_item_id uuid,p_event_id uuid,p_workflow_id uuid,p_kind text,p_role text,p_expected_facts_sha256 text,p_payload jsonb)
returns public.ai_analysis_runs language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.items%rowtype; old_event public.ai_analysis_runs%rowtype; plan_row public.ai_analysis_runs%rowtype; last_row public.ai_analysis_runs%rowtype; start_row public.ai_analysis_runs%rowtype; saved public.ai_analysis_runs%rowtype;
 roles text[]:=array['COORDINATOR','PHOTO_EXAMINER','ATTRIBUTION_RESEARCHER','RIVAL_CHALLENGER','SOURCE_VERIFIER','COMPARABLE_SPECIALIST','SELLING_REVIEWER'];
 plan jsonb; payload jsonb:=p_payload; role_report jsonb; task uuid; row_receipt jsonb; state text; at_time timestamptz; start_time timestamptz; stage text;
begin
 if auth.uid() is null or p_item_id is null or p_event_id is null or p_workflow_id is null or p_kind is null or p_kind not in ('PLAN','START','RESULT')
  or p_expected_facts_sha256 is null or p_expected_facts_sha256!~'^[a-f0-9]{64}$' or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Authenticated owner and exact native event scope required'; end if;
 select * into i from public.items where id=p_item_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Owned research object is unavailable'; end if;
 select * into old_event from public.ai_analysis_runs where id=p_event_id;
 if found then
  row_receipt:=old_event.result->'research_army_v1';
  if old_event.owner_id is distinct from auth.uid() or old_event.mode<>'research' or old_event.model<>'NATIVE_MANUAL_WORKFLOW_V1'
   or row_receipt->>'workflowId' is distinct from p_workflow_id::text or row_receipt->>'itemId' is distinct from p_item_id::text
   or row_receipt->>'kind' is distinct from p_kind or row_receipt->>'role' is distinct from p_role
   or row_receipt->>'factsSha256' is distinct from p_expected_facts_sha256 or row_receipt->'payload' is distinct from payload then raise exception 'Native event already belongs to different immutable work'; end if;
  return old_event;
 end if;
 at_time:=clock_timestamp();
 if encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex') is distinct from p_expected_facts_sha256 then raise exception 'Object facts changed before native research was recorded'; end if;
 if p_kind='PLAN' then
  if p_workflow_id<>p_event_id or p_role is not null or (select count(*) from jsonb_object_keys(payload))<>3
   or exists(select 1 from jsonb_object_keys(payload) x where x not in ('objective','photoIds','tasks'))
   or jsonb_typeof(payload->'objective') is distinct from 'string' or length(btrim(payload->>'objective'))<10 or length(payload->>'objective')>3000
   or jsonb_typeof(payload->'photoIds') is distinct from 'array' or jsonb_array_length(payload->'photoIds')<1 or jsonb_array_length(payload->'photoIds')>100
   or (select count(distinct x#>>'{}') from jsonb_array_elements(payload->'photoIds') x)<>jsonb_array_length(payload->'photoIds')
   or exists(select 1 from jsonb_array_elements_text(payload->'photoIds') p where not exists(select 1 from public.item_photos ph where ph.id=p::uuid and ph.owner_id=auth.uid() and ph.item_id=p_item_id))
   or jsonb_typeof(payload->'tasks') is distinct from 'array' or jsonb_array_length(payload->'tasks')<>7
   or (select count(distinct x->>'role') from jsonb_array_elements(payload->'tasks') x)<>7
   or (select count(distinct x->>'taskId') from jsonb_array_elements(payload->'tasks') x)<>7
   or exists(select 1 from jsonb_array_elements(payload->'tasks') x where jsonb_typeof(x)<>'object' or (select count(*) from jsonb_object_keys(x))<>2 or not(x->>'role'=any(roles)) or x->>'taskId' is null or x->>'taskId'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then raise exception 'Exact owned photographs and seven distinct native role tasks required'; end if;
  state:='NOT_RUN';stage:='ARMY_PLAN';
 else
  if p_role is null or not(p_role=any(roles)) then raise exception 'Unknown native research role'; end if;
  select * into plan_row from public.ai_analysis_runs where id=p_workflow_id and owner_id=auth.uid() and result->>'analysis_stage'='ARMY_PLAN' and user_context->>'item_id'=p_item_id::text;
  if not found then raise exception 'Original owner-scoped research plan required'; end if;
  plan:=plan_row.result->'research_army_v1';
  if plan->>'factsSha256' is distinct from p_expected_facts_sha256 then raise exception 'Preserve the old workflow and start one for current catalogue facts'; end if;
  select (x->>'taskId')::uuid into task from jsonb_array_elements(plan->'payload'->'tasks') x where x->>'role'=p_role;
  if task is null or (select count(*) from jsonb_object_keys(payload))<>2 or not(payload ? 'report') or not(payload ? 'startEventId')
   or not ci_army_internal.report_valid_v1(payload->'report',p_kind='RESULT') then raise exception 'Complete actual role question/query/tool/results and uncertainty required'; end if;
  role_report:=payload->'report';
  if not((plan->'payload'->'photoIds') @> (role_report->'photoIds')) then raise exception 'A role cannot inherit another object or unselected photograph'; end if;
  select * into last_row from public.ai_analysis_runs where owner_id=auth.uid() and user_context->>'research_army_workflow_id'=p_workflow_id::text
   and result->'research_army_v1'->>'role'=p_role order by created_at desc,id desc limit 1;
  if p_kind='START' then
   if payload->'startEventId' is distinct from 'null'::jsonb or last_row.result->'research_army_v1'->>'kind'='START' then raise exception 'Resume the existing role start before beginning another'; end if;
   state:='RUNNING';start_time:=at_time;
  else
   if last_row.result->'research_army_v1'->>'kind' is distinct from 'START' or payload->>'startEventId' is distinct from last_row.id::text then raise exception 'Role result must refer to its exact latest recorded start'; end if;
   start_row:=last_row;start_time:=(start_row.result->'research_army_v1'->>'startedAt')::timestamptz;state:=role_report->>'outcome';
  end if;
  stage:='ARMY_ROLE';
 end if;
 row_receipt:=jsonb_build_object('version',1,'eventId',p_event_id,'workflowId',p_workflow_id,'ownerId',auth.uid(),'itemId',p_item_id,'factsSha256',p_expected_facts_sha256,
  'kind',p_kind,'role',p_role,'taskId',task,'status',state,'createdAt',at_time,'executorId',auth.uid(),'providerAmount',0,'providerCalls',0,'payload',payload);
 if p_kind<>'PLAN' then row_receipt:=row_receipt||jsonb_build_object('startedAt',start_time,'finishedAt',case when p_kind='RESULT' then at_time else null end); end if;
 insert into public.ai_analysis_runs(id,owner_id,mode,model,status,input_photo_count,user_context,result,created_at)
 values(p_event_id,auth.uid(),'research','NATIVE_MANUAL_WORKFLOW_V1',case when state='FAILED' then 'FAILED' else 'DRAFT' end,
  jsonb_array_length(case when p_kind='PLAN' then payload->'photoIds' else role_report->'photoIds' end),
  jsonb_build_object('item_id',p_item_id,'research_army_workflow_id',p_workflow_id,'research_army_event_id',p_event_id),jsonb_build_object('analysis_stage',stage,'research_army_v1',row_receipt),at_time) returning * into saved;
 return saved;
end $$;
revoke all on function ci_army_internal.record_owner_event_v1(uuid,uuid,uuid,text,text,text,jsonb) from public,anon,service_role;
grant execute on function ci_army_internal.record_owner_event_v1(uuid,uuid,uuid,text,text,text,jsonb) to authenticated;
create function public.ci_record_research_army_event_v1(p_item_id uuid,p_event_id uuid,p_workflow_id uuid,p_kind text,p_role text,p_expected_facts_sha256 text,p_payload jsonb)
returns public.ai_analysis_runs language sql security invoker set search_path=pg_catalog as $$select ci_army_internal.record_owner_event_v1(p_item_id,p_event_id,p_workflow_id,p_kind,p_role,p_expected_facts_sha256,p_payload)$$;
revoke all on function public.ci_record_research_army_event_v1(uuid,uuid,uuid,text,text,text,jsonb) from public,anon,service_role;
grant execute on function public.ci_record_research_army_event_v1(uuid,uuid,uuid,text,text,text,jsonb) to authenticated;

-- A private reviewer may attest recorded work against an already qualified
-- independent review. This does not create a final assessment or sale readiness.
create function ci_private.attest_research_army_v1(p_owner uuid,p_item uuid,p_assessment uuid,p_entries jsonb)
returns setof public.ai_analysis_runs language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.items%rowtype; a public.item_research_assessments%rowtype; e jsonb; r public.ai_analysis_runs%rowtype; old_row public.ai_analysis_runs%rowtype; saved public.ai_analysis_runs%rowtype; receipt jsonb; at_time timestamptz; event uuid; all_replays boolean:=true;
begin
 if current_setting('role',true)<>'ci_item_assessment_reviewer' or auth.uid() is null or auth.uid()=p_owner or not exists(select 1 from auth.users where id=auth.uid())
  or jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>7 then raise exception 'Independent authenticated private reviewer and bounded actual role receipts required'; end if;
 select * into i from public.items where id=p_item and owner_id=p_owner for update;
 if not found then raise exception 'Reviewer object unavailable'; end if;
 select * into a from public.item_research_assessments where id=p_assessment and owner_id=p_owner and item_id=p_item and review_status='SOURCE_REVIEWED';
 if not found or a.assessment->>'reviewerId' is distinct from auth.uid()::text then raise exception 'Use this independent reviewer’s existing qualified source assessment'; end if;
 if (select count(distinct x->>'eventId') from jsonb_array_elements(p_entries) x)<>jsonb_array_length(p_entries)
  or (select count(distinct x->>'resultEventId') from jsonb_array_elements(p_entries) x)<>jsonb_array_length(p_entries) then raise exception 'Duplicate role attestation event'; end if;
 -- Verify every replay first. A lost acknowledgement may recover immutable
 -- receipts even after later evidence changes; the view checks current anchors.
 for e in select value from jsonb_array_elements(p_entries) loop
  if jsonb_typeof(e) is distinct from 'object' or (select count(*) from jsonb_object_keys(e))<>4 or not(e ?& array['eventId','resultEventId','rationale','sourceRefs'])
   or jsonb_typeof(e->'rationale') is distinct from 'string' or jsonb_typeof(e->'eventId') is distinct from 'string' or jsonb_typeof(e->'resultEventId') is distinct from 'string'
   or e->>'eventId'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or e->>'resultEventId'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or length(btrim(e->>'rationale'))<40 or length(e->>'rationale')>6000 or jsonb_typeof(e->'sourceRefs') is distinct from 'array' or jsonb_array_length(e->'sourceRefs')<1
   or jsonb_array_length(e->'sourceRefs')>100
   or exists(select 1 from jsonb_array_elements(e->'sourceRefs') x where jsonb_typeof(x)<>'string')
   or (select count(distinct x#>>'{}') from jsonb_array_elements(e->'sourceRefs') x)<>jsonb_array_length(e->'sourceRefs')
   or not((a.assessment->'sourceRefs') @> (e->'sourceRefs')) then raise exception 'Role-specific independent rationale and exact existing source references required'; end if;
  select * into r from public.ai_analysis_runs where id=(e->>'resultEventId')::uuid and owner_id=p_owner and user_context->>'item_id'=p_item::text and result->'research_army_v1'->>'kind'='RESULT';
  if not found or r.result->'research_army_v1'->>'executorId'=auth.uid()::text or not ci_army_internal.report_valid_v1(r.result->'research_army_v1'->'payload'->'report',true) then raise exception 'Independent attestation requires a separate actual prior role result'; end if;
  select * into old_row from public.ai_analysis_runs where id=(e->>'eventId')::uuid;
  if found then
   receipt:=old_row.result->'research_army_v1';
   if old_row.owner_id is distinct from p_owner or receipt->>'itemId' is distinct from p_item::text
    or receipt->>'workflowId' is distinct from r.result->'research_army_v1'->>'workflowId' or receipt->>'taskId' is distinct from r.result->'research_army_v1'->>'taskId'
    or receipt->>'role' is distinct from r.result->'research_army_v1'->>'role' or receipt->>'factsSha256' is distinct from r.result->'research_army_v1'->>'factsSha256'
    or receipt->'payload'->'report' is distinct from r.result->'research_army_v1'->'payload'->'report' or receipt->>'kind' is distinct from 'ATTESTATION' or receipt->>'executorId' is distinct from auth.uid()::text
    or receipt->'payload'->>'resultEventId' is distinct from r.id::text or receipt->'payload'->>'assessmentId' is distinct from p_assessment::text
    or receipt->'payload'->>'rationale' is distinct from e->>'rationale' or receipt->'payload'->'sourceRefs' is distinct from e->'sourceRefs' then raise exception 'Attestation event already belongs to different immutable work'; end if;
  else
   all_replays:=false;
   if r.mode<>'research' or r.model<>'NATIVE_MANUAL_WORKFLOW_V1' or r.result->>'analysis_stage'<>'ARMY_ROLE'
    or r.result->'research_army_v1'->>'ownerId' is distinct from p_owner::text or r.result->'research_army_v1'->>'itemId' is distinct from p_item::text
    or r.result->'research_army_v1'->>'factsSha256' is distinct from encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex') then raise exception 'Current exact object facts and original native role receipt required'; end if;
   if exists(select 1 from public.ai_analysis_runs newer where newer.owner_id=p_owner
    and newer.user_context->>'research_army_workflow_id'=r.user_context->>'research_army_workflow_id'
    and newer.result->'research_army_v1'->>'role'=r.result->'research_army_v1'->>'role'
    and (newer.created_at,newer.id)>(r.created_at,r.id)) then raise exception 'Attest the latest actual role result, not superseded work'; end if;
   -- References must actually occur in this role execution. Existing anchors,
   -- not repeated model opinions, define which documentary/photo/sale is linked.
   if exists(select 1 from jsonb_array_elements_text(e->'sourceRefs') ref where not exists(
    select 1 from jsonb_array_elements(a.assessment->'evidenceSources') anchor where anchor->>'reference'=ref
    and ((anchor->>'kind'='PHOTO' and (r.result->'research_army_v1'->'payload'->'report'->'photoIds') ? (anchor->>'id'))
      or (anchor->>'kind' in ('EVIDENCE','COMPARABLE') and (r.result->'research_army_v1'->'payload'->'report'->'sourceUrls') ? ref))
    and case r.result->'research_army_v1'->>'role' when 'PHOTO_EXAMINER' then anchor->>'kind'='PHOTO'
     when 'COMPARABLE_SPECIALIST' then anchor->>'kind'='COMPARABLE'
     when 'ATTRIBUTION_RESEARCHER' then anchor->>'kind'='EVIDENCE'
     when 'RIVAL_CHALLENGER' then anchor->>'kind' in ('EVIDENCE','COMPARABLE')
     when 'SOURCE_VERIFIER' then anchor->>'kind' in ('EVIDENCE','COMPARABLE') else true end
   )) then raise exception 'Attestation sources must match the actual role-specific original execution'; end if;
  end if;
 end loop;
 if not all_replays and (a.facts_snapshot is distinct from to_jsonb(i) or not public.ci_reviewed_item_payload_valid_v1(p_owner,p_item,a.assessment)
  or exists(select 1 from public.item_research_assessments newer where newer.owner_id=p_owner and newer.item_id=p_item and (newer.created_at,newer.id)>(a.created_at,a.id))) then raise exception 'A current, independently qualified source assessment is required before new role attestation'; end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  event:=(e->>'eventId')::uuid;
  select * into saved from public.ai_analysis_runs where id=event;
  if found then return next saved;continue;end if;
  select * into r from public.ai_analysis_runs where id=(e->>'resultEventId')::uuid;
  at_time:=clock_timestamp();receipt:=r.result->'research_army_v1';
  receipt:=receipt||jsonb_build_object('eventId',event,'kind','ATTESTATION','status','EVIDENCED','createdAt',at_time,'executorId',auth.uid(),
   'payload',(receipt->'payload')||jsonb_build_object('resultEventId',r.id,'assessmentId',p_assessment,'reviewerId',auth.uid(),'rationale',e->>'rationale','sourceRefs',e->'sourceRefs'));
  insert into public.ai_analysis_runs(id,owner_id,mode,model,status,input_photo_count,user_context,result,created_at)
   values(event,p_owner,'research','NATIVE_MANUAL_WORKFLOW_V1','DRAFT',r.input_photo_count,
    r.user_context||jsonb_build_object('research_army_event_id',event),jsonb_build_object('analysis_stage','ARMY_ROLE','research_army_v1',receipt),at_time) returning * into saved;
  return next saved;
 end loop;
end $$;
revoke all on function ci_private.attest_research_army_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function ci_private.attest_research_army_v1(uuid,uuid,uuid,jsonb) to ci_item_assessment_reviewer;

-- Current role evidence is derived from existing immutable review anchors. New
-- native events cannot certify themselves or bypass the final item decision.
create function public.ci_army_attestation_current_v1(p_event uuid) returns boolean
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare r public.ai_analysis_runs%rowtype; a public.item_research_assessments%rowtype; i public.items%rowtype; x jsonb; receipt jsonb;
begin
 select * into r from public.ai_analysis_runs where id=p_event and owner_id=auth.uid();
 if not found then return false; end if;receipt:=r.result->'research_army_v1';
 if receipt->>'kind' is distinct from 'ATTESTATION' or receipt->>'status' is distinct from 'EVIDENCED' then return false; end if;
 select * into i from public.items where id=(receipt->>'itemId')::uuid and owner_id=auth.uid();if not found then return false;end if;
 select * into a from public.item_research_assessments where id=(receipt->'payload'->>'assessmentId')::uuid and owner_id=auth.uid() and item_id=i.id and review_status='SOURCE_REVIEWED';
 if not found or a.facts_snapshot is distinct from to_jsonb(i) or receipt->>'factsSha256' is distinct from encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex') or a.assessment->>'reviewerId' is distinct from receipt->>'executorId'
  or not((a.assessment->'sourceRefs') @> (receipt->'payload'->'sourceRefs')) then return false; end if;
 for x in select value from jsonb_array_elements(a.assessment->'evidenceSources') loop
  if x is distinct from public.ci_item_review_anchor_v1(a.owner_id,a.item_id,x->>'kind',(x->>'id')::uuid) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.ci_army_attestation_current_v1(uuid) from public,anon,service_role;
grant execute on function public.ci_army_attestation_current_v1(uuid) to authenticated;
create view public.research_army_receipts_v1 with(security_invoker=true) as
 select r.*,case when r.result->'research_army_v1'->>'kind'='ATTESTATION' then public.ci_army_attestation_current_v1(r.id) else false end as army_attestation_current
 from public.ai_analysis_runs r where r.owner_id=(select auth.uid()) and r.mode='research' and r.result->>'analysis_stage' in ('ARMY_PLAN','ARMY_ROLE');
revoke all on public.research_army_receipts_v1 from public,anon,service_role;
grant select on public.research_army_receipts_v1 to authenticated;
