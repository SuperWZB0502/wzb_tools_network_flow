export const LEFT=164,TOP=52,ROW=160,NH=64;
export const scopeKey=scope=>scope.join('/');
export const nodeKey=(scope,id)=>scopeKey(scope)+':'+id;
export function layoutFlow(d,force='default',depth=0,options={}){
  const scale=options.scale??1,left=options.left??LEFT;
  const expanded=new Map(),events=[];
  for(const n of d.nodes){const mode=force==='none'?'none':force==='all'?'all':n.expanded||'none';if(n.subflow&&mode!=='none'&&depth<20){const child=layoutFlow(n.subflow,mode==='all'?'all':'default',depth+1,options),width=Math.max(n.width*scale,child.width+36),height=child.height+58;expanded.set(n.id,{child,width,height,mode});events.push({id:n.id,start:n.x,end:n.x+n.width,extra:Math.max(0,width/scale-n.width)});}}
  events.sort((a,b)=>a.end-b.end);
  const project=x=>(x+events.reduce((s,e)=>s+(x>=e.end-.01?e.extra:0),0))*scale;
  const lanes=[];let y=0;for(const l of d.lanes){const height=Math.max(ROW,...d.nodes.filter(n=>n.laneId===l.id).map(n=>(expanded.get(n.id)?.height||NH)+48));lanes.push({lane:l,y,height});y+=height;}
  const nodes=new Map();for(const n of d.nodes){const lane=lanes.find(l=>l.lane.id===n.laneId);if(!lane)continue;const exp=expanded.get(n.id),width=exp?.width||n.width*scale,height=exp?.height||NH;nodes.set(n.id,{node:n,x:project(n.x),y:lane.y+(lane.height-height)/2,width,height,lane,...(exp?{child:exp.child,mode:exp.mode}:{})});}
  return {flow:d,lanes,nodes,events,project,scale,left,width:Math.max(left+280*scale,...[...nodes.values()].map(n=>left+n.x+n.width+30)),height:Math.max(ROW,y)};
}
export function inverseX(layout,visual){
  visual/=layout.scale??1;
  let shift=0;for(const e of layout.events){const start=e.end+shift;if(visual<start)break;if(visual<start+e.extra)return e.end;shift+=e.extra;}return visual-shift;
}
// Preserve a point across time scaling, including fixed headers and expansion gaps.
export function reprojectX(before,after,local){
  if(local<=before.left)return local;
  const visual=local-before.left;let shift=0;
  for(const e of before.events){const start=(e.end+shift)*before.scale,end=start+e.extra*before.scale;
    if(visual>=start&&visual<end){const next=after.events.find(v=>v.id===e.id),previous=after.events.slice(0,after.events.indexOf(next)).reduce((sum,v)=>sum+v.extra,0);return after.left+(next.end+previous)*after.scale+(visual-start)/(end-start)*next.extra*after.scale;}
    shift+=e.extra;
  }
  return after.left+after.project(inverseX(before,visual));
}
export function buildScene(d,scope=[],options={}){
  const layout=layoutFlow(d,'default',0,options),scene={layout,nodes:[],lanes:[],edges:[],contexts:new Map()};
  function visit(l,scope,ox,oy,parentKey=null){
    const sk=scopeKey(scope);scene.contexts.set(sk,{layout:l,flow:l.flow,scope,ox,oy});
    for(const lane of l.lanes)scene.lanes.push({...lane,scope,flow:l.flow,x:ox,y:oy+lane.y,width:l.width,parentKey,key:sk+':lane:'+lane.lane.id});
    for(const item of l.nodes.values()){
      const s={...item,scope,flow:l.flow,x:ox+l.left+item.x,y:oy+item.y,parentKey,key:nodeKey(scope,item.node.id)};scene.nodes.push(s);
      if(item.child)visit(item.child,[...scope,item.node.id],s.x+18,s.y+42,s.key);
    }
    for(const edge of l.flow.edges)scene.edges.push({edge,scope,key:sk+':edge:'+edge.id,fromKey:nodeKey(scope,edge.from),toKey:nodeKey(scope,edge.to)});
  }
  visit(layout,scope,0,TOP);return scene;
}
