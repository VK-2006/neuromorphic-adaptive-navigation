(function(){
 let state=null;const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function quality(){if(reduced())return 0;const m=navigator.deviceMemory||4;return innerWidth<700||m<=2?1:m<8?2:3}
 function palette(){return document.documentElement.dataset.theme==='dark'?{neural:0xc084fc,neural2:0xf6c453,memory:0x8b5cf6,memory2:0xf6c453,ants:0xffe8a3}:{neural:0x061b46,neural2:0x078f57,memory:0x0b2e68,memory2:0xff7a00,ants:0x078f57}}
 function telemetry(){return window.NavoraResearchTelemetry||{routeMemories:0,journeys:0,familiarity:0,historicalSafety:0,samples:[]}}
 async function init(){
  try{await window.NavoraResearchReady}catch{}
  const host=document.getElementById('three-research');if(!host||!window.THREE||state)return;const q=quality();if(!q){host.classList.add('p-webgl-fallback');return}
  let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:q>1,powerPreference:'high-performance'})}catch{host.classList.add('p-webgl-fallback');return}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(52,host.clientWidth/Math.max(1,host.clientHeight),.1,100);camera.position.set(0,2.45,8.5);
  renderer.setPixelRatio(Math.min(q===3?1.65:1.1,devicePixelRatio));renderer.setSize(host.clientWidth,host.clientHeight);renderer.setClearColor(0x000000,0);host.appendChild(renderer.domElement);
  const neural=new THREE.Group(),crm=new THREE.Group(),ants=[];scene.add(neural,crm);const p=palette(),t=telemetry();
  const neuronCount=Math.max(10,Math.min(q===3?32:q===2?22:12,10+Math.round((t.journeys||0)/2)));for(let i=0;i<neuronCount;i++){const m=new THREE.MeshBasicMaterial({color:i%4===0?p.neural2:p.neural,transparent:true,opacity:.88});const n=new THREE.Mesh(new THREE.SphereGeometry(.07,q===1?6:8,q===1?6:8),m);n.userData.alt=i%4===0;n.position.set(-2.75+(i%7)*.43,1.35-Math.floor(i/7)*.50,0);neural.add(n)}
  const samples=(t.samples||[]).length?t.samples:Array.from({length:Math.max(3,t.routeMemories||3)},()=>({familiarity:t.familiarity||0,safety:t.historicalSafety||0,journeys:0}));
  samples.slice(0,q===1?5:9).forEach((s,i)=>{const pts=Array.from({length:9},(_,j)=>new THREE.Vector3(-.95+j*.46,-1.02+i*.23,Math.sin(i+j*.8)*(.08+.22*(s.familiarity||0))));const m=new THREE.LineBasicMaterial({color:i%2?p.memory:p.memory2,transparent:true,opacity:.18+.7*Math.max(.05,s.safety||0)});m.userData={alt:i%2===0};crm.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),m))});
  const antCount=Math.max(4,Math.min(q===3?16:q===2?10:6,4+Math.round((t.routeMemories||0)/2)));for(let i=0;i<antCount;i++){const a=new THREE.Mesh(new THREE.SphereGeometry(.047,6,6),new THREE.MeshBasicMaterial({color:p.ants,transparent:true,opacity:.92}));a.position.set(-.7,-1+(i%5)*.28,0);scene.add(a);ants.push(a)}
  function sync(){const np=palette(),nt=telemetry();neural.children.forEach(n=>n.material.color.setHex(n.userData.alt?np.neural2:np.neural));crm.children.forEach((l,i)=>{l.material.color.setHex(l.material.userData.alt?np.memory2:np.memory);const sample=(nt.samples||[])[i];if(sample)l.material.opacity=.18+.7*Math.max(.05,Number(sample.safety)||0)});ants.forEach(a=>a.material.color.setHex(np.ants))}
  addEventListener('navora:theme',sync);addEventListener('navora:research-telemetry',sync);
  let raf=0,last=0,running=true,visible=true;
  function loop(ms){if(!running)return;raf=requestAnimationFrame(loop);if(!visible||document.hidden)return;const interval=q===1?42:22;if(ms-last<interval)return;last=ms;const nt=telemetry(),pulseGain=.22+.35*Math.max(0,Math.min(1,nt.historicalSafety||0)),antSpeed=.00028+.0003*Math.max(0,Math.min(1,nt.familiarity||0));neural.children.forEach((n,i)=>{const pulse=1+pulseGain*Math.max(0,Math.sin(ms*.006+i));n.scale.setScalar(pulse);n.material.opacity=.58+.34*(.5+.5*Math.sin(ms*.004+i*.7))});ants.forEach((a,i)=>{a.position.x=-.65+((ms*antSpeed+i*.105)%1)*3.8;a.position.z=Math.sin(ms*.0018+i)*.08});crm.rotation.y=Math.sin(ms*.0003)*.055;renderer.render(scene,camera)}
  function resize(){if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(innerWidth<700?1.02:q===3?1.65:1.1,devicePixelRatio));renderer.setSize(host.clientWidth,host.clientHeight,false)}
  addEventListener('resize',resize,{passive:true});const io='IntersectionObserver'in window?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true},{threshold:.02}):null;io?.observe(host);loop(0);
  state={dispose(){running=false;cancelAnimationFrame(raf);io?.disconnect();removeEventListener('resize',resize);removeEventListener('navora:theme',sync);removeEventListener('navora:research-telemetry',sync);scene.traverse(o=>{o.geometry?.dispose?.();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose?.())});renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();state=null}}
 }
 document.readyState==='loading'?addEventListener('DOMContentLoaded',init,{once:true}):init();addEventListener('pagehide',()=>state?.dispose(),{once:true});
})();
