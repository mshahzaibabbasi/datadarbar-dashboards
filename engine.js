/* =====================================================================
   DASHBOARD ENGINE  —  frozen, data-agnostic.  Do not edit per dataset.
   Consumes: CONFIG (config.js) and DATA (tidy rows).  Injected at build.
   ===================================================================== */
/* injected at build: */
__CONFIG__
__DATA__
__LOGO__

(function(){
"use strict";
const CFG = CONFIG;
/* Accept either data format:
   (a) tidy rows: [{period, path[], value, unit, flow}]
   (b) compact:   {periods:[...], series:[{path, unit, flow, v:[...aligned to periods]}]}
   Compact is ~20x smaller for large datasets; both normalize to `rows`. */
const rows = (function(){
  if(Array.isArray(DATA)) return DATA;                 // already tidy rows
  const out=[], P=DATA.periods||[];
  (DATA.series||[]).forEach(s=>{
    for(let i=0;i<P.length;i++){ const v=s.v[i];
      if(v!=null) out.push({period:P[i], path:s.path, value:v, unit:s.unit, flow:!!s.flow}); }
  });
  return out;
})();

/* ---------- brand tokens into CSS ---------- */
const R=document.documentElement.style;
R.setProperty('--primary',   CFG.brand.primary);
R.setProperty('--secondary', CFG.brand.secondary);
R.setProperty('--pos',       CFG.brand.posColor);
R.setProperty('--neg',       CFG.brand.negColor);
const col = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- colour ramp (mono primary+secondary) ---------- */
function hexToRgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t));}
function rgb(a){return`rgb(${a[0]},${a[1]},${a[2]})`;}
const P=hexToRgb(CFG.brand.primary),S=hexToRgb(CFG.brand.secondary),W=[255,255,255];
function ramp(n){const base=[P,S,mix(P,W,.35),mix(S,W,.3),mix(P,W,.6),mix(S,W,.55),mix(P,W,.18),mix(S,W,.15)];
  const out=[];for(let i=0;i<Math.max(1,n);i++)out.push(rgb(base[i%base.length]));return out;}

/* ---------- Chart.js defaults + cross ticks ---------- */
Chart.defaults.color='#000';
Chart.defaults.font.family=CFG.brand.font+", sans-serif";
Chart.register({id:'yCrossTicks',afterDraw(c){const y=c.scales.y;if(!y)return;const x=c.ctx,px=y.right;
  x.save();x.strokeStyle=col('--secondary');x.lineWidth=1;
  y.ticks.forEach(t=>{const yp=y.getPixelForValue(t.value);x.beginPath();x.moveTo(px,yp);x.lineTo(px+5,yp);x.stroke();});x.restore();}});

/* =====================================================================
   PERIODS  —  parse, native frequency, aggregation to the chosen freq
   ===================================================================== */
function parsePeriod(p){
  // "YYYY-MM" | "YYYY-Qn" | "YYYY"
  let m;
  if((m=/^(\d{4})-Q([1-4])$/.exec(p)))  return {y:+m[1], q:+m[2], m:(+m[2])*3, kind:'q'};
  if((m=/^(\d{4})-(\d{2})$/.exec(p)))   return {y:+m[1], m:+m[2], q:Math.ceil(+m[2]/3), kind:'m'};
  if((m=/^(\d{4})$/.exec(p)))           return {y:+m[1], m:12, q:4, kind:'y'};
  return null;
}
const ALLP = [...new Set(rows.map(r=>r.period))].map(p=>({p,d:parsePeriod(p)}))
              .filter(x=>x.d).sort((a,b)=> (a.d.y-b.d.y)||(a.d.m-b.d.m));
const NATIVE = CFG.nativeFrequency || (ALLP.length? ({m:'monthly',q:'quarterly',y:'annual'})[ALLP[0].d.kind] : 'monthly');

/* window clamp */
function inWindow(p){
  const d=parsePeriod(p); if(!d) return false;
  const key=d.y*12+d.m;
  if(CFG.windowStart){const s=parsePeriod(CFG.windowStart); if(key < s.y*12+s.m) return false;}
  if(CFG.windowEnd){const e=parsePeriod(CFG.windowEnd);   if(key > e.y*12+e.m) return false;}
  return true;
}
const PERIODS = ALLP.filter(x=>inWindow(x.p)).map(x=>x.p);

