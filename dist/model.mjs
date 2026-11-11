export const TYPES = {
  compute: { name:'计算流', color:'#e8f3ff', fill:'#c7e0ff', stroke:'#426c98', caption:'Compute' },
  communication: { name:'通信流', color:'#e9f7ed', fill:'#c5e8ce', stroke:'#487e57', caption:'Communication' },
  copy: { name:'拷贝流', color:'#fff7d9', fill:'#f5e6a6', stroke:'#9a7a27', caption:'Memory copy' }
};
export const SHAPES=['rect','rounded','ellipse','diamond','parallelogram','capsule'];
export const GAP=12, MIN_X=20, MIN_WIDTH=64;
export const uid=()=>globalThis.crypto.randomUUID();
export const clone=x=>structuredClone(x);
export function makeLane(type) {
  if(!Object.hasOwn(TYPES,type))throw Error('未知泳道类型');
  return {id:uid(),type,name:TYPES[type].name};
}
export function createDocument() {return {version:1,title:'未命名流程图',lanes:Object.keys(TYPES).map(makeLane),nodes:[],edges:[]};}
export function makeNode(shape,laneId,x=20,text='新建过程') {
  return {id:uid(),shape:SHAPES.includes(shape)?shape:'rect',laneId,x:Math.max(MIN_X,x),offsetY:80,width:152,text,align:'center',valign:'middle',fontSize:16,fill:'auto'};
}
export const laneNodes=(d,id)=>d.nodes.filter(n=>n.laneId===id).sort((a,b)=>a.x-b.x);
function pushRight(nodes) {
  let end=MIN_X-GAP;
  for(const n of nodes){n.x=Math.max(n.x,end+GAP);end=n.x+n.width;}
}
export function placeNode(d,id,laneId,x) {
  const n=d.nodes.find(n=>n.id===id);
  if(!n||!d.lanes.some(l=>l.id===laneId))return;
  x=Math.max(MIN_X,Math.min(50000,x));
  const oldLane=n.laneId, original=laneNodes(d,oldLane), oldIndex=original.indexOf(n);
  const others=laneNodes(d,laneId).filter(o=>o.id!==id);
  const index=others.filter(o=>o.x+o.width/2<x+n.width/2).length;
  const ordered=[...others.slice(0,index),n,...others.slice(index)];
  if(oldLane===laneId&&oldIndex!==index) {
    const slots=original.map(o=>o.x);
    ordered.forEach((o,i)=>{o.x=slots[i];});
  }
  n.laneId=laneId;n.x=x;
  // Clamp against the predecessor, push successors; inserting can never overlap.
  pushRight(ordered);
  return n;
}
export function nudgeNode(d,id,delta) {
  const n=d.nodes.find(n=>n.id===id);if(!n)return;
  const ns=laneNodes(d,n.laneId),i=ns.indexOf(n);
  const lo=i?ns[i-1].x+ns[i-1].width+GAP:MIN_X;
  const hi=i<ns.length-1?ns[i+1].x-n.width-GAP:50000;
  n.x=Math.max(lo,Math.min(hi,n.x+delta));
}
export function resizeNode(d,id,side,edge) {
  const n=d.nodes.find(n=>n.id===id);if(!n)return;
  const ns=laneNodes(d,n.laneId),i=ns.indexOf(n);
  if(side==='left'){
    const right=n.x+n.width;
    n.x=Math.max(i?ns[i-1].x+ns[i-1].width+GAP:MIN_X,Math.min(right-MIN_WIDTH,edge));
    n.width=right-n.x;
  }else{
    n.width=Math.max(MIN_WIDTH,Math.min(10000,edge-n.x));
    pushRight(ns);
  }
  return n;
}
export function addEdge(d,from,fromSide,to,toSide) {
  if(from===to||!d.nodes.some(n=>n.id===from)||!d.nodes.some(n=>n.id===to)||!['left','right'].includes(fromSide)||!['left','right'].includes(toSide))return null;
  if(d.edges.some(e=>e.from===from&&e.to===to))return null;
  const reaches=(id,seen=new Set())=>{if(id===from)return true;if(seen.has(id))return false;seen.add(id);return d.edges.filter(e=>e.from===id).some(e=>reaches(e.to,seen));};
  if(reaches(to))return null;
  const e={id:uid(),from,to,fromSide,toSide};d.edges.push(e);return e;
}
export function duplicateLane(d,id,payload) {
  const original=d.lanes.find(l=>l.id===id),source=payload||{lane:original,nodes:d.nodes.filter(n=>n.laneId===id),edges:d.edges};
  if(!source.lane)return;
  const lane={...clone(source.lane),id:uid(),name:source.lane.name.slice(0,117)+' 副本'};
  const map=new Map(),nodes=source.nodes.map(n=>{const fresh={...clone(n),id:uid(),laneId:lane.id};map.set(n.id,fresh.id);return fresh;});
  const edges=source.edges.filter(e=>map.has(e.from)&&map.has(e.to)).map(e=>({...clone(e),id:uid(),from:map.get(e.from),to:map.get(e.to)}));
  const index=d.lanes.findIndex(l=>l.id===id);
  d.lanes.splice(index<0?d.lanes.length:index+1,0,lane);d.nodes.push(...nodes);d.edges.push(...edges);return lane;
}
export function deleteSelection(d,s) {
  if(!s)return;
  if(s.kind==='edge')d.edges=d.edges.filter(e=>e.id!==s.id);
  if(s.kind==='lane'){d.lanes=d.lanes.filter(l=>l.id!==s.id);d.nodes=d.nodes.filter(n=>n.laneId!==s.id);}
  if(s.kind==='node')d.nodes=d.nodes.filter(n=>n.id!==s.id);
  const ids=new Set(d.nodes.map(n=>n.id));d.edges=d.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
}
export function validateDocument(input) {
  const fail=()=>{throw Error('流程文件格式不正确，请选择本工具导出的 JSON 文件。');};
  if(!input||input.version!==1||typeof input.title!=='string'||input.title.length>200||!Array.isArray(input.lanes)||!Array.isArray(input.nodes)||!Array.isArray(input.edges)||input.lanes.length>100||input.nodes.length>3000||input.edges.length>6000)fail();
  const d=clone(input),all=new Set();
  const take=id=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(id)||all.has(id))fail();all.add(id);};
  for(const l of d.lanes){take(l.id);if(!Object.hasOwn(TYPES,l.type)||typeof l.name!=='string'||l.name.length>120)fail();}
  const lanes=new Set(d.lanes.map(l=>l.id));
  for(const n of d.nodes) {
    take(n.id);
    n.offsetY??=80;
    if(!Number.isFinite(n.offsetY)||n.offsetY<32||n.offsetY>120)fail();
    if(!lanes.has(n.laneId)||!SHAPES.includes(n.shape)||!Number.isFinite(n.x)||n.x<MIN_X||n.x>1000000||!Number.isFinite(n.width)||n.width<MIN_WIDTH||n.width>1000000||typeof n.text!=='string'||n.text.length>4000||!['left','center','right'].includes(n.align)||!['top','middle','bottom'].includes(n.valign)||!Number.isFinite(n.fontSize)||n.fontSize<10||n.fontSize>40||!(n.fill==='auto'||/^#[0-9a-f]{6}$/i.test(n.fill)))fail();
  }
  for(const l of d.lanes){const ns=laneNodes(d,l.id);for(let i=1;i<ns.length;i++)if(ns[i].x<ns[i-1].x+ns[i-1].width+GAP-0.01)fail();}
  const edges=d.edges;d.edges=[];
  for(const e of edges){take(e.id);if(!addEdge(d,e.from,e.fromSide,e.to,e.toSide))fail();d.edges.at(-1).id=e.id;}
  // Only known properties are retained, so imports cannot inject UI or executable markup.
  return {version:1,title:d.title,lanes:d.lanes.map(({id,type,name})=>({id,type,name})),nodes:d.nodes.map(({id,shape,laneId,x,offsetY,width,text,align,valign,fontSize,fill})=>({id,shape,laneId,x,offsetY,width,text,align,valign,fontSize,fill})),edges:d.edges};
}
