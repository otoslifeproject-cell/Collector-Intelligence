// Test entry only: not an application route or part of the production build.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import CanonicalArchivePanel from '../../src/components/CanonicalArchivePanel';
import '../../src/styles.css';

declare global {interface Window {
  __CI_ARCHIVE_FIXTURE__:{key:string;email:string;password:string};
  __CI_ARCHIVE_CLIENT__:ReturnType<typeof createClient>;
}}
const node=document.getElementById('archive-fixture')!;
async function boot(){
  const config=window.__CI_ARCHIVE_FIXTURE__;
  if(!config)throw Error('Disposable fixture configuration required');
  const client=createClient('http://127.0.0.1:18000',config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const login=await client.auth.signInWithPassword({email:config.email,password:config.password});
  if(login.error||!login.data.user)throw Error('Disposable fixture sign-in failed');
  window.__CI_ARCHIVE_CLIENT__=client;
  createRoot(node).render(<CanonicalArchivePanel client={client}/>);
}
void boot().catch(()=>{node.textContent='Disposable fixture could not sign in.';});