/* which frequency options are valid given native + config */
const FREQ_VALID = (()=>{
  const all=['monthly','quarterly','calendar_year','fiscal_year','ttm'];
  let opts = CFG.frequencyOptions || all.slice();
  // filter by native granularity
  opts = opts.filter(o=>{
    if(o==='monthly')   return NATIVE==='monthly';
    if(o==='quarterly') return NATIVE==='monthly'||NATIVE==='quarterly';
    return true; // CY/FY/TTM computable from any sub-annual; annual gets CY/FY
  });
  if(NATIVE==='annual') opts = opts.filter(o=>o==='calendar_year'||o==='fiscal_year');
  return opts;
})();

/* map every native period to its bucket key for a given frequency */
function bucketKey(period, freq){
  const d=parsePeriod(period);
  if(freq==='monthly')  return period;
  if(freq==='quarterly')return d.y+'-Q'+d.q;
  if(freq==='calendar_year') return ''+d.y;
  if(freq==='fiscal_year'){ const fye=CFG.fiscalYearEndMonth||12;
      const fy = d.m<=fye ? d.y : d.y+1; return 'FY'+String(fy).slice(2); }
  return period; // ttm handled separately
}
function bucketLabel(key, freq){
  if(freq==='monthly'){const d=parsePeriod(key);return MON[d.m-1]+'-'+String(d.y).slice(2);}
  if(freq==='quarterly'){const [y,q]=key.split('-Q');return q+'Q'+y.slice(2);}
  if(freq==='calendar_year')return key;
  if(freq==='fiscal_year')return key;
  return key;
}
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* =====================================================================
   SERIES TREE  —  build nested tree from row paths
   ===================================================================== */
const KEY = path => path.join(' / ');
const nodeIndex = new Map();   // key -> {path,key,unit,flow,parentKey,childrenKeys[]}
rows.forEach(r=>{
  const key=KEY(r.path);
  if(!nodeIndex.has(key)){
    nodeIndex.set(key,{path:r.path,key,unit:r.unit,flow:!!r.flow,
      parentKey: r.path.length>1?KEY(r.path.slice(0,-1)):null, childrenKeys:[]});
  }
});
// ensure ancestor nodes exist even if only leaves were provided
[...nodeIndex.values()].forEach(n=>{
  for(let i=1;i<n.path.length;i++){
    const anc=n.path.slice(0,i), k=KEY(anc);
    if(!nodeIndex.has(k)) nodeIndex.set(k,{path:anc,key:k,unit:n.unit,flow:n.flow,
      parentKey:i>1?KEY(anc.slice(0,-1)):null,childrenKeys:[]});
  }
});
// wire children
[...nodeIndex.values()].forEach(n=>{ if(n.parentKey && nodeIndex.has(n.parentKey))
  nodeIndex.get(n.parentKey).childrenKeys.push(n.key); });
const ROOTS = [...nodeIndex.values()].filter(n=>!n.parentKey).map(n=>n.key);
const nodeByKey = k => nodeIndex.get(k);
const label = k => nodeByKey(k).path[nodeByKey(k).path.length-1];

/* value lookup: key + native period */
const valMap = new Map();  // key||period -> value
rows.forEach(r=> valMap.set(KEY(r.path)+'||'+r.period, r.value));
function rawVal(key,period){ const v=valMap.get(key+'||'+period); return v==null?null:v; }

/* --- performance: precompute bucket membership + bucket order per freq (cached) --- */
const _bucketCache = {};   // freq -> {order:[bucketKeys], members:{bucketKey:[periods]}}
function bucketInfo(freq){
  if(_bucketCache[freq]) return _bucketCache[freq];
  const order=[], members={};
  PERIODS.forEach(p=>{ const b=bucketKey(p,freq);
    if(!(b in members)){ members[b]=[]; order.push(b); }
    members[b].push(p);
  });
  return (_bucketCache[freq]={order,members});
}

/* aggregated value for a node at a bucket, honoring stock/flow */
function aggVal(key, bucket, freq){
  const node=nodeByKey(key); if(!node) return null;
  const members = bucketInfo(freq).members[bucket];
  if(!members||!members.length) return null;
  if(node.flow){ let s=0,any=false; for(const p of members){const v=rawVal(key,p); if(v!=null){s+=v;any=true;}} return any?s:null; }
  for(let i=members.length-1;i>=0;i--){const v=rawVal(key,members[i]); if(v!=null)return v;}
  return null;
}
/* TTM: trailing 12 months (flows only). */
function ttmSeries(key){
  const node=nodeByKey(key); if(!node||!node.flow) return {labels:[],vals:[]};
  const span = NATIVE==='monthly'?12:(NATIVE==='quarterly'?4:1);
  const labels=[],vals=[];
  for(let i=span-1;i<PERIODS.length;i++){
    let s=0,any=false;
    for(let j=i-span+1;j<=i;j++){const v=rawVal(key,PERIODS[j]); if(v!=null){s+=v;any=true;}}
    labels.push(PERIODS[i]); vals.push(any?s:null);
  }
  return {labels,vals};
}

