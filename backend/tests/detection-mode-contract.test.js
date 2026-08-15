const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

describe('journey detection mode privacy contracts',()=>{
  test('Journey defaults to local detection and cloud mode requires explicit consent',()=>{
    const html=read('frontend/public/journey.html');
    expect(html).toContain('id="detection-mode"');
    expect(html).toContain('<option value="local" selected>Private Local — COCO-SSD</option>');
    expect(html).toContain('<option value="cloud">Enhanced Cloud — Roboflow YOLO-World</option>');
    expect(html).toContain('id="cloud-detection-consent"');
    expect(html).not.toMatch(/id="cloud-detection-consent"[^>]*checked/);
    expect(html).toContain('/assets/js/detection-mode.js');

    const localIndex=html.indexOf('/assets/js/local-detection-bridge.js');
    const cloudIndex=html.indexOf('/assets/js/detection-mode.js');
    const journeyIndex=html.indexOf('/assets/js/journey.js');
    expect(localIndex).toBeGreaterThan(-1);
    expect(cloudIndex).toBeGreaterThan(localIndex);
    expect(journeyIndex).toBeGreaterThan(cloudIndex);
  });

  test('Cloud bridge only redirects detect requests when cloud mode is selected and consent is true',()=>{
    const js=read('frontend/assets/js/detection-mode.js');
    expect(js).toContain("const CLOUD_PATH='/api/v1/roboflow/analyze'");
    expect(js).toContain('consentToCloudProcessing:true');
    expect(js).toContain("select.value='local'");
    expect(js).toContain('CLOUD_MIN_INTERVAL_MS=2500');
    expect(js).toContain("mode()==='cloud'");
    expect(js).toContain('consented()');
    expect(js).toContain('cloudProcessed:true');
  });

  test('Local browser detector remains metadata-only and never forwards requestBody.image',()=>{
    const bridge=read('frontend/assets/js/local-detection-bridge.js');
    expect(bridge).toContain("DETECT_PATH='/api/v1/hazards/detect'");
    expect(bridge).toContain("ANALYZE_PATH='/api/v1/hazards/analyze'");
    expect(bridge).toContain('frameTransmitted:false');
    expect(bridge).not.toContain('requestBody.image');
  });

  test('Roboflow inference routes have a dedicated authenticated cost limiter',()=>{
    const limits=read('backend/src/middleware/rateLimits.js');
    const routes=read('backend/src/routes/roboflowRoutes.js');
    expect(limits).toContain('roboflowInferenceLimiter');
    expect(routes).toContain("r.post('/infer',authenticate,roboflowInferenceLimiter,c.infer)");
    expect(routes).toContain("r.post('/analyze',authenticate,roboflowInferenceLimiter,c.analyze)");
  });

  test('PWA shell includes the new detection-mode runtime',()=>{
    const sw=read('frontend/service-worker.js');
    expect(sw).toContain('"/assets/js/detection-mode.js"');
  });
});
