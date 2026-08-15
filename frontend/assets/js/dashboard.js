import{api,toast}from'./api.js';

const byId=id=>document.getElementById(id);
const list=v=>Array.isArray(v)?v:[];
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
let chart=null;

function set(id,v){const el=byId(id);if(el)el.textContent=v}
function renderList(id,arr,fn){
  const h=byId(id);if(!h)return;
  const rows=list(arr);
  h.innerHTML=rows.length?rows.map(x=>`<div class="data-row">${fn(x||{})}</div>`).join(''):'<div class="empty-state">No stored data yet.</div>';
}

function chartTheme(){
  const s=getComputedStyle(document.documentElement);
  return{
    primary:s.getPropertyValue('--ui-primary').trim()||'#6E3B6E',
    gold:s.getPropertyValue('--ui-premium').trim()||'#B58A32',
    text:s.getPropertyValue('--ui-text-secondary').trim()||'#625861',
    grid:s.getPropertyValue('--ui-border-subtle').trim()||'rgba(110,59,110,.14)',
    surface:s.getPropertyValue('--ui-surface-primary').trim()||'#FFFDFC'
  };
}

function buildChart(canvas,trend){
  if(!window.Chart||!canvas||!trend.length)return null;
  chart?.destroy?.();
  const c=chartTheme();
  chart=new window.Chart(canvas,{
    type:'line',
    data:{
      labels:trend.map(x=>x?.label||''),
      datasets:[{
        label:'Historical safety',
        data:trend.map(x=>num(x?.safety)),
        tension:.38,
        fill:true,
        borderColor:c.primary,
        backgroundColor:ctx=>{
          const area=ctx.chart.chartArea;
          if(!area)return'rgba(110,59,110,.06)';
          const g=ctx.chart.ctx.createLinearGradient(0,area.top,0,area.bottom);
          g.addColorStop(0,c.primary+'33');
          g.addColorStop(.72,c.gold+'12');
          g.addColorStop(1,'transparent');
          return g;
        },
        pointBackgroundColor:c.gold,
        pointBorderColor:c.surface,
        pointBorderWidth:2,
        pointRadius:3,
        pointHoverRadius:5,
        borderWidth:2.5
      }]
    },
    options:{
      responsive:true,
      animation:{duration:650,easing:'easeOutQuart'},
      plugins:{
        legend:{display:true,labels:{color:c.text,usePointStyle:true,boxWidth:8}}
      },
      scales:{
        x:{ticks:{color:c.text},grid:{color:c.grid}},
        y:{min:0,max:100,ticks:{color:c.text},grid:{color:c.grid}}
      }
    }
  });
  return chart;
}

async function load(){
  try{
    const d=(await api('/users/dashboard'))||{},m=d.metrics||{},trend=list(d.trend);
    set('metric-safety',m.safetyTrend==null?'—':`${Math.round(num(m.safetyTrend))}%`);
    set('metric-memory',Math.max(0,num(m.routeMemories)));
    set('metric-success',Math.max(0,num(m.successfulJourneys)));
    set('metric-avoided',Math.max(0,num(m.verifiedHazardsAvoided)));
    set('metric-unread',Math.max(0,num(m.unreadNotifications)));
    renderList('recent-journeys',d.recentJourneys,j=>`<strong>${String(j.status||'Unknown')}</strong><div class="muted">${String(j.mode||'—')} · ${(num(j.distanceCovered)/1000).toFixed(1)} km covered · ${j.createdAt?new Date(j.createdAt).toLocaleDateString():'—'}</div>`);
    renderList('recent-memories',d.recentMemories,r=>`<strong>Familiarity ${Math.round(num(r.familiarity)*100)}%</strong><div class="muted">Journeys ${Math.max(0,num(r.journeyCount))} · historical safety ${Math.round(num(r.historicalSafety)*100)}%</div>`);
    const canvas=byId('safety-chart'),empty=byId('trend-empty');
    if(window.Chart&&canvas&&trend.length){
      try{buildChart(canvas,trend);empty?.classList.add('hidden')}
      catch(e){empty?.classList.remove('hidden');toast(`Chart unavailable: ${e.message}`,'warning')}
    }else empty?.classList.remove('hidden');
  }catch(e){
    ['metric-safety','metric-memory','metric-success','metric-avoided','metric-unread'].forEach(id=>set(id,'—'));
    toast(e.message,'error');
  }
}

addEventListener('navora:theme',()=>{
  if(!chart)return;
  const c=chartTheme();
  chart.data.datasets[0].borderColor=c.primary;
  chart.data.datasets[0].pointBackgroundColor=c.gold;
  chart.data.datasets[0].pointBorderColor=c.surface;
  chart.options.plugins.legend.labels.color=c.text;
  chart.options.scales.x.ticks.color=c.text;
  chart.options.scales.y.ticks.color=c.text;
  chart.options.scales.x.grid.color=c.grid;
  chart.options.scales.y.grid.color=c.grid;
  chart.update('none');
});

load();