/* buckets (x-axis) for a frequency — uses cached order */
function bucketsFor(freq){
  if(freq==='ttm'){ const span=NATIVE==='monthly'?12:(NATIVE==='quarterly'?4:1);
    return {keys:PERIODS.slice(span-1), labeler:(k)=>bucketLabel(k,NATIVE)}; }
  return {keys:bucketInfo(freq).order.slice(), labeler:(k)=>bucketLabel(k,freq)};
}

/* value for key at a bucket under a frequency (handles ttm) */
function seriesValues(key, freq){
  if(freq==='ttm'){ return ttmSeries(key).vals; }
  const {keys}=bucketsFor(freq);
  return keys.map(b=>aggVal(key,b,freq));
}

/* =====================================================================
   SUMMABILITY  —  auto-infer from tree + validate + config override
   ===================================================================== */
const slash = k => k;  // paths already slash-joined via KEY? we used ' / '
function pathStr(key){ return nodeByKey(key).path.join('/'); }
const forceOff = new Set((CFG.summable.forceOff||[]));
const forceOn  = new Set((CFG.summable.forceOn||[]));

/* children of a node validate as summable if same unit-kind and (when a
   parent value exists) they sum ≈ parent for most periods. */
function childrenSummable(parentKey){
  const node=nodeByKey(parentKey); if(!node||!node.childrenKeys.length) return false;
  const ps=pathStr(parentKey);
  if(forceOff.has(ps)) return false;
  if(forceOn.has(ps)) return true;
  const kids=node.childrenKeys.map(nodeByKey);
  const unit0=kids[0].unit, kind0=CFG.UNITS[unit0]?.kind;
  if(kind0==='ratio') return false;                       // ratios never stack
  if(!kids.every(k=>k.unit===unit0)) return false;        // mixed units can't stack
  return true;
}
/* a SELECTION is summable if: all in one parent's direct children set,
   same unit, and that set is childrenSummable. */
function selectionSummable(sel){
  if(sel.length<1) return false;
  const parents=[...new Set(sel.map(k=>nodeByKey(k).parentKey))];
  if(parents.length!==1 || parents[0]==null) return false;
  const parent=parents[0];
  const units=[...new Set(sel.map(k=>nodeByKey(k).unit))];
  if(units.length!==1) return false;
  return childrenSummable(parent);
}
/* group total for %share = sum of the selected siblings' set's ALL children
   (actual child sum, internally consistent even if parent value differs) */
function siblingTotalAt(parentKey, bucket, freq){
  const node=nodeByKey(parentKey); let s=0,any=false;
  node.childrenKeys.forEach(k=>{const v= freq==='ttm'? null : aggVal(k,bucket,freq);
    if(v!=null){s+=v;any=true;}});
  return any?s:null;
}
/* guard: parent + its own descendant both selected -> block stack/share */
function hasAncestorDescendantPair(sel){
  for(const a of sel) for(const b of sel){ if(a===b) continue;
    if(b.startsWith(a+' / ')) return true; }
  return false;
}

/* =====================================================================
   UNITS / FORMAT
   ===================================================================== */
const unitOf = key => nodeByKey(key).unit;
const kindOf = key => CFG.UNITS[unitOf(key)]?.kind || 'money';
const isRatio = key => kindOf(key)==='ratio';
function fmt(v,unit){ if(v==null)return'—'; const u=CFG.UNITS[unit]||{};
  if(u.kind==='ratio') return (v).toFixed(2)+'%';          // ratios stored as percent already? see note
  return v.toLocaleString('en-US',{maximumFractionDigits:2}); }
function growth(cur,prev){ if(cur==null||prev==null||prev===0)return{t:'—',c:'flat'};
  const p=(cur-prev)/prev*100,c=p>0?'up':(p<0?'down':'flat');return{t:(p>0?'▲':p<0?'▼':'▬')+' '+Math.abs(p).toFixed(1)+'%',c};}
