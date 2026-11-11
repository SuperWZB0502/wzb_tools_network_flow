export const LEFT=164,TOP=52,ROW=160,NH=64;
export const scopeKey=scope=>scope.join('/');
export const nodeKey=(scope,id)=>scopeKey(scope)+':'+id;
export function layoutFlow(d,force='default',depth=0){
  const expanded=new Map(),events=[];
  for(const n of d.nodes){const mode=force==='none'?'none':force==='all'?'all':n.expanded||'none';if(n.subflow&&mode!=='none'&&depth<20){const child=layoutFlow(n.subflow,mode==='all'?'all':'default',depth+1),width=Math.max(n.width,child.width+36),height=child.height+58;expanded.set(n.id,{child,width,height,mode});events.push({id:n.id,start:n.x,end:n.x+n.width,extra:Math.max(0,width-n.width)});}}
  events.sort((a,b)=>a.end-b.end);
  const project=x=>x+events.reduce((s,e)=>s+(x>=e.end-.01?e.extra:0),0);
  const lanes=[];let y=0;for(const l of d.lanes){const height=Math.max(ROW,...d.nodes.filter(n=>n.laneId===l.id).map(n=>(expanded.get(n.id)?.height||NH)+48));lanes.push({lane:l,y,height});y+=height;}
  const nodes=new Map();for(const n of d.nodes){const lane=lanes.find(l=>l.lane.id===n.laneId);if(!lane)continue;const exp=expanded.get(n.id),width=exp?.width||n.width,height=exp?.height||NH;nodes.set(n.id,{node:n,x:project(n.x),y:lane.y+(lane.height-height)/2,width,height,lane,...(exp?{child:exp.child,mode:exp.mode}:{})});}
  return {flow:d,lanes,nodes,events,project,width:Math.max(LEFT+280,...[...nodes.values()].map(n=>LEFT+n.x+n.width+30)),height:Math.max(ROW,y)};
}
export function inverseX(layout,visual){
  let shift=0;for(const e of layout.events){const start=e.end+shift;if(visual<start)break;if(visual<start+e.extra)return e.end;shift+=e.extra;}return visual-shift;
}
export function buildScene(d,scope=[],options={}){
  const layout=layoutFlow(d),scene={layout,nodes:[],lanes:[],edges:[],contexts:new Map()};
  function visit(l,scope,ox,oy,parentKey=null){
    const sk=scopeKey(scope);scene.contexts.set(sk,{layout:l,flow:l.flow,scope,ox,oy});
    for(const lane of l.lanes)scene.lanes.push({...lane,scope,flow:l.flow,x:ox,y:oy+lane.y,width:l.width,parentKey,key:sk+':lane:'+lane.lane.id});
    for(const item of l.nodes.values()){
      const s={...item,scope,flow:l.flow,x:ox+LEFT+item.x,y:oy+item.y,parentKey,key:nodeKey(scope,item.node.id)};scene.nodes.push(s);
      if(item.child)visit(item.child,[...scope,item.node.id],s.x+18,s.y+42,s.key);
    }
    for(const edge of l.flow.edges)scene.edges.push({edge,scope,key:sk+':edge:'+edge.id,fromKey:nodeKey(scope,edge.from),toKey:nodeKey(scope,edge.to)});
  }
  visit(layout,scope,0,TOP);return scene;
}
