(function(){
  let state=null;
  const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));
  const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const telemetry=()=>window.NavoraResearchTelemetry||{routeMemories:0,journeys:0,familiarity:0,historicalSafety:0,reliability:0,samples:[]};
  const quality=()=>{if(reduced())return 0;const m=navigator.deviceMemory||4;return innerWidth<700||m<=2?1:m<8?2:3};
  const palette=()=>document.documentElement.dataset.theme==='dark'
    ?{ink:0xE8E4FF,muted:0xA99BFF,neural:0xA99BFF,gold:0xD4AF37,crm:0x8E7CFF,crm2:0xF2D675,route:0xD9A84E,rose:0xE98B9A,grid:0x5B42D6}
    :{ink:0x352B3A,muted:0x6E3B6E,neural:0x6E3B6E,gold:0xB58A32,crm:0x8E5C8E,crm2:0xD5B86A,route:0xB58A32,rose:0xB86B77,grid:0xD8CFC4};
  const makeLabel=(host,text,kind,x,y)=>{
    const el=document.createElement('span');el.className=`research-label ${kind||''}`;el.textContent=text;
    el.style.cssText=`position:absolute;left:${x}%;top:${y}%;z-index:3;transform:translateY(-50%);pointer-events:none;max-width:29%;white-space:normal;`;
    host.appendChild(el);return el;
  };
  function fallback(host,reason){
    host.classList.add('p-webgl-fallback','research-static-fallback');
    const t=telemetry(),samples=Array.isArray(t.samples)?t.samples:[],memoryCount=Number(t.routeMemories)||samples.length;
    host.innerHTML=`<div class="research-fallback-head"><strong>Telemetry-driven research visualization</strong><span>${reason||'WebGL unavailable'}</span></div>
      <div class="research-fallback-grid">
        <section><b>SNN</b><span>Conceptual neuromorphic risk flow</span><div class="fallback-pipeline"><i>Input</i><em>→</em><i>Encoding</i><em>→</em><i>Neurons</i><em>→</em><i>Risk</i></div></section>
        <section><b>CRM</b><span>${memoryCount} stored route memor${memoryCount===1?'y':'ies'} · ${Number(t.journeys)||0} journeys</span><div class="fallback-routes">${samples.slice(0,4).map((s,i)=>`<i style="--route:${i};--strength:${.35+.65*clamp(s.safety)}"></i>`).join('')}</div></section>
        <section><b>ACO</b><span>Conceptual route competition</span><div class="fallback-aco"><i></i><i></i><i></i></div></section>
      </div>`;
  }
  async function init(){
    try{await window.NavoraResearchReady}catch{}
    const host=document.getElementById('three-research');if(!host||state)return;
    const q=quality();if(!window.THREE){fallback(host,'Three.js dependency unavailable');return}
    if(!q){fallback(host,'Reduced motion enabled — static research view');return}
    let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:q>1,powerPreference:'high-performance'})}catch{fallback(host,'WebGL unavailable — core navigation remains available');return}
    const mobile=innerWidth<700, w=host.clientWidth, h=host.clientHeight;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-5.5,5.5,2.35,-1.55,.1,40);camera.position.z=12;
    renderer.setPixelRatio(Math.min(q===3?1.5:1.05,devicePixelRatio));renderer.setSize(w,h,false);renderer.setClearColor(0x000000,0);host.appendChild(renderer.domElement);
    const p=palette(),t=telemetry(),samples=(Array.isArray(t.samples)?t.samples:[]).slice(0,q===1?4:8),hasCrmTelemetry=samples.length>0||Number(t.routeMemories)>0;
    const groups={snn:new THREE.Group(),crm:new THREE.Group(),aco:new THREE.Group(),signals:new THREE.Group()};Object.values(groups).forEach(g=>scene.add(g));
    const materials=[],disposables=[];
    const mat=(color,opacity=1)=>{const m=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity});materials.push(m);return m};
    const nodeMat=(color,opacity=.95)=>{const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity});materials.push(m);return m};
    const line=(points,material,group=scene)=>{const g=new THREE.BufferGeometry().setFromPoints(points);disposables.push(g);const l=new THREE.Line(g,material);group.add(l);return l};
    const sphere=(x,y,r,color,group)=>{const g=new THREE.SphereGeometry(r,q===1?6:8,q===1?6:8);const m=nodeMat(color);const n=new THREE.Mesh(g,m);n.position.set(x,y,0);n.userData.base=r;n.userData.phase=Math.random()*6.28;group.add(n);disposables.push(g);return n};
    const glow=(x,y,color,group)=>{const n=sphere(x,y,.085,color,group);n.material.opacity=.3;return n};
    const title=(text,x,y)=>makeLabel(host,text,'research-title',x,y);
    const caption=(text,x,y)=>makeLabel(host,text,'research-caption',x,y);
    host.querySelectorAll('.research-label').forEach(e=>e.remove());
    title('SNN · conceptual risk flow',3,6);title(hasCrmTelemetry?'CRM · learned experience':'CRM · awaiting route memory',38,6);title('ACO · route competition',70,6);
    caption('telemetry-driven representation',3,13);caption(hasCrmTelemetry?'real route-memory samples':'no stored route traces yet',38,13);caption('candidate paths · not pheromone tensors',70,13);
    const sx=mobile?-3.7:-4.65, sy=mobile?1.2:1.25;
    const stageX=[sx,sx+1.05,sx+2.1,sx+3.15], stageY=[sy,sy-.05,sy+.05,sy];
    const stageColors=[p.gold,p.neural,p.neural,p.gold], stageNodes=[];
    stageX.forEach((x,stage)=>{
      const nodes=[];const count=stage===2?(q===3?6:q===2?5:4):stage===1?4:stage===0?3:2;
      for(let i=0;i<count;i++){const y=stageY[stage]+(i-(count-1)/2)*.52;nodes.push(sphere(x,y,.105,stageColors[stage],groups.snn));glow(x,y,stageColors[stage],groups.snn)}
      stageNodes.push(nodes);
      if(stage>0)stageNodes[stage-1].forEach(a=>nodes.forEach(b=>line([a.position.clone(),b.position.clone()],mat(stageColors[stage],.18),groups.snn)));
    });
    const routeStart=new THREE.Vector3(-.35,-.8,0),routeEnd=new THREE.Vector3(4.7,-.8,0);
    const crmGroup=groups.crm, routeSamples=samples.length?samples:(Number(t.routeMemories)>0?[{familiarity:t.familiarity||0,safety:t.historicalSafety||0,journeys:t.journeys||0}]:[]);
    const crmRoutes=[];
    routeSamples.forEach((s,i)=>{
      const familiarity=clamp(s.familiarity),safety=clamp(s.safety),spread=(i-(routeSamples.length-1)/2)*.2;
      const pts=[routeStart.clone(),new THREE.Vector3(.65,-.5+spread+.8*familiarity,0),new THREE.Vector3(1.8,-1.15+spread+.5*safety,0),new THREE.Vector3(3.1,-.4+spread+.35*familiarity,0),routeEnd.clone()];
      const curve=new THREE.CatmullRomCurve3(pts), strength=.38+.58*Math.max(familiarity,safety);
      const l=line(curve.getPoints(30),mat(i%2?p.crm2:p.crm,strength),crmGroup);l.userData={curve,strength,alt:i%2===1};
      crmRoutes.push(l);
      [pts[0],pts[2],pts[4]].forEach(pt=>glow(pt.x,pt.y,i%2?p.crm2:p.crm,crmGroup));
    });
    const acoBase=new THREE.Vector3(3.25,.95,0), destination=new THREE.Vector3(4.7,.95,0),acoRoutes=[];
    const candidateCount=q===1?3:q===2?4:5, preference=clamp((Number(t.familiarity)||0)*.55+(Number(t.historicalSafety)||0)*.45);
    for(let i=0;i<candidateCount;i++){
      const offset=(i-(candidateCount-1)/2)*.42, score=clamp(preference+(candidateCount-i)*.04,.1,.95);
      const pts=[acoBase.clone(),new THREE.Vector3(3.55,.95+offset,0),new THREE.Vector3(4.05,.35-offset*.5,0),destination.clone()];
      const curve=new THREE.CatmullRomCurve3(pts),l=line(curve.getPoints(24),mat(i===Math.round(candidateCount/2)?p.gold:p.rose,.22+.55*score),groups.aco);l.userData={curve,score};acoRoutes.push(l);
    }
    sphere(destination.x,destination.y,.14,p.gold,groups.aco);caption('destination',82,31);
    const links=[new THREE.Vector3(-1.5,.35,0),new THREE.Vector3(-.35,.35,0),new THREE.Vector3(3.2,.35,0)];
    line([new THREE.Vector3(stageX[3]+.25,stageY[3],0),links[0]],mat(p.gold,.38),groups.signals);
    line([links[0],links[1]],mat(p.gold,.38),groups.signals);line([links[1],new THREE.Vector3(routeStart.x,routeStart.y,0)],mat(p.crm,.38),groups.signals);
    line([new THREE.Vector3(2.6,-.8,0),links[2]],mat(p.crm,.38),groups.signals);line([links[2],acoBase],mat(p.gold,.38),groups.signals);
    const pulseCount=q===1?5:q===2?8:12,pulses=[];
    for(let i=0;i<pulseCount;i++){const n=sphere(0,0,.045,i%2?p.gold:p.ink,groups.signals);const path=crmRoutes.length&&i%2?crmRoutes[i%crmRoutes.length].userData.curve:null;n.userData={path,offset:i/pulseCount,kind:path?'crm':'pipeline'};pulses.push(n)}
    const ants=[],antCount=q===1?3:q===2?5:8;
    for(let i=0;i<antCount;i++){const n=sphere(0,0,.055,p.gold,groups.signals);n.userData={curve:acoRoutes[i%acoRoutes.length].userData.curve,offset:i/antCount};ants.push(n)}
    let raf=0,last=0,running=true,visible=true;
    function sync(){const np=palette();materials.forEach(m=>{if(m.color.equals(new THREE.Color(p.gold)))m.color.setHex(np.gold)});host.querySelectorAll('.research-title').forEach(el=>el.style.color=`#${np.gold.toString(16).padStart(6,'0')}`)}
    function frame(ms){if(!running)return;raf=requestAnimationFrame(frame);if(!visible||document.hidden)return;const interval=q===1?42:22;if(ms-last<interval)return;last=ms;const nt=telemetry(),speed=.00012+.00016*clamp(nt.familiarity);
      pulses.forEach((n,i)=>{const u=(ms*speed+n.userData.offset)%1;if(n.userData.path)n.position.copy(n.userData.path.getPointAt(u));else{const x=-4.1+u*3.2;n.position.set(x,stageY[Math.min(3,Math.floor(u*4))]+Math.sin(u*18+i)*.12,.1)}});
      ants.forEach((n,i)=>n.position.copy(n.userData.curve.getPointAt((ms*(.00018+.00012*clamp(nt.historicalSafety))+n.userData.offset)%1)));
      stageNodes.flat().forEach((n,i)=>{const pulse=1+.22*Math.max(0,Math.sin(ms*.004+i));n.scale.setScalar(pulse)});renderer.render(scene,camera);
    }
    function resize(){const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.updateProjectionMatrix()}
    addEventListener('resize',resize,{passive:true});addEventListener('navora:theme',sync);addEventListener('navora:research-telemetry',sync);
    const io='IntersectionObserver'in window?new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true},{threshold:.02}):null;io?.observe(host);frame(0);
    state={dispose(){running=false;cancelAnimationFrame(raf);io?.disconnect();removeEventListener('resize',resize);removeEventListener('navora:theme',sync);removeEventListener('navora:research-telemetry',sync);disposables.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();host.querySelectorAll('.research-label').forEach(e=>e.remove());state=null}};
  }
  document.readyState==='loading'?addEventListener('DOMContentLoaded',init,{once:true}):init();addEventListener('pagehide',()=>state?.dispose(),{once:true});
})();