function ppChange(cur,prev){ if(cur==null||prev==null)return{t:'—',c:'flat'};
  const d=(cur-prev),c=d>0?'up':(d<0?'down':'flat');return{t:(d>0?'▲':d<0?'▼':'▬')+' '+Math.abs(d).toFixed(2)+' pp',c};}
function cagr(cur,first,years){ if(cur==null||first==null||first<=0||years<=0)return{t:'—',c:'flat'};
  const r=(Math.pow(cur/first,1/years)-1)*100,c=r>0?'up':(r<0?'down':'flat');return{t:(r>0?'▲':r<0?'▼':'▬')+' '+Math.abs(r).toFixed(1)+'%',c};}

/* =====================================================================
   STATE
   ===================================================================== */
let selected = (CFG.defaultSelection&&CFG.defaultSelection.length)
  ? CFG.defaultSelection.map(s=>s.replace(/\//g,' / ')).filter(k=>nodeByKey(k))
  : (ROOTS.length?[ROOTS[0]]:[]);
let view = CFG.defaultView||'abs';
let freq = FREQ_VALID.includes(NATIVE==='monthly'?'monthly':NATIVE==='quarterly'?'quarterly':'calendar_year')
  ? (NATIVE==='monthly'?'monthly':NATIVE==='quarterly'?'quarterly':'calendar_year')
  : FREQ_VALID[0];
let userSetView=false;
let chart=null;

/* eligibility incl. ttm (all selected must be flow) */
function ttmEligible(){ return selected.length>0 && selected.every(k=>nodeByKey(k).flow); }
function freqOptionsNow(){
  return FREQ_VALID.filter(o=> o!=='ttm' || ttmEligible());
}
function unitsOfSel(){ return [...new Set(selected.map(unitOf))]; }
function isCombo(){ return selected.length===2 && unitsOfSel().length>1; }
function canStackShare(){ return selectionSummable(selected) && !hasAncestorDescendantPair(selected); }
function effectiveView(){
  if(isCombo() && (view==='abs'||view==='stack'||view==='share')) return 'combo';
  if((view==='stack'||view==='share') && !canStackShare()) return unitsOfSel().length>1?'index':'abs';
  if(view==='abs' && unitsOfSel().length>1) return 'index';
  return view;
}
function autoDefaultView(){ if(userSetView)return;
  if(canStackShare()) view='stack'; else if(view==='stack'||view==='share') view='abs'; }

/* =====================================================================
   TRANSFORMS for chart
   ===================================================================== */
function transformed(key, ev, freqUse){
  const vals=seriesValues(key,freqUse);
  if(ev==='index'){ const base=vals.find(v=>v!=null); return base?vals.map(v=>v==null?null:v/base*100):vals; }
  if(ev==='share'){ const parent=nodeByKey(key).parentKey; const {keys}=bucketsFor(freqUse);
    return vals.map((v,i)=>{ if(v==null)return null; const tot=siblingTotalAt(parent,keys[i],freqUse); return tot?v/tot*100:null;}); }
  return vals;
}

/* =====================================================================
   SIDEBAR TREE
   ===================================================================== */
function buildSidebar(){
  const host=document.getElementById('optlist'); host.innerHTML='';
  function renderNode(key,depth){
    const n=nodeByKey(key);
    const row=document.createElement('label'); row.className='opt'; row.dataset.key=key;
    row.style.paddingLeft=(6+depth*14)+'px';
    const hasKids=n.childrenKeys.length>0;
    row.innerHTML=`<input type="checkbox" ${selected.includes(key)?'checked':''}>
      <span class="txt">${label(key)}</span>`;
    row.querySelector('input').addEventListener('change',e=>toggle(key,e.target.checked));
    host.appendChild(row);
    if(hasKids){
      // "stack all" affordance on summable parents
      if(childrenSummable(key)){
        const b=row.querySelector('.txt');
        const add=document.createElement('button'); add.className='addkids'; add.textContent='stack children';
        add.title='Select this group’s children';
        add.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();
          selected=n.childrenKeys.slice(); userSetView=false; autoDefaultView(); render();});
        row.appendChild(add);
      }
      n.childrenKeys.forEach(c=>renderNode(c,depth+1));
    }
  }
  ROOTS.forEach(r=>renderNode(r,0));
  syncSidebar();
}
/* search filter: show nodes whose label matches, plus their ancestors so
   the match stays reachable in the tree. Empty query shows everything. */
