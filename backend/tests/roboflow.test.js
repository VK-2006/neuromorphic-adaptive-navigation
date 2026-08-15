const env=require('../src/config/env');
const rf=require('../src/services/roboflowService');
const risk=require('../src/services/roboflowRiskService');

describe('Roboflow workflow integration v11.4',()=>{
  const old={
    key:env.roboflowApiKey,workspace:env.roboflowWorkspace,id:env.roboflowWorkflowId,
    url:env.roboflowWorkflowUrl,classes:env.roboflowClasses,timeout:env.roboflowTimeoutMs,
    fetch:global.fetch
  };

  beforeEach(()=>{
    env.roboflowApiKey='test-private-key';
    env.roboflowWorkspace='beast-9esfw';
    env.roboflowWorkflowId='yolo-world-small-demo';
    env.roboflowWorkflowUrl='https://serverless.roboflow.com/beast-9esfw/workflows/yolo-world-small-demo';
    env.roboflowClasses='person car bus truck motorcycle bicycle pothole road debris road barrier traffic cone fallen tree animal construction equipment';
    env.roboflowTimeoutMs=25000;
  });

  afterEach(()=>{global.fetch=old.fetch});

  afterAll(()=>{
    env.roboflowApiKey=old.key;env.roboflowWorkspace=old.workspace;env.roboflowWorkflowId=old.id;
    env.roboflowWorkflowUrl=old.url;env.roboflowClasses=old.classes;env.roboflowTimeoutMs=old.timeout;
    global.fetch=old.fetch;
  });

  test('recognizes the exact Navora whitespace class configuration without breaking multi-word labels',()=>{
    expect(rf.classes()).toEqual([
      'person','car','bus','truck','motorcycle','bicycle','pothole','road debris',
      'road barrier','traffic cone','fallen tree','animal','construction equipment'
    ]);
  });

  test('uses URL WorkflowImage, api_key body and class array for Workflow REST',async()=>{
    global.fetch=jest.fn(async()=>({
      ok:true,status:200,
      json:async()=>({outputs:[{predictions:[{class:'car',confidence:.93,x:10,y:20,width:30,height:40}]}]})
    }));
    const x=await rf.infer({image:'https://example.com/test.jpg',classes:['car','truck']});
    expect(x.detections[0].objectClass).toBe('car');
    expect(x.classesTransport).toBe('array');
    const [url,opt]=global.fetch.mock.calls[0];
    expect(String(url)).toBe('https://serverless.roboflow.com/beast-9esfw/workflows/yolo-world-small-demo');
    expect(opt.headers.authorization).toBe('Bearer test-private-key');
    const body=JSON.parse(opt.body);
    expect(body.api_key).toBe('test-private-key');
    expect(body.inputs.image).toEqual({type:'url',value:'https://example.com/test.jpg'});
    expect(body.inputs.classes).toEqual(['car','truck']);
  });

  test('falls back from array to comma-separated classes on workflow input-shape 422',async()=>{
    global.fetch=jest.fn()
      .mockResolvedValueOnce({ok:false,status:422,json:async()=>({detail:'shape'})})
      .mockResolvedValueOnce({ok:true,status:200,json:async()=>({outputs:[{predictions:[]}]})});
    const x=await rf.infer({image:'https://example.com/test.jpg',classes:['car','truck']});
    expect(x.classesTransport).toBe('comma-separated-string');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const body=JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(body.inputs.classes).toBe('car, truck');
  });

  test('builds SNN risk features from Roboflow detections without claiming detector validation',()=>{
    const f=risk.buildFeatures(
      [{objectClass:'pothole',confidence:.88}],
      {trafficDensity:.6,visibility:.7,weatherRisk:.4},
      {speed:8}
    );
    expect(f.objectClass).toBe('pothole');
    expect(f.confidence).toBeCloseTo(.88);
    expect(f.userSpeed).toBe(8);
    expect(f.roadCondition).toBe(.8);
    expect(f.weatherRisk).toBe(.4);
  });

  test('requires backend configuration',async()=>{
    env.roboflowApiKey='';
    await expect(rf.infer({image:'https://example.com/test.jpg',classes:['person']}))
      .rejects.toThrow('not fully configured');
  });
});
