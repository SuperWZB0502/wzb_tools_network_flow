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
export function createStarterDocument() {
  const d=createDocument(),a=makeNode('rect',d.lanes[0].id,40,'计算过程'),b=makeNode('rounded',d.lanes[2].id,330,'拷贝过程'),c=makeNode('rect',d.lanes[1].id,620,'通信过程');
  a.width=180;b.width=112;d.nodes.push(a,b,c);addEdge(d,a.id,'right',b.id,'left');addEdge(d,b.id,'right',c.id,'left');return d;
}
export function makeNode(shape,laneId,x=20,text='新建过程') {
  return {id:uid(),shape:SHAPES.includes(shape)?shape:'rect',laneId,x:Math.max(MIN_X,x),offsetY:80,width:152,text,align:'center',valign:'middle',fontSize:16,fill:'auto'};
}
export const laneNodes=(d,id)=>d.nodes.filter(n=>n.laneId===id).sort((a,b)=>a.x-b.x);
function pushRight(nodes) {
  let end=MIN_X-GAP;
  for(const n of nodes){n.x=Math.max(n.x,end+GAP);end=n.x+n.width;}
}
export function enforceDependencies(d,{gap=GAP,maxX=1000000}={}) {
  if(!d.edges.length)return d;
  const nodes=new Map(d.nodes.map(n=>[n.id,n])),incoming=new Map(d.nodes.map(n=>[n.id,[]])),state=new Map(),order=[];
  for(const e of d.edges)if(nodes.has(e.from)&&nodes.has(e.to))incoming.get(e.to).push(nodes.get(e.from));
  // Visit predecessors first, retaining the requested horizontal order wherever possible.
  // Lane order follows this topological order, so a reverse-time connection cannot
  // create a deadlock between dependency constraints and same-lane ordering.
  for(const start of [...d.nodes].sort((a,b)=>a.x-b.x)){
    if(state.get(start.id)===2)continue;
    const stack=[{node:start,index:0}];state.set(start.id,1);
    while(stack.length){const frame=stack.at(-1),parents=incoming.get(frame.node.id);
      if(frame.index<parents.length){const parent=parents[frame.index++],mark=state.get(parent.id);if(mark===1)throw Error('依赖不能形成循环。');if(mark!==2){state.set(parent.id,1);stack.push({node:parent,index:0});}}
      else{state.set(frame.node.id,2);order.push(frame.node);stack.pop();}
    }
  }
  const positions=new Map(),laneEnd=new Map();
  for(const n of order){let x=Math.max(MIN_X,n.x,laneEnd.get(n.laneId)??MIN_X);for(const p of incoming.get(n.id))x=Math.max(x,positions.get(p.id)+p.width+gap);if(!Number.isFinite(x)||x>maxX)throw Error('依赖链超出画板范围。');positions.set(n.id,x);laneEnd.set(n.laneId,x+n.width+gap);}
  for(const n of d.nodes)n.x=positions.get(n.id);
  return d;
}
function scheduledEdit(d,edit,settle=true){
  if(!settle||!d.edges.length)return edit();
  const original=d.nodes,snapshot=original.map(n=>({node:n,x:n.x,width:n.width,laneId:n.laneId,offsetY:n.offsetY}));
  try{const result=edit();enforceDependencies(d);return result;}catch(error){d.nodes=original;for(const {node,...geometry}of snapshot)Object.assign(node,geometry);throw error;}
}
export function placeNode(d,id,laneId,x,settle=true){return scheduledEdit(d,()=>place(d,id,laneId,x),settle);}
function place(d,id,laneId,x) {
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
export function nudgeNode(d,id,delta){return scheduledEdit(d,()=>nudge(d,id,delta));}
function nudge(d,id,delta) {
  const n=d.nodes.find(n=>n.id===id);if(!n)return;
  const ns=laneNodes(d,n.laneId),i=ns.indexOf(n);
  const lo=i?ns[i-1].x+ns[i-1].width+GAP:MIN_X;
  const hi=i<ns.length-1?ns[i+1].x-n.width-GAP:50000;
  n.x=Math.max(lo,Math.min(hi,n.x+delta));
}
export function resizeNode(d,id,side,edge){return scheduledEdit(d,()=>resize(d,id,side,edge));}
function resize(d,id,side,edge) {
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
export function addEdge(d,from,fromSide,to,toSide,settle=true) {
  if(from===to||!d.nodes.some(n=>n.id===from)||!d.nodes.some(n=>n.id===to)||!['left','right'].includes(fromSide)||!['left','right'].includes(toSide))return null;
  if(d.edges.some(e=>e.from===from&&e.to===to))return null;
  const reaches=(id,seen=new Set())=>{if(id===from)return true;if(seen.has(id))return false;seen.add(id);return d.edges.filter(e=>e.from===id).some(e=>reaches(e.to,seen));};
  if(reaches(to))return null;
  const e={id:uid(),from,to,fromSide,toSide};d.edges.push(e);if(settle){try{enforceDependencies(d);}catch{d.edges.pop();return null;}}return e;
}
export function reconnectEdge(d,id,end,nodeId,side){
  const original=d.edges.find(e=>e.id===id);if(!original||!['from','to'].includes(end))return false;
  const previous=d.edges;d.edges=previous.filter(e=>e.id!==id);
  const edge=addEdge(d,end==='from'?nodeId:original.from,end==='from'?side:original.fromSide,end==='to'?nodeId:original.to,end==='to'?side:original.toSide);
  if(!edge){d.edges=previous;return false;}
  edge.id=id;d.edges=previous.map(e=>e.id===id?edge:e);return true;
}
export function duplicateLane(d,id,payload) {
  const original=d.lanes.find(l=>l.id===id),source=payload||{lane:original,nodes:d.nodes.filter(n=>n.laneId===id),edges:d.edges};
  if(!source.lane)return;
  const lane={...clone(source.lane),id:uid(),name:source.lane.name.slice(0,117)+' 副本'};
  const map=new Map(),nodes=source.nodes.map(n=>{const fresh={...cloneNodeTree(n),laneId:lane.id};map.set(n.id,fresh.id);return fresh;});
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
  const all=new Set();let totalNodes=0,totalFlows=0;
  const take=id=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(id)||all.has(id))fail();all.add(id);};
  function check(input,depth=0){
  if(depth>20||++totalFlows>300||!input||input.version!==1||typeof input.title!=='string'||input.title.length>200||!Array.isArray(input.lanes)||!Array.isArray(input.nodes)||!Array.isArray(input.edges)||input.lanes.length>100||(totalNodes+=input.nodes.length)>3000||input.edges.length>6000)fail();
  const d={...input,lanes:input.lanes.map(l=>({...l})),nodes:input.nodes.map(n=>({...n})),edges:input.edges.map(e=>({...e}))};
  for(const l of d.lanes){take(l.id);if(!Object.hasOwn(TYPES,l.type)||typeof l.name!=='string'||l.name.length>120)fail();}
  const lanes=new Set(d.lanes.map(l=>l.id));
  for(const n of d.nodes) {
    take(n.id);
    n.offsetY??=80;
    if(!Number.isFinite(n.offsetY)||n.offsetY<32||n.offsetY>120)fail();
    n.offsetY=80;
    if(!lanes.has(n.laneId)||!SHAPES.includes(n.shape)||!Number.isFinite(n.x)||n.x<MIN_X||n.x>1000000||!Number.isFinite(n.width)||n.width<MIN_WIDTH||n.width>1000000||typeof n.text!=='string'||n.text.length>4000||!['left','center','right'].includes(n.align)||!['top','middle','bottom'].includes(n.valign)||!Number.isFinite(n.fontSize)||n.fontSize<10||n.fontSize>40||!(n.fill==='auto'||/^#[0-9a-f]{6}$/i.test(n.fill)))fail();
    if(n.expanded!==undefined&&!['none','one','all'].includes(n.expanded))fail();
    if(n.subflow!==undefined)n.subflow=check(n.subflow,depth+1);
  }
  for(const l of d.lanes){const ns=laneNodes(d,l.id);for(let i=1;i<ns.length;i++)if(ns[i].x<ns[i-1].x+ns[i-1].width+GAP-0.01)fail();}
  const edges=d.edges;d.edges=[];
  for(const e of edges){take(e.id);if(!addEdge(d,e.from,e.fromSide,e.to,e.toSide,false))fail();d.edges.at(-1).id=e.id;}
  enforceDependencies(d);
  // Only known properties are retained, so imports cannot inject UI or executable markup.
  return {version:1,title:d.title,lanes:d.lanes.map(({id,type,name})=>({id,type,name})),nodes:d.nodes.map(({id,shape,laneId,x,offsetY,width,text,align,valign,fontSize,fill,subflow,expanded})=>({id,shape,laneId,x,offsetY,width,text,align,valign,fontSize,fill,...(subflow?{subflow}:{}),...(expanded?{expanded}:{})})),edges:d.edges};
  }
  return check(input);
}
export function ensureSubflow(node){
  if(!node.subflow){node.subflow=createDocument();node.subflow.title=(node.text||'未命名过程').slice(0,185)+' · 子流程';}
  return node.subflow;
}
export function getFlow(root,path=[]){let d=root;for(const id of path){d=d?.nodes.find(n=>n.id===id)?.subflow;if(!d)return null;}return d;}
export function cloneFlow(d){
  const lanes=d.lanes.map(l=>({...clone(l),id:uid()})),lm=new Map(d.lanes.map((l,i)=>[l.id,lanes[i].id]));
  const nodes=d.nodes.map(n=>({...cloneNodeTree(n),laneId:lm.get(n.laneId)})),nm=new Map(d.nodes.map((n,i)=>[n.id,nodes[i].id]));
  return {version:1,title:d.title,lanes,nodes,edges:d.edges.map(e=>({...clone(e),id:uid(),from:nm.get(e.from),to:nm.get(e.to)}))};
}
export function cloneNodeTree(n){const fresh={...clone(n),id:uid(),offsetY:80};if(n.subflow)fresh.subflow=cloneFlow(n.subflow);return fresh;}
export function moveNodes(d,ids,anchorId,targetLaneId,x){return scheduledEdit(d,()=>move(d,ids,anchorId,targetLaneId,x));}
function move(d,ids,anchorId,targetLaneId,x){
  const nodes=d.nodes.filter(n=>ids.includes(n.id)),anchor=nodes.find(n=>n.id===anchorId),targetIndex=d.lanes.findIndex(l=>l.id===targetLaneId);
  if(!anchor||targetIndex<0)return;
  if(nodes.length===1){placeNode(d,anchorId,targetLaneId,x,false);anchor.offsetY=80;return;}
  const laneIndex=n=>d.lanes.findIndex(l=>l.id===n.laneId),minLane=Math.min(...nodes.map(laneIndex)),maxLane=Math.max(...nodes.map(laneIndex));
  const shift=Math.max(-minLane,Math.min(d.lanes.length-1-maxLane,targetIndex-laneIndex(anchor)));
  const dx=Math.max(MIN_X-Math.min(...nodes.map(n=>n.x)),x-anchor.x);
  const moves=nodes.map(n=>({n,x:n.x+dx,lane:d.lanes[laneIndex(n)+shift].id})).sort((a,b)=>a.x-b.x);
  d.nodes=d.nodes.filter(n=>!ids.includes(n.id));
  for(const item of moves){item.n.laneId=item.lane;item.n.x=item.x;item.n.offsetY=80;d.nodes.push(item.n);placeNode(d,item.n.id,item.lane,item.x,false);}
}
