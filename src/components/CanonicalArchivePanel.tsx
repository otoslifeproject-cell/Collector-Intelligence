import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {groupArchiveVersions,loadCanonicalArchive,readCanonicalArchiveVersion} from '../lib/canonicalArchive';
import type {ArchiveDocument,ArchiveVersion} from '../lib/canonicalArchive';

export default function CanonicalArchivePanel({client}:{client:SupabaseClient}){
  const [rows,setRows]=useState<ArchiveVersion[]|null>(null);
  const [busy,setBusy]=useState(false),[reading,setReading]=useState(false);
  const [error,setError]=useState(''),[document,setDocument]=useState<ArchiveDocument|null>(null);
  const request=useRef<AbortController|null>(null);
  const documentElement=useRef<HTMLElement|null>(null),readButton=useRef<HTMLButtonElement|null>(null);
  const attempted=useRef(false);
  useEffect(()=>{if(document)documentElement.current?.focus();},[document]);
  useEffect(()=>{
    const {data:{subscription}}=client.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_OUT'||event==='SIGNED_IN'){
        request.current?.abort();attempted.current=false;setRows(null);setDocument(null);setBusy(false);setReading(false);
        setError('Your sign-in changed. Reload the archive to continue.');
      }
    });
    return ()=>{request.current?.abort();subscription.unsubscribe();};
  },[client]);
  const begin=()=>{request.current?.abort();const controller=new AbortController();request.current=controller;return controller;};
  const load=async()=>{
    const controller=begin();attempted.current=true;setBusy(true);setReading(false);setRows(null);setDocument(null);setError('');
    try{const result=await loadCanonicalArchive(client,controller.signal);if(!controller.signal.aborted)setRows(result);}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Source archive could not be loaded.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  };
  const read=async(version:ArchiveVersion)=>{
    const controller=begin();setReading(true);setDocument(null);setError('');
    try{const result=await readCanonicalArchiveVersion(client,version,controller.signal);if(!controller.signal.aborted)setDocument(result);}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'This version could not be read.');}
    finally{if(!controller.signal.aborted)setReading(false);}
  };
  const groups=groupArchiveVersions(rows??[]);
  return <details className="panel ci-canonical-archive" onToggle={event=>{
    if(event.target===event.currentTarget&&event.currentTarget.open&&!attempted.current)void load();
  }}>
    <summary>Project governance &amp; source archive — details</summary>
    <div className="ci-archive-heading">
      <div><h2>Source archive</h2>{rows&&<p>{groups.length} documents · {rows.length} stored versions</p>}</div>
      <button className="secondaryButton" disabled={busy} onClick={()=>void load()}>Reload archive</button>
    </div>
    <p>Stored versions are preserved for review. An archived version is not automatically approved for analysis.</p>
    {busy&&<p role="status">Loading source versions…</p>}
    {reading&&<p role="status">Checking stored text…</p>}
    {error&&<p role="alert">{error}</p>}
    {rows?.length===0&&<p>No stored source versions are available for your account.</p>}
    {groups.map(group=><details className="ci-archive-group" key={group.documentKey}>
      <summary><strong>{group.documentKey}</strong><span>{group.versions.length} stored {group.versions.length===1?'version':'versions'}</span></summary>
      <div className="tableWrap"><table>
        <caption className="ci-visually-hidden">Stored versions of {group.documentKey}</caption>
        <thead><tr><th scope="col">Version</th><th scope="col" className="ci-archive-imported">Imported</th><th scope="col" className="ci-archive-stored-hash">Stored SHA-256</th><th scope="col">Read</th></tr></thead>
        <tbody>{group.versions.map(version=><tr key={version.id}>
          <td>{version.source_version||'Not recorded'}</td>
          <td className="ci-archive-imported"><time dateTime={version.ingested_at}>{new Date(version.ingested_at).toLocaleDateString('en-GB')}</time></td>
          <td className="ci-archive-stored-hash"><code title={version.content_sha256}>{version.content_sha256.slice(0,16)}…</code></td>
          <td><button className="secondaryButton" disabled={reading} aria-label={`Read ${group.documentKey}, version ${version.source_version||'not recorded'}`} onClick={event=>{readButton.current=event.currentTarget;void read(version);}}>Read</button></td>
        </tr>)}</tbody>
      </table></div>
    </details>)}
    {document&&<section className="note ci-archive-document" aria-label="Stored source text" tabIndex={-1} ref={documentElement}>
      <h3>{document.document_key}</h3>
      <p>Version {document.source_version||'not recorded'} · Archived text; approval is not established here.</p>
      <p>Imported <time dateTime={document.ingested_at}>{new Date(document.ingested_at).toLocaleDateString('en-GB')}</time></p>
      <p role="status">{document.integrity==='MATCH'?'SHA-256 matches stored text.':'SHA-256 mismatch. This text must not be relied on as an instruction source.'}</p>
      {document.contentWarning&&<p role="alert">{document.contentWarning==='placeholder'?'This is an unreadable-content placeholder.':'This is a short import.'} It is preserved for review, not usable as an instruction source.</p>}
      <p><code>{document.content_sha256}</code></p>
      <button className="secondaryButton" onClick={()=>{setDocument(null);readButton.current?.focus();}}>Close document</button>
      <pre>{document.content}</pre>
    </section>}
  </details>;
}
