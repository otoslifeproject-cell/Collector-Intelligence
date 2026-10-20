// Pure validator; no network or database connection occurs here.
export function assertIsolatedDatabaseConfig(raw, confirmed) {
 if(!raw) throw new Error('CI_STAGING_DATABASE_URL required');
 let u; try {u=new URL(raw)} catch {throw new Error('Invalid database URL')}
 if(!['postgres:','postgresql:'].includes(u.protocol))throw new Error('Expected PostgreSQL URL');
 const host=u.hostname.toLowerCase();
 if(host.includes('bwdafrwkimjvwfoqomot'))throw new Error('REFUSED production Supabase project');
 if(!['localhost','127.0.0.1','[::1]'].includes(host))throw new Error('Only local isolated PostgreSQL is permitted');
 if(confirmed!=='yes')throw new Error('Explicit isolated staging confirmation required');
 const database=decodeURIComponent(u.pathname.replace(/^\//,''));
 if(!/^ci_staging_[a-z0-9_]+$/.test(database))throw new Error('REFUSED non-staging database name');
 return {hostname:host,database};
}