function filterTree(q){
  const opts=[...document.querySelectorAll('.opt')];
  if(!q){ opts.forEach(o=>o.classList.remove('hidden')); return; }
  const show=new Set();
  opts.forEach(o=>{
    const key=o.dataset.key;
    if(label(key).toLowerCase().includes(q)){
      // reveal this node and all ancestors
      const path=nodeByKey(key).path;
      for(let i=1;i<=path.length;i++) show.add(path.slice(0,i).join(' / '));
    }
  });
  opts.forEach(o=>o.classList.toggle('hidden', !show.has(o.dataset.key)));
}
function toggle(key,on){
  if(on){
    if(lineageBlocked(key)){ syncSidebar(); return; }   // can't pick a node in a selected lineage
    if(!selected.includes(key)) selected.push(key);
  }
  else selected=selected.filter(k=>k!==key);
  userSetView=false; autoDefaultView();
  // fix freq if ttm no longer eligible
  if(freq==='ttm' && !ttmEligible()) freq=freqOptionsNow()[0]||freq;
  render();
}
function isAncestorOrDescendant(a,b){
  // true if a is an ancestor of b or vice-versa (lineage conflict)
  return a===b || b.startsWith(a+' / ') || a.startsWith(b+' / ');
}
function lineageBlocked(key){
  // blocked if any currently-selected node shares a lineage (but isn't itself)
  return selected.some(s=> s!==key && isAncestorOrDescendant(s,key));
}
function syncSidebar(){  const colors=ramp(selected.length);
  document.querySelectorAll('.opt').forEach(o=>{
    const key=o.dataset.key, cb=o.querySelector('input'), on=selected.includes(key);
    cb.checked=on;
    const blocked = !on && lineageBlocked(key);
    cb.disabled=blocked; o.classList.toggle('disabled',blocked);
    let sw=o.querySelector('.sw');
    if(on){ if(!sw){sw=document.createElement('span');sw.className='sw';o.appendChild(sw);} sw.style.background=colors[selected.indexOf(key)]; }
    else if(sw) sw.remove();
  });
  document.getElementById('counter').textContent=`${selected.length} selected`;
}

/* =====================================================================
   CONTROLS: frequency + view
   ===================================================================== */
const FREQ_LABEL={monthly:'Monthly',quarterly:'Quarterly',calendar_year:'Calendar Yr',fiscal_year:'Fiscal Yr',ttm:'TTM'};
function buildFreqSeg(){
  const host=document.getElementById('freqSeg'); host.innerHTML='';
  FREQ_VALID.forEach(f=>{
    const b=document.createElement('button'); b.dataset.f=f; b.textContent=FREQ_LABEL[f];
    b.addEventListener('click',()=>{ if(b.disabled)return; freq=f; render(); });
    host.appendChild(b);
  });
}
function syncFreqSeg(){
  const now=freqOptionsNow();
  document.querySelectorAll('#freqSeg button').forEach(b=>{
    b.disabled=!now.includes(b.dataset.f);
    b.classList.toggle('active',b.dataset.f===freq);
  });
}
function buildViewSeg(){
  document.querySelectorAll('#viewSeg button').forEach(b=>{
    b.addEventListener('click',()=>{ if(b.disabled)return; view=b.dataset.v; userSetView=true; render(); });
  });
}
function syncViewSeg(){
  const ev=effectiveView(); const ss=canStackShare(), mixed=unitsOfSel().length>1, combo=isCombo();
  document.querySelectorAll('#viewSeg button').forEach(b=>b.classList.toggle('active',combo?(b.dataset.v==='abs'):(b.dataset.v===view)));
  document.querySelector('#viewSeg button[data-v="stack"]').disabled=!ss;
  document.querySelector('#viewSeg button[data-v="share"]').disabled=!ss;
  document.querySelector('#viewSeg button[data-v="abs"]').disabled=mixed&&!combo;
  return ev;
}

/* =====================================================================
   STATS
   ===================================================================== */
