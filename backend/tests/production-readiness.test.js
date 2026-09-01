const {
  evaluateProductionReadiness,
  publicReadiness
}=require('../src/services/productionReadinessService');

function productionConfig(overrides={}){
  return {
    nodeEnv:'production',
    frontendUrl:'https://navora.example.com',
    socketOrigin:'https://navora.example.com',
    aiServiceUrl:'https://navora-ai.example.com',
    simulationMode:false,
    googleClientId:'1234567890-abcdef.apps.googleusercontent.com',
    brevoApiKey:'brevo-secret-placeholder',
    brevoSenderEmail:'navora@example.com',
    trafficProvider:'tomtom',
    trafficApiKey:'tomtom-secret-placeholder',
    webauthnOrigin:'https://navora.example.com',
    webauthnRpId:'navora.example.com',
    weatherProvider:'openweathermap',
    openWeatherApiKey:'weather-secret-placeholder',
    webrtcTurnUrl:'turns:turn.example.com:5349',
    webrtcTurnUsername:'navora',
    webrtcTurnCredential:'turn-secret-placeholder',
    ...overrides
  };
}

function productionRaw(overrides={}){
  return {
    MONGODB_URI:'mongodb+srv://placeholder.invalid/navora',
    JWT_ACCESS_SECRET:'A'.repeat(48),
    JWT_REFRESH_SECRET:'B'.repeat(48),
    ...overrides
  };
}

describe('V34 production readiness',()=>{
  test('passes critical and integration gates for a complete production config',()=>{
    const out=evaluateProductionReadiness({
      config:productionConfig(),
      rawEnv:productionRaw(),
      databaseReady:true
    });
    expect(out.ready).toBe(true);
    expect(out.criticalReady).toBe(true);
    expect(out.fullIntegrationReady).toBe(true);
    expect(out.missingIntegrations).toEqual([]);
  });

  test('database disconnect makes deployment not ready',()=>{
    const out=evaluateProductionReadiness({
      config:productionConfig(),
      rawEnv:productionRaw(),
      databaseReady:false
    });
    expect(out.ready).toBe(false);
    expect(out.critical.database.pass).toBe(false);
  });

  test('unsafe production defaults are blocked by critical readiness',()=>{
    const out=evaluateProductionReadiness({
      config:productionConfig({
        frontendUrl:'http://localhost:5000',
        socketOrigin:'http://localhost:5000',
        aiServiceUrl:'http://localhost:8000',
        simulationMode:true
      }),
      rawEnv:productionRaw({
        MONGODB_URI:'',
        JWT_ACCESS_SECRET:'same-short',
        JWT_REFRESH_SECRET:'same-short'
      }),
      databaseReady:true
    });
    expect(out.ready).toBe(false);
    expect(out.critical.mongodbEnv.pass).toBe(false);
    expect(out.critical.jwtAccess.pass).toBe(false);
    expect(out.critical.jwtRefresh.pass).toBe(false);
    expect(out.critical.jwtDistinct.pass).toBe(false);
    expect(out.critical.frontendHttps.pass).toBe(false);
    expect(out.critical.socketHttps.pass).toBe(false);
    expect(out.critical.aiHttps.pass).toBe(false);
    expect(out.critical.liveMode.pass).toBe(false);
  });

  test('optional integration gaps do not make the core deployment unavailable',()=>{
    const out=evaluateProductionReadiness({
      config:productionConfig({
        googleClientId:'',
        brevoApiKey:'',
        brevoSenderEmail:'',
        trafficProvider:'',
        trafficApiKey:'',
        openWeatherApiKey:'',
        webrtcTurnUrl:'',
        webrtcTurnUsername:'',
        webrtcTurnCredential:''
      }),
      rawEnv:productionRaw(),
      databaseReady:true
    });
    expect(out.ready).toBe(true);
    expect(out.fullIntegrationReady).toBe(false);
    expect(out.missingIntegrations).toEqual(expect.arrayContaining(['google','brevo','traffic','weather','turn']));
  });

  test('public readiness never serializes secret values',()=>{
    const access='VERY_PRIVATE_ACCESS_SECRET_'+('A'.repeat(40));
    const refresh='VERY_PRIVATE_REFRESH_SECRET_'+('B'.repeat(40));
    const out=evaluateProductionReadiness({
      config:productionConfig(),
      rawEnv:productionRaw({JWT_ACCESS_SECRET:access,JWT_REFRESH_SECRET:refresh}),
      databaseReady:true
    });
    const serialized=JSON.stringify(publicReadiness(out));
    expect(serialized).not.toContain(access);
    expect(serialized).not.toContain(refresh);
    expect(serialized).not.toContain('brevo-secret-placeholder');
    expect(serialized).not.toContain('tomtom-secret-placeholder');
    expect(serialized).not.toContain('turn-secret-placeholder');
  });
});
