const env=require('../config/env');

const cache=new Map();
let nominatimChain=Promise.resolve();
let lastNominatimAt=0;

function tomtomKey(){return env.geocodingApiKey||env.trafficApiKey||''}

function status(){
  const configured=env.geocodingProvider;
  const tomtomAvailable=!!tomtomKey();
  const effective=configured==='nominatim'&&tomtomAvailable?'tomtom':configured;
  return {
    configured,
    effective,
    typeahead:effective==='tomtom'||effective==='graphhopper',
    tomtomAvailable,
    nominatimPolicyMode:effective==='nominatim'?'manual-search-only':'not-active-for-typeahead'
  };
}

async function requestJson(url,{headers={},timeout=7500}={}){
  const r=await fetch(url,{
    signal:AbortSignal.timeout(timeout),
    headers:{
      accept:'application/json',
      'user-agent':'Navora/1.0 (+https://navora-backend-clzp.onrender.com)',
      ...headers
    }
  });
  if(!r.ok){
    const body=await r.text().catch(()=> '');
    const err=new Error(`Geocoding HTTP ${r.status}`);
    err.status=r.status;
    err.providerBody=body.slice(0,180);
    throw err;
  }
  return r.json();
}

function cached(key,ttlMs,loader){
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return Promise.resolve(hit.value);
  return Promise.resolve(loader()).then(value=>{
    cache.set(key,{value,expires:Date.now()+ttlMs});
    if(cache.size>250){
      const first=cache.keys().next().value;
      if(first)cache.delete(first);
    }
    return value;
  });
}

function nominatimRequest(url){
  const key=String(url);
  return cached(`nom:${key}`,5*60_000,()=>{
    const run=async()=>{
      const wait=Math.max(0,1000-(Date.now()-lastNominatimAt));
      if(wait)await new Promise(r=>setTimeout(r,wait));
      try{
        return await requestJson(url,{
          timeout:9000,
          headers:{referer:env.frontendUrl,'accept-language':'en'}
        });
      }finally{
        lastNominatimAt=Date.now();
      }
    };
    const next=nominatimChain.then(run,run);
    nominatimChain=next.then(()=>undefined,()=>undefined);
    return next;
  });
}

function normalizeTomTomResult(x,q,i){
  const lat=Number(x.position?.lat),lng=Number(x.position?.lon);
  const address=x.address||{};
  const name=x.poi?.name||address.freeformAddress||address.municipality||address.localName||q;
  const label=[x.poi?.name,address.freeformAddress,address.municipality,address.countrySubdivision,address.country]
    .filter(Boolean).filter((v,idx,a)=>a.indexOf(v)===idx).join(', ');
  return {id:x.id||`tomtom-${i}`,name,label:label||name,lat,lng,type:x.type||x.entityType||'place',provider:'tomtom'};
}

async function tomtomSearch(q,{limit=6,lat,lng}={}){
  const key=tomtomKey();
  if(!key)throw new Error('TomTom geocoding key is not configured');
  const base=String(env.trafficApiUrl||'https://api.tomtom.com').replace(/\/$/,'');
  const u=new URL(`${base}/search/2/search/${encodeURIComponent(q)}.json`);
  u.searchParams.set('key',key);
  u.searchParams.set('typeahead','true');
  u.searchParams.set('limit',String(Math.min(10,limit)));
  u.searchParams.set('language','en-US');
  if(lat!=null&&lng!=null){u.searchParams.set('lat',String(lat));u.searchParams.set('lon',String(lng))}
  const j=await requestJson(u,{timeout:9000});
  return (j.results||[]).map((x,i)=>normalizeTomTomResult(x,q,i)).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
}