function renderStats(){
  const host=document.getElementById('stats'); host.innerHTML='';
  if(!selected.length) return;
  const colors=ramp(selected.length);
  const {keys}=bucketsFor(freq); const n=keys.length;
  const yearOfKey=k=>{ if(/^FY/.test(k))return 2000+ +k.slice(2); const d=parsePeriod(k)||parsePeriod(k+'-01');
    return d?d.y: (parseInt(k)||0); };
  selected.forEach((key,idx)=>{
    const vals=seriesValues(key,freq), u=unitOf(key), ratio=isRatio(key), c=colors[idx];
    let li=n-1; while(li>0&&vals[li]==null)li--; const latest=vals[li];
    const prev= li>0?vals[li-1]:null;
    const yStep= freq==='monthly'?12: freq==='quarterly'?4:1;
    const yi= li-yStep>=0?vals[li-yStep]:null;
    let fi=0; while(fi<li&&vals[fi]==null)fi++; const first=vals[fi];
    const years=Math.max(1,(yearOfKey(keys[li])||0)-(yearOfKey(keys[fi])||0));
    const pop= ratio?ppChange(latest,prev):growth(latest,prev);
    const yoy= ratio?ppChange(latest,yi):growth(latest,yi);
    const multi= ratio?ppChange(latest,first):cagr(latest,first,years);
    const multiLbl= ratio?`${years}Y Δ`:`${years}Y CAGR`;
    const popLbl= freq==='monthly'?'MoM': freq==='quarterly'?'QoQ':'YoY';
    const unitLabel=CFG.UNITS[u]?.label||'';
    const el=document.createElement('div'); el.className='stat'; el.style.setProperty('--barc',c);
    const cells= (freq==='calendar_year'||freq==='fiscal_year')
      ? `<div><span>YoY</span><span class="${yoy.c}">${yoy.t}</span></div><div><span>${multiLbl}</span><span class="${multi.c}">${multi.t}</span></div>`
      : `<div><span>${popLbl}</span><span class="${pop.c}">${pop.t}</span></div><div><span>YoY</span><span class="${yoy.c}">${yoy.t}</span></div><div><span>${multiLbl}</span><span class="${multi.c}">${multi.t}</span></div>`;
    el.innerHTML=`<div class="nm">${label(key)}</div>
      <div class="v">${fmt(latest,u)}${ratio?'':(unitLabel?'<span class="u">'+unitLabel+'</span>':'')}</div>
      <div class="row">${cells}</div>`;
    host.appendChild(el);
  });
}

/* =====================================================================
   CHART
   ===================================================================== */
