// Прицел мастера. Только локальные объекты: до подтверждения ничего не рассылается игрокам.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { DPI, V, circle, line, poly } from "./engine.js";
import { NS, PAL } from "./const.js";

const TOOL = NS + '/pick', MODE = TOOL + '/mode', OK = TOOL + '/ok', ICON = '/owlbear-dnd/emergence/icon.svg';
const note = msg => OBR.notification.show(msg).catch(() => {});
const right = e => e?.button === 2 || e?.buttons === 2 || e?.nativeEvent?.button === 2;
const xy = p => ({ x:p.x, y:p.y });
let session = null, queue = Promise.resolve(), generation = 0;
function serial(fn) { const p = queue.then(fn); queue = p.catch(() => {}); return p; }
export const picking = () => !!session;
function finish(s, result, restore = true) {
  if (!s || s.closed) return;
  s.closed = true; s.result = result;
  serial(async () => {
    try {
      if (s.off) s.off(); clearTimeout(s.timer);
      await s.drawing;
      if (s.items.length) await OBR.scene.local.deleteItems(s.items.map(i => i.id)).catch(() => {});
      if (restore && s.prev && s.prev !== TOOL && await OBR.tool.getActiveTool().catch(() => null) === TOOL)
        await OBR.tool.activateTool(s.prev).catch(() => {});
      if (s.action) await OBR.tool.removeAction(OK).catch(() => {});
      if (s.mode) await OBR.tool.removeMode(MODE).catch(() => {});
      if (s.tool) await OBR.tool.remove(TOOL).catch(() => {});
    } finally { if (session === s) session = null; s.done(s.result); }
  });
}
export function cancelPick() { ++generation; finish(session, null); return queue; }