async function graphhopperSearch(q,{limit=6,lat,lng}={}){
  const base=String(env.geocodingApiUrl||'https://graphhopper.com/api/1').replace(/\/$/,'');
  const u=new URL(`${base}/geocode`);
  u.searchParams.set('q',q);u.searchParams.set('limit',String(limit));u.searchParams.set('locale','en');
  if(lat!=null&&lng!=null)u.searchParams.set('point',`${lat},${lng}`);
  if(env.geocodingApiKey||env.routingApiKey)u.searchParams.set('key',env.geocodingApiKey||env.routingApiKey);
  const j=await requestJson(u);
  return (j.hits||[]).map((x,i)=>({id:x.osm_id||`gh-${i}`,name:x.name||x.street||q,label:[x.name,x.street,x.city,x.state,x.country].filter(Boolean).join(', '),lat:Number(x.point?.lat),lng:Number(x.point?.lng),type:x.osm_value||x.osm_key||'place',provider:'graphhopper'})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
}

async function nominatimSearch(q,{limit=6,lat,lng}={}){
  const base=String(env.geocodingApiUrl||'https://nominatim.openstreetmap.org').replace(/\/$/,'');
  const u=new URL(`${base}/search`);
  u.searchParams.set('q',q);u.searchParams.set('format','jsonv2');u.searchParams.set('addressdetails','1');u.searchParams.set('limit',String(Math.min(10,limit)));
  if(lat!=null&&lng!=null)u.searchParams.set('viewbox',`${lng-.4},${lat+.4},${lng+.4},${lat-.4}`);
  const j=await nominatimRequest(u);
  return (j||[]).map(x=>({id:x.place_id,name:x.name||x.display_name?.split(',')[0]||q,label:x.display_name,lat:Number(x.lat),lng:Number(x.lon),type:x.type||x.category||'place',provider:'nominatim'})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
}

async function search(q,{limit=6,lat,lng}={}){
  q=String(q||'').trim();
  if(q.length<2)return[];
  const s=status();
  if(s.effective==='tomtom')return tomtomSearch(q,{limit,lat,lng});
  if(s.effective==='graphhopper')return graphhopperSearch(q,{limit,lat,lng});
  return nominatimSearch(q,{limit,lat,lng});
}

async function tomtomReverse(lat,lng){
  const key=tomtomKey();
  if(!key)throw new Error('TomTom geocoding key is not configured');
  const base=String(env.trafficApiUrl||'https://api.tomtom.com').replace(/\/$/,'');
  const u=new URL(`${base}/search/2/reverseGeocode/${lat},${lng}.json`);
  u.searchParams.set('key',key);u.searchParams.set('language','en-US');
  const j=await requestJson(u,{timeout:9000});
  const x=j.addresses?.[0];
  if(!x)return{id:'coordinates',name:'Selected location',label:`${lat},${lng}`,lat:Number(lat),lng:Number(lng),provider:'coordinates'};
  const address=x.address||{};
  const label=address.freeformAddress||[address.streetName,address.municipality,address.countrySubdivision,address.country].filter(Boolean).join(', ');
  return{id:x.id||'tomtom-reverse',name:address.streetName||address.municipality||address.localName||'Selected location',label:label||`${lat},${lng}`,lat:Number(x.position?.lat??lat),lng:Number(x.position?.lon??lng),provider:'tomtom'};
}

async function graphhopperReverse(lat,lng){
  const base=String(env.geocodingApiUrl||'https://graphhopper.com/api/1').replace(/\/$/,'');
  const u=new URL(`${base}/geocode`);
  u.searchParams.set('reverse','true');u.searchParams.set('point',`${lat},${lng}`);u.searchParams.set('limit','1');u.searchParams.set('locale','en');
  if(env.geocodingApiKey||env.routingApiKey)u.searchParams.set('key',env.geocodingApiKey||env.routingApiKey);
  const j=await requestJson(u);const x=j.hits?.[0];
  return x?{id:x.osm_id||'graphhopper-reverse',name:x.name||x.street||'Selected location',label:[x.name,x.street,x.city,x.state,x.country].filter(Boolean).join(', '),lat:Number(x.point?.lat??lat),lng:Number(x.point?.lng??lng),provider:'graphhopper'}:{id:'coordinates',name:'Selected location',label:`${lat},${lng}`,lat:Number(lat),lng:Number(lng),provider:'coordinates'};
}

async function nominatimReverse(lat,lng){
  const base=String(env.geocodingApiUrl||'https://nominatim.openstreetmap.org').replace(/\/$/,'');
  const u=new URL(`${base}/reverse`);u.searchParams.set('lat',lat);u.searchParams.set('lon',lng);u.searchParams.set('format','jsonv2');
  const x=await nominatimRequest(u);
  return{id:x.place_id,name:x.name||x.display_name?.split(',')[0]||'Selected location',label:x.display_name||`${lat},${lng}`,lat:Number(lat),lng:Number(lng),provider:'nominatim'};
}

async function reverse(lat,lng){
  const s=status();
  if(s.effective==='tomtom')return tomtomReverse(lat,lng);
  if(s.effective==='graphhopper')return graphhopperReverse(lat,lng);
  return nominatimReverse(lat,lng);
}

module.exports={search,reverse,status};
