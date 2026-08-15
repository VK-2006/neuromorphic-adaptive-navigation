(function(){
  let state=null;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function quality(){if(reduced())return 0;const mem=navigator.deviceMemory||4;return innerWidth<700||mem<=2?1:mem<8?2:3}
  function palette(){return document.documentElement.dataset.theme==='dark'?{grid:0x2ED3A7,grid2:0x313F3A,route:0x2ED3A7,glow:0xD4935B,node:0xF4F7F5,hazard:0xFF6F73,dest:0x54E0BA,branch:0x168F76,branchAlt:0xD4935B}:{grid:0x087F68,grid2:0xCBD2CC,route:0x087F68,glow:0xB56332,node:0x18201D,hazard:0xC63E48,dest:0x056653,branch:0x247D70,branchAlt:0xB56332}}
  function init(){
    const host=document.getElementById('three-hero');if(!host||!window.THREE||state)return;
    const q=quality();if(!q){host.classList.add('p-webgl-fallback');return}
    let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:q>1,powerPreference:'high-performance'})}catch{host.classList.add('p-webgl-fallback');return}
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,host.clientWidth/Math.max(1,host.clientHeight),.1,90);camera.position.set(0,5.8,11.7);camera.lookAt(0,-.15,0);
    renderer.setPixelRatio(Math.min(devicePixelRatio,q===3?1.65:1.1));renderer.setSize(host.clientWidth,host.clientHeight,false);renderer.setClearColor(0x000000,0);host.prepend(renderer.domElement);
    const root=new THREE.Group();root.rotation.x=-.10;scene.add(root);
    const mats={};
    const buildMaterials=()=>{const p=palette();Object.entries(mats).forEach(([k,m])=>{if(!m)return;const c={grid:p.grid,grid2:p.grid2,route:p.route,glow:p.glow,node:p.node,hazard:p.hazard,dest:p.dest,branch:p.branch,branchAlt:p.branchAlt}[k];if(c!==undefined)m.color?.setHex(c)})};
    const p=palette();
    const grid=new THREE.GridHelper(18,32,p.grid,p.grid2);grid.position.y=-1.7;grid.material.transparent=true;grid.material.opacity=document.documentElement.dataset.theme==='dark'?.13:.09;root.add(grid);mats.grid=grid.material;
    const routeGroup=new THREE.Group();root.add(routeGroup);
    const mainPoints=[[-5.4,-.75,1.8],[-4.15,-.52,1.1],[-2.8,-.05,.72],[-1.4,.6,.3],[.05,.16,-.05],[1.55,.72,-.42],[2.9,.16,-.82],[4.15,.58,-1.2],[5.35,.15,-1.75]].map(v=>new THREE.Vector3(...v));
    const mainCurve=new THREE.CatmullRomCurve3(mainPoints);
    mats.route=new THREE.LineBasicMaterial({color:p.route,transparent:true,opacity:.96});mats.glow=new THREE.LineBasicMaterial({color:p.glow,transparent:true,opacity:.24});
    const mainLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(mainCurve.getPoints(120)),mats.route),glowLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(mainCurve.getPoints(120)),mats.glow);glowLine.scale.setScalar(1.009);routeGroup.add(mainLine,glowLine);
    const branchMats=[];const branchCount=q===1?10:q===2?16:22;for(let i=0;i<branchCount;i++){const z=(i%7-3)*.55,x0=-5.6+(i%4)*.31,pts=[];for(let j=0;j<8;j++)pts.push(new THREE.Vector3(x0+j*1.55,-1.2+Math.sin(i*.62+j*.9)*.21,z+Math.cos(i+j*.67)*.34));const m=new THREE.LineBasicMaterial({color:i%5===0?p.branchAlt:p.branch,transparent:true,opacity:i%5===0?.20:.11});branchMats.push({m,alt:i%5===0});routeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),m))}
    const nodeGeo=new THREE.SphereGeometry(.047,7,7);mats.node=new THREE.MeshBasicMaterial({color:p.node,transparent:true,opacity:.82});const nodes=new THREE.InstancedMesh(nodeGeo,mats.node,q===3?68:q===2?44:28),dummy=new THREE.Object3D();for(let i=0;i<nodes.count;i++){dummy.position.set((Math.random()-.5)*11,-1.26+Math.random()*2.5,(Math.random()-.5)*4.8);dummy.scale.setScalar(.65+Math.random()*1.05);dummy.updateMatrix();nodes.setMatrixAt(i,dummy.matrix)}root.add(nodes);
    mats.hazard=new THREE.MeshBasicMaterial({color:p.hazard,transparent:true,opacity:.78});const hazards=[],hazardGeo=new THREE.TorusGeometry(.13,.019,7,20);for(let i=0;i<(q===1?3:6);i++){const h=new THREE.Mesh(hazardGeo,mats.hazard.clone());h.rotation.x=Math.PI/2;h.position.set(-3.5+i*1.38,-.78+(i%2)*.38,1.25-i*.52);root.add(h);hazards.push(h)}
    const pulseMat=new THREE.MeshBasicMaterial({color:p.glow,transparent:true,opacity:.98}),pulse=new THREE.Mesh(new THREE.SphereGeometry(.09,10,10),pulseMat);root.add(pulse);
    mats.dest=new THREE.MeshBasicMaterial({color:p.dest,side:THREE.DoubleSide,transparent:true,opacity:.94});const destination=new THREE.Mesh(new THREE.RingGeometry(.15,.22,28),mats.dest);destination.rotation.x=-Math.PI/2;destination.position.copy(mainCurve.getPointAt(1));root.add(destination);
    const haloMat=new THREE.MeshBasicMaterial({color:p.glow,side:THREE.DoubleSide,transparent:true,opacity:.13});const halo=new THREE.Mesh(new THREE.RingGeometry(.35,.37,42),haloMat);halo.rotation.x=-Math.PI/2;halo.position.copy(destination.position);root.add(halo);
    let raf=0,last=0,running=true,visible=true,px=0,py=0;
    function syncTheme(){const np=palette();grid.material.color.setHex(np.grid);mats.route.color.setHex(np.route);mats.glow.color.setHex(np.glow);mats.node.color.setHex(np.node);mats.dest.color.setHex(np.dest);pulseMat.color.setHex(np.glow);haloMat.color.setHex(np.glow);hazards.forEach(h=>h.material.color.setHex(np.hazard));branchMats.forEach(x=>x.m.color.setHex(x.alt?np.branchAlt:np.branch))}
    addEventListener('navora:theme',syncTheme);
    function frame(t){if(!running)return;raf=requestAnimationFrame(frame);if(!visible||document.hidden)return;const minFrame=q===1?34:19;if(t-last<minFrame)return;last=t;const u=(t*.000062)%1;pulse.position.copy(mainCurve.getPointAt(u));const s=.92+.32*(.5+.5*Math.sin(t*.005));pulse.scale.setScalar(s);root.rotation.y=Math.sin(t*.00014)*.075+px*.085;root.rotation.x=-.10+py*.045;hazards.forEach((h,i)=>{const hs=1+Math.sin(t*.0032+i)*.19;h.scale.setScalar(hs);h.material.opacity=.52+.28*(.5+.5*Math.sin(t*.003+i))});destination.material.opacity=.65+.3*(.5+.5*Math.sin(t*.0024));halo.scale.setScalar(1+.16*(.5+.5*Math.sin(t*.0018)));halo.material.opacity=.07+.10*(.5+.5*Math.sin(t*.002));routeGroup.position.y=Math.sin(t*.0007)*.035;renderer.render(scene,camera)}
    function resize(){if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.02:q===3?1.65:1.1));renderer.setSize(host.clientWidth,host.clientHeight,false)}
    function move(e){if(!matchMedia('(pointer:fine)').matches)return;const r=host.getBoundingClientRect();px=(e.clientX-r.left)/r.width-.5;py=(e.clientY-r.top)/r.height-.5}
    addEventListener('resize',resize,{passive:true});host.addEventListener('pointermove',move,{passive:true});const io='IntersectionObserver'in window?new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true},{threshold:.03}):null;io?.observe(host);frame(0);
    state={dispose(){running=false;cancelAnimationFrame(raf);io?.disconnect();removeEventListener('resize',resize);removeEventListener('navora:theme',syncTheme);host.removeEventListener('pointermove',move);scene.traverse(o=>{o.geometry?.dispose?.();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{Object.values(m).forEach(v=>v?.isTexture&&v.dispose());m.dispose?.()})});renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();state=null}}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();addEventListener('pagehide',()=>state?.dispose(),{once:true});
})();
