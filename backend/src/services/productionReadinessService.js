const DEFAULT_OPTIONAL_CHECKS=['google','brevo','traffic','passkeys','weather','roboflow','turn'];

function validHttps(value){
  try{
    const u=new URL(String(value||''));
    return u.protocol==='https:'&&!!u.hostname;
  }catch{return false}
}

function validEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
}

function strongSecret(value){
  return typeof value==='string'&&value.length>=32;
}

function googleClientIdReady(value){
  return /^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(String(value||''));
}

function passkeyReady(config){
  try{
    const origin=new URL(String(config.webauthnOrigin||''));
    return origin.protocol==='https:'&&!!config.webauthnRpId&&origin.hostname===config.webauthnRpId;
  }catch{return false}
}

function turnReady(config){
  const any=!!(config.webrtcTurnUrl||config.webrtcTurnUsername||config.webrtcTurnCredential);
  if(!any)return false;
  return /^turns?:/i.test(String(config.webrtcTurnUrl||''))&&!!config.webrtcTurnUsername&&!!config.webrtcTurnCredential;
}

function evaluateProductionReadiness({config,rawEnv=process.env,databaseReady=false}={}){
  if(!config)throw new Error('Production readiness requires resolved config');
  const production=config.nodeEnv==='production';
  const critical={
    database:{required:true,pass:!!databaseReady,message:databaseReady?'MongoDB connected':'MongoDB is not connected'},
    mongodbEnv:{required:production,pass:!production||!!String(rawEnv.MONGODB_URI||'').trim(),message:'MONGODB_URI must be explicitly configured in production'},
    jwtAccess:{required:production,pass:!production||strongSecret(rawEnv.JWT_ACCESS_SECRET),message:'JWT_ACCESS_SECRET must be at least 32 characters in production'},
    jwtRefresh:{required:production,pass:!production||strongSecret(rawEnv.JWT_REFRESH_SECRET),message:'JWT_REFRESH_SECRET must be at least 32 characters in production'},
    jwtDistinct:{required:production,pass:!production||!!rawEnv.JWT_ACCESS_SECRET&&!!rawEnv.JWT_REFRESH_SECRET&&rawEnv.JWT_ACCESS_SECRET!==rawEnv.JWT_REFRESH_SECRET,message:'JWT access and refresh secrets must be different'},
    frontendHttps:{required:production,pass:!production||validHttps(config.frontendUrl),message:'FRONTEND_URL must be HTTPS in production'},
    socketHttps:{required:production,pass:!production||validHttps(config.socketOrigin),message:'SOCKET_CORS_ORIGIN must be HTTPS in production'},
    aiHttps:{required:production,pass:!production||validHttps(config.aiServiceUrl),message:'AI_SERVICE_URL must be HTTPS in production'},
    liveMode:{required:production,pass:!production||config.simulationMode===false,message:'SIMULATION_MODE must be false for production live mode'},
    validatedAiPolicy:{required:production,pass:!production||config.liveRequireValidatedAi===true,message:'LIVE_REQUIRE_VALIDATED_AI must remain true in production'}
  };

  const integrations={
    google:{required:false,pass:googleClientIdReady(config.googleClientId),message:'GOOGLE_CLIENT_ID is not configured as a Google Web client ID'},
    brevo:{required:false,pass:!!config.brevoApiKey&&validEmail(config.brevoSenderEmail),message:'BREVO_API_KEY and a valid BREVO_SENDER_EMAIL are required for email OTP delivery'},
    traffic:{required:false,pass:config.trafficProvider==='tomtom'&&!!config.trafficApiKey,message:'TomTom live traffic requires TRAFFIC_PROVIDER=tomtom and TRAFFIC_API_KEY'},
    passkeys:{required:false,pass:!production||passkeyReady(config),message:'Production passkeys require HTTPS WEBAUTHN_ORIGIN whose hostname equals WEBAUTHN_RP_ID'},
    weather:{required:false,pass:config.weatherProvider==='openweathermap'&&!!config.openWeatherApiKey,message:'OpenWeather live weather risk requires OPENWEATHER_API_KEY'},
    roboflow:{required:false,pass:!!config.roboflowApiKey&&!!(config.roboflowWorkflowUrl||config.roboflowWorkflowId),message:'Roboflow cloud inference requires API key plus workflow URL or workflow ID'},
    turn:{required:false,pass:turnReady(config),message:'Remote WebRTC reliability requires a TURN URL, username and credential'}
  };

  const criticalReady=Object.values(critical).every(x=>!x.required||x.pass);
  const missingIntegrations=DEFAULT_OPTIONAL_CHECKS.filter(k=>!integrations[k]?.pass);
  return {
    production,
    ready:criticalReady,
    criticalReady,
    fullIntegrationReady:missingIntegrations.length===0,
    missingIntegrations,
    critical,
    integrations
  };
}

function publicReadiness(result){
  const scrub=group=>Object.fromEntries(Object.entries(group).map(([key,value])=>[key,{required:!!value.required,pass:!!value.pass,message:value.pass?undefined:value.message}]));
  return {
    production:result.production,
    ready:result.ready,
    criticalReady:result.criticalReady,
    fullIntegrationReady:result.fullIntegrationReady,
    missingIntegrations:[...result.missingIntegrations],
    critical:scrub(result.critical),
    integrations:scrub(result.integrations)
  };
}

module.exports={evaluateProductionReadiness,publicReadiness,validHttps,strongSecret};