function render(){
  const ev=syncViewSeg(); syncFreqSeg(); syncSidebar(); renderStats();
  const {keys,labeler}=bucketsFor(freq); const labels=keys.map(labeler);
  const empty=document.getElementById('emptyState');
  if(!selected.length){ empty.style.display='block';
    document.getElementById('chartTitle').textContent='Select an indicator to begin';
    document.getElementById('chartSub').textContent=''; if(chart){chart.destroy();chart=null;} return; }
  empty.style.display='none';
  const colors=ramp(selected.length), stacked=ev==='stack', combo=ev==='combo';
  const isMobile=window.innerWidth<=640;
  const tickFor=u=>{const kind=CFG.UNITS[u]?.kind; return v=>{ if(v==null||isNaN(v))return'';
    if(kind==='ratio')return Math.round(v)+'%'; return Math.round(v).toLocaleString('en-US'); };};

  const datasets=selected.map((key,idx)=>{
    const c=colors[idx];
    const ds={label:label(key),data:transformed(key,ev,freq),borderColor:c,
      backgroundColor:stacked?c.replace('rgb','rgba').replace(')',',0.55)'):c,
      borderWidth:stacked?1:2,tension:.3,pointRadius:0,pointHoverRadius:4,
      fill:stacked?(idx===0?'origin':'-1'):false,_unit:unitOf(key)};
    if(combo){ ds.yAxisID=idx===0?'y':'y1';
      if(idx===0){ds.type='bar';ds.backgroundColor=c;ds.borderWidth=0;ds.borderRadius=2;ds.categoryPercentage=.7;ds.barPercentage=.9;ds.order=2;}
      else{ds.type='line';ds.order=1;} }
    return ds;
  });

  const soleUnit=unitsOfSel()[0];
  const yFmt=(ev==='abs'||ev==='stack')?tickFor(soleUnit):(v=>(v==null||isNaN(v))?'':ev==='index'?Math.round(v):v+'%');
  const titleMap={abs:'Absolute values',stack:'Stacked area (sums to group total)',index:'Indexed to 100 at start',share:'% share within group',combo:'Combo — dual axis'};
  let note='';
  if(ev==='abs'||ev==='stack'){const f=CFG.UNITS[soleUnit]?.full; if(f)note=' · '+f;}
  else if(ev==='share')note=' · % of group total';
  else if(ev==='index')note=' · index, '+labels[0]+'=100';
  document.getElementById('chartTitle').textContent=selected.map(label).join(' · ');
  document.getElementById('chartSub').textContent=`${titleMap[ev]} · ${labels[0]} – ${labels[labels.length-1]}${note}`;

  const xTicks={maxRotation:isMobile?45:0,autoSkip:true,maxTicksLimit:isMobile?6:14,font:{size:isMobile?10:12}};
  const axisTitle=(idx,u)=>isMobile?(CFG.UNITS[u]?.label||''):label(selected[idx])+' ('+(CFG.UNITS[u]?.label||'')+')';
  let scales;
  if(combo){ const u0=unitOf(selected[0]),u1=unitOf(selected[1]);
    scales={x:{grid:{display:false,drawTicks:false},ticks:xTicks},
      y:{position:'left',beginAtZero:true,min:0,grid:{display:false,drawTicks:false},border:{display:true,color:col('--secondary')},
         title:{display:true,text:axisTitle(0,u0),color:colors[0],font:{size:isMobile?10:11}},ticks:{padding:isMobile?4:8,callback:tickFor(u0),font:{size:isMobile?10:12}}},
      y1:{position:'right',beginAtZero:true,min:0,grid:{display:false,drawTicks:false},border:{display:false},
         title:{display:true,text:axisTitle(1,u1),color:colors[1],font:{size:isMobile?10:11}},ticks:{padding:isMobile?4:6,callback:tickFor(u1),font:{size:isMobile?10:12}}}};
  } else { const magnitude=(ev==='abs'||ev==='stack');
    scales={x:{stacked,grid:{display:false,drawTicks:false},ticks:xTicks},
      y:{stacked,beginAtZero:magnitude,min:magnitude?0:undefined,grid:{display:false,drawTicks:false},border:{display:true,color:col('--secondary')},ticks:{padding:isMobile?4:8,callback:yFmt,font:{size:isMobile?10:12}}}};
  }
  if(chart)chart.destroy();
  chart=new Chart(document.getElementById('chart'),{type:combo?'bar':'line',data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:isMobile?'bottom':'top',labels:{boxWidth:isMobile?10:12,boxHeight:isMobile?10:12,padding:isMobile?10:16,font:{size:isMobile?11:12}}},
        tooltip:{callbacks:{label:c=>{const ds=c.dataset,raw=c.parsed.y;
          if(ev==='index')return `${ds.label}: ${raw==null?'—':raw.toFixed(1)} (=100)`;
          if(ev==='share')return `${ds.label}: ${raw==null?'—':raw.toFixed(1)}%`;
          const ul=CFG.UNITS[ds._unit]?.label||''; return `${ds.label}: ${fmt(raw,ds._unit)}${CFG.UNITS[ds._unit]?.kind==='ratio'?'':(ul?' '+ul:'')}`;}}}},
      scales}});
}

/* =====================================================================
   EXPORT + GATE + GA4
   ===================================================================== */
const logoImg=new Image(); if(LOGO_DATA_URI) logoImg.src=LOGO_DATA_URI;
function trackDownload(format){ try{ if(typeof gtag==='function') gtag('event','download',{
  format, series:selected.map(label).join(' | '), view:effectiveView(), frequency:freq }); }catch(e){} }
