// Disposable two-route subset of Supabase's supported Kong gateway configuration.
// Reference: docker/docker-compose.kong.yml and volumes/api/kong-entrypoint.sh
// in supabase/supabase (checked 20 October 2026). Not a hosted gateway replica.
export function continuityKongConfig(anonKey,publishableKey){
  if(!/^[A-Za-z0-9_.-]+$/.test(anonKey) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))throw Error('Invalid disposable key');
  // Retain genuine user Authorization; translate only the fixture's opaque key
  // into its own signed anon token. Never provision service-role API access.
  const authorization=`$((headers.authorization ~= nil and headers.authorization:sub(1, 10) ~= 'Bearer sb_' and headers.authorization) or (headers.apikey == '${publishableKey}' and 'Bearer ${anonKey}') or headers.apikey)`;
  return {
    _format_version:'3.0',_transform:true,
    consumers:[{username:'anon',keyauth_credentials:[{key:anonKey},{key:publishableKey}]}],
    acls:[{consumer:'anon',group:'anon'}],
    services:[['auth','http://127.0.0.1:19999/','/auth/v1/'],['rest','http://127.0.0.1:13000/','/rest/v1/']].map(([name,url,path])=>({
      name,url,routes:[{name:name+'-all',strip_path:true,paths:[path]}],
      plugins:[
        {name:'cors'},
        {name:'key-auth',config:{hide_credentials:false,key_names:['apikey'],key_in_header:true,key_in_query:false,key_in_body:false}},
        {name:'request-transformer',config:{add:{headers:['Authorization: '+authorization]},replace:{headers:['Authorization: '+authorization]}}},
        {name:'acl',config:{hide_groups_header:true,allow:['anon']}},
      ],
    })),
  };
}
