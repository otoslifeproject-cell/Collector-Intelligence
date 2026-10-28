/**
 * Server-only: release the original photo set after a definitive OpenAI refusal.
 * Database grants the release RPC to service_role only, never a signed-in user.
 * An uncertain response must never call this helper.
 */
export async function releaseRejectedIntake(url:string,runId:string,status:number,errorCode:string):Promise<boolean>{
 const privateKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!privateKey)return false;
 const response=await fetch(url+'/rest/v1/rpc/ci_release_refused_intake_v1',{
  method:'POST',
  headers:{apikey:privateKey,Authorization:'Bearer '+privateKey,'Content-Type':'application/json'},
  body:JSON.stringify({p_run_id:runId,p_http_status:status,p_error_code:errorCode})
 });
 return response.ok && await response.json()==='RELEASED';
}
