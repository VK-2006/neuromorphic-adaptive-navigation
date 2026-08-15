const r=require('express').Router();
const env=require('../config/env');

r.get('/status',(req,res)=>{
  const provider=env.trafficProvider||null;
  const live=provider==='tomtom'&&!!env.trafficApiKey;
  const mode=live?'live-configured':provider?'degraded':'simulation/unknown';
  const note=live
    ?'TomTom live traffic credentials are configured.'
    :provider==='tomtom'
      ?'TomTom provider selected but API key is missing; traffic will degrade to UNKNOWN.'
      :'No live traffic provider configured; simulated values are explicitly labelled.';
  res.json({success:true,data:{provider,live,mode,note}});
});

module.exports=r;