function allowed(s,it) {
  return !s.exclude.has(it.id) && (s.hidden || it.visible !== false) &&
    (['CHARACTER','MOUNT'].includes(it.layer) || s.extra.has(it.id) ||
    (s.props && it.type === 'IMAGE' && ['PROP','ATTACHMENT'].includes(it.layer)));
}
async function refresh(s, list) {
  const ticket = ++s.refresh;
  const items = (list || await OBR.scene.items.getItems()).filter(it => allowed(s,it));
  const tokens = [];
  for (let i=0; i<items.length && !s.closed && s.refresh===ticket; i+=12) {
    const group = await Promise.all(items.slice(i,i+12).map(async it => {
      try { const b = await OBR.scene.items.getItemBounds([it.id]); return {id:it.id, ...xy(b.center), r:Math.max(b.width,b.height)/2}; } catch {return null;}
    }));
    tokens.push(...group.filter(Boolean));
  }
  if (!s.closed && s.refresh===ticket) { s.toks = new Map(tokens.map(t => [t.id,t])); if (s.last) move(s,s.last); }
}
function hover(s,e) {
  if (s.toks.has(e.target?.id)) return s.toks.get(e.target.id);
  let best, dist=Infinity;
  for (const t of s.toks.values()) { const d=V.dist(t,e.pointerPosition); if (d <= t.r && d < dist) {best=t;dist=d;} }
  return best;
}
// Размер и начало конуса совпадают с FX.wave. Включаем цель, если её центр в секторе.
function wedge(s,p) {
  const a=V.ang(s.from,p), o=V.pol(s.from,s.from.r*.55,a), pts=[o], inside=[];
  for (let i=0;i<=24;i++) pts.push(V.pol(o,s.cone,a-.4636+.9272*i/24));
  for (const t of s.toks.values()) { const d=V.ang(o,t)-a; if (V.dist(o,t)<=s.cone && Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<=.4636) inside.push(t); }
  return {pts,inside,aim:xy(p)};
}
function build(s) {
  const color=PAL.cy2, base={stroke:color,so:0,sw:DPI*.035,fill:color,fo:0};
  s.ret=circle({...base,r:DPI*.5,n:36}); s.ray=line({stroke:color,so:0,sw:DPI*.026,dash:[DPI*.13,DPI*.08]});
  s.items.push(s.ray,s.ret);
  if (s.limit && s.from) s.items.push(circle({...base,...xy(s.from),r:s.limit,so:.34,fo:.025,dash:[DPI*.15,DPI*.10]}));
  if (s.cone) {
    s.area=poly({...base}); s.items.unshift(s.area);
    for(const t of s.toks.values()) {const ring=circle({...base,...xy(t),r:t.r*1.12});s.rings.set(ring.id,t.id);s.items.push(ring);}
  }
  for(let i=1;i<s.n;i++) { const it=circle({...base,r:DPI*.22,stroke:PAL.white});s.pins.push(it);s.items.push(it); }
  for(const it of s.items) it.name='⌖ emergence';
}
function dest(s,e) {
  const raw=e.pointerPosition, tok=s.snap && hover(s,e);
  let p=tok?xy(tok):xy(raw);
  if (s.limit && V.dist(s.from,p)>s.limit) p=V.pol(s.from,s.limit,V.ang(s.from,p));
  return {p,tok};
}
function move(s,e) {
  if(s.closed || !e?.pointerPosition) return;
  s.last=e; s.pending=e;
  if(s.drawing) return;
  s.drawing=(async()=>{
    while(s.pending && !s.closed) {
      const ev=s.pending; s.pending=null;
      const {p,tok}=dest(s,ev), g=s.cone && (s.lock || wedge(s,ev.pointerPosition));
      const lit=new Map(g?g.inside.map(t=>[t.id,t]):[]), start=s.pts.at(-1)||s.from;
      const ids=[s.ret.id,s.ray.id,...s.pins.map(it=>it.id)];
      if(g) ids.push(s.area.id,...s.rings.keys());
      await OBR.scene.local.updateItems(ids,ds=>{for(const d of ds){
        if(d.id===s.ret.id){const k=tok?Math.max(.12,2.18*tok.r/DPI):.48; d.scale={x:k,y:k};d.position=p; d.style.strokeWidth=DPI*.035/k; d.style.strokeOpacity=(tok || !s.tokenOnly) ? .95 : .35;d.style.fillOpacity=.08;}
        else if(d.id===s.ray.id){d.style.strokeOpacity=(start && !g) ? .58 : 0;if(start)d.points=[xy(start),p];}
        else if(d.id===s.area?.id){d.points=g.pts;d.style.fillOpacity=.12;d.style.strokeOpacity=.85;}
        else if(s.rings.has(d.id)){const id=s.rings.get(d.id), t=lit.get(id);d.style.strokeOpacity=t ? .96 : 0;d.style.fillOpacity=t ? .18 : 0;if(t){d.position=xy(t);d.style.strokeColor=d.style.fillColor=s.saved.has(id)?'#5CE6A1':'#FF9075';}}
        else {const pt=s.pts[s.pins.findIndex(it=>it.id===d.id)];if(pt)d.position=xy(pt);d.style.strokeOpacity=pt ? .9 : 0;}
      }});
    }
  })().catch(e=>{if(!s.closed)console.warn('[emergence] preview',e);}).finally(()=>{s.drawing=null;if(s.pending&&!s.closed)move(s,s.pending);});
}
function confirmCone(s) {
  if(s.closed || !s.lock)return;
  finish(s,[{...s.lock.aim,targets:s.lock.inside.map(t=>t.id),res:Object.fromEntries([...s.saved].map(id=>[id,'ok']))}]);
}
function click(s,e) {
  if(s.closed || !e?.pointerPosition)return false;
  if(right(e)){finish(s,null);return false;}
  if(s.cone) {
    if(!s.lock){s.lock=wedge(s,e.pointerPosition); if(!s.lock.inside.length){confirmCone(s);return false;}
      note(`В конусе: ${s.lock.inside.length}. Клик по цели — успех/провал; Enter или клик по пустому месту — удар; Esc — отмена.`);
    } else {const t=hover(s,e); if(!t){confirmCone(s);return false;} if(s.lock.inside.some(i=>i.id===t.id)) {if(s.saved.has(t.id))s.saved.delete(t.id);else s.saved.add(t.id);} }
  } else {
    const {p,tok}=dest(s,e);
    if(s.tokenOnly&&!tok){note('Укажи токен с подсветкой. Esc — отмена.');return false;}
    s.pts.push({...p,tok:tok?.id||null});
    if(s.pts.length>=s.n){finish(s,s.pts);return false;}
    hint(s);
  }
  move(s,e);return false;
}
function hint(s){note(`🎯 ${s.labels[s.pts.length] || 'Укажи точку'}${s.n>1?` · ${s.pts.length+1}/${s.n}`:''} · Esc — отмена`);}
export function pickPoints({n=1,labels=[],snap=true,tokenOnly=false,from=null,limit=0,cone=0,exclude=[],extra=[],props=false,hidden=false}={}) {
  const gen=++generation;finish(session,null);
  return new Promise(done=>{serial(async()=>{
    if(gen!==generation){done(null);return;}
    const s=session={done,n,labels,snap,tokenOnly,from,limit,cone,exclude:new Set(exclude),extra:new Set(extra),props,hidden,
      pts:[],pins:[],items:[],toks:new Map(),rings:new Map(),saved:new Set(),refresh:0};
    try {
      if(snap || cone) await refresh(s);
      if(s.closed)return;
      if(tokenOnly&&!s.toks.size){note('Нет подходящих токенов на сцене.');finish(s,null);return;}
      build(s); await OBR.scene.local.addItems(s.items); if(s.closed)return;
      s.prev=await OBR.tool.getActiveTool();
      await OBR.tool.create({id:TOOL,icons:[{icon:ICON,label:'Прицел Эмерджентности'}],defaultMode:MODE});s.tool=true;
      await OBR.tool.createMode({id:MODE,icons:[{icon:ICON,label:'Наведение',filter:{activeTools:[TOOL]}}],cursors:[{cursor:'crosshair'}],
        onToolMove:(_,ev)=>move(s,ev),onToolClick:(_,ev)=>click(s,ev),onToolDoubleClick:()=>false,
        onToolDown:(_,ev)=>{if(right(ev))finish(s,null);},onDeactivate:()=>finish(s,null,false),
        onKeyDown:(_,ev)=>{if(ev.key==='Escape')finish(s,null);else if(ev.key==='Enter')confirmCone(s);else if(ev.key==='Backspace'&&!s.closed){if(s.lock){s.lock=null;s.saved.clear();}else s.pts.pop();hint(s);if(s.last)move(s,s.last);}},
      });s.mode=true;
      if(s.cone){await OBR.tool.createAction({id:OK,icons:[{icon:ICON,label:'Подтвердить волну (после выбора направления)',filter:{activeTools:[TOOL]}}],onClick:()=>confirmCone(s)});s.action=true;}
      if(s.closed)return;
      await OBR.tool.activateTool(TOOL);
      await OBR.tool.activateMode(TOOL,MODE);
      if(s.closed)return;
      // Для одиночных целей следим за перемещениями; конус фиксирует снимок для распределения спасбросков.
      if(snap&&!cone)s.off=OBR.scene.items.onChange(list=>{clearTimeout(s.timer);s.timer=setTimeout(()=>refresh(s,list).catch(console.warn),80);});
      await OBR.action.close().catch(()=>{}); if(!s.closed)hint(s);
    } catch(e){ console.warn('[emergence] aim',e);note('Не удалось включить прицел. Можно выбрать режим «Выделение» в панели.');finish(s,null); }
  });});
}