function exportPNG(){ if(!chart)return; trackDownload('png');
  const src=chart.canvas,pad=20,footH=52,out=document.createElement('canvas');
  out.width=src.width;out.height=src.height+footH;const x=out.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,out.width,out.height);x.drawImage(src,0,0);
  x.strokeStyle='#e6e6e6';x.lineWidth=1;x.beginPath();x.moveTo(pad,src.height+8);x.lineTo(out.width-pad,src.height+8);x.stroke();
  x.fillStyle='#999';x.font='12px '+CFG.brand.font+', sans-serif';x.textBaseline='middle';
  x.fillText(CFG.sourceNote,pad,src.height+8+footH/2);
  const save=()=>{ if(logoImg.complete&&logoImg.naturalWidth){const lh=28,lw=lh*(logoImg.naturalWidth/logoImg.naturalHeight);
    x.drawImage(logoImg,out.width-pad-lw,src.height+8+(footH-lh)/2,lw,lh);}
    const a=document.createElement('a');a.download='dashboard_'+freq+'.png';a.href=out.toDataURL('image/png');a.click(); };
  if(!LOGO_DATA_URI||logoImg.complete)save();else logoImg.onload=save;
}
function exportCSV(){ if(!selected.length)return; trackDownload('csv');
  const ev=effectiveView(),{keys,labeler}=bucketsFor(freq),labels=keys.map(labeler);
  const series=selected.map(k=>transformed(k,ev,freq));
  const suffix=ev==='index'?' (index=100)':ev==='share'?' (% share)':'';
  const meta=['# '+CFG.title+' — '+selected.map(label).join(' | '),
    '# View: '+ev+' | Frequency: '+FREQ_LABEL[freq]+' | '+labels[0]+'–'+labels[labels.length-1],
    '# Source: '+CFG.sourceNote,''];
  const head=['Period',...selected.map((k,i)=>label(k)+suffix)];
  const out=[...meta,head.join(',')];
  labels.forEach((lab,i)=>out.push([lab,...series.map(s=>s[i]==null?'':s[i])].join(',')));
  const blob=new Blob(["\ufeff"+out.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.download='dashboard_'+freq+'.csv';a.href=URL.createObjectURL(blob);a.click();
}
/* email gate */
let gateObserver=null,pendingExport=null,gatedMem=false;
const gateOn = ()=> CFG.gateDownloads && CFG.senderAccountId && CFG.senderFormId;
function sessionGated(){ try{return sessionStorage.getItem('dd_gate')==='1';}catch(e){return gatedMem;} }
function markGated(){ gatedMem=true; try{sessionStorage.setItem('dd_gate','1');}catch(e){} }
function runExport(k){ k==='png'?exportPNG():exportCSV(); }
function requestExport(k){ if(!gateOn()||sessionGated()){runExport(k);return;} pendingExport=k; openGate(); }
function openGate(){ document.getElementById('gateOverlay').style.display='flex'; watchSubmit(); }
function watchSubmit(){ if(gateObserver)return; const f=document.querySelector('.sender-form-field'); if(!f)return;
  const seen=f.textContent.trim();
  gateObserver=new MutationObserver(()=>{ const noForm=!f.querySelector('form')&&!f.querySelector('input[type=email]');
    const succ=/thank|success|subscrib|confirm|received/i.test(f.textContent);
    if((noForm&&f.textContent.trim().length>0&&f.textContent.trim()!==seen)||succ) onGateSuccess(); });
  gateObserver.observe(f,{childList:true,subtree:true,characterData:true});
}
function onGateSuccess(){ markGated(); if(gateObserver){gateObserver.disconnect();gateObserver=null;}
  const gc=document.getElementById('gateContinue'); if(gc){gc.disabled=false;}
  document.getElementById('gateOverlay').style.display='none';
  if(pendingExport){const k=pendingExport;pendingExport=null;runExport(k);} }
function cancelGate(){ document.getElementById('gateOverlay').style.display='none'; pendingExport=null;
  if(gateObserver){gateObserver.disconnect();gateObserver=null;} }

/* =====================================================================
   INIT
   ===================================================================== */
function init(){
  if(LOGO_DATA_URI){const l=document.getElementById('brandLogo'); if(l)l.src=LOGO_DATA_URI;}
  document.getElementById('appTitle').textContent=CFG.title;
  document.getElementById('appSub').textContent=CFG.subtitle;
  document.getElementById('footNote').textContent=CFG.sourceNote;
  buildSidebar(); buildFreqSeg(); buildViewSeg();
  const searchBox=document.getElementById('optsearch');
  if(searchBox) searchBox.addEventListener('input',()=>filterTree(searchBox.value.trim().toLowerCase()));
  document.getElementById('clear').addEventListener('click',()=>{selected=[];userSetView=false;render();});
  document.getElementById('pngBtn').addEventListener('click',()=>requestExport('png'));
  document.getElementById('csvBtn').addEventListener('click',()=>requestExport('csv'));
  const gc=document.getElementById('gateContinue'); if(gc)gc.addEventListener('click',cancelGate);
  const gcl=document.getElementById('gateClose'); if(gcl)gcl.addEventListener('click',cancelGate);
  const ov=document.getElementById('gateOverlay'); if(ov)ov.addEventListener('click',e=>{if(e.target.id==='gateOverlay')cancelGate();});
  const sb=document.getElementById('sidebar'),tog=document.getElementById('sidebarToggle');
  tog.addEventListener('click',()=>{ if(window.innerWidth<=640) sb.classList.toggle('collapsed'); });
  if(window.innerWidth<=640) sb.classList.add('collapsed');
  let wasM=window.innerWidth<=640,rt; window.addEventListener('resize',()=>{clearTimeout(rt);
    rt=setTimeout(()=>{const m=window.innerWidth<=640; if(m!==wasM){wasM=m;render();}},200);});
  render();
}
init();
})();
