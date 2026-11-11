import {TYPES,SHAPES,uid,createDocument,makeNode,addEdge,cloneFlow,validateDocument} from './model.mjs';
const leaf=(id,name,type='compute',shape='rounded')=>({id,name,type,shape});
export function createCatalog(custom=[]){return[
  {id:'shapes',name:'基础形状',type:'compute',children:SHAPES.map(shape=>leaf('shape-'+shape,{rect:'矩形',rounded:'圆角矩形',ellipse:'椭圆',diamond:'菱形',parallelogram:'平行四边形',capsule:'胶囊'}[shape],'compute',shape))},
  {id:'custom',name:'自定义模块',type:'compute',children:custom},
  {id:'models',name:'常用模块',type:'compute',children:[leaf('embedding','Embedding'),{id:'transform-layer',name:'TransformLayer',type:'compute',children:[leaf('attention-norm','AttentionNorm'),leaf('self-attention','SelfAttention'),leaf('mlp-norm','MLPNorm'),leaf('mlp','MLP')]}]},
  {id:'communications',name:'常用通信模块',type:'communication',children:['AllReduce','AllGather','ReduceScatter','AllToAll','Send','Recv'].map(name=>leaf('comm-'+name.toLowerCase(),name,'communication','capsule'))}
];}
export function findModule(catalog,id){for(const item of catalog){if(item.id===id)return item;const nested=item.children&&findModule(item.children,id);if(nested)return nested;}return null;}
export function instantiateModule(item,laneId,x){
  if(!item)throw Error('模块不存在。');
  const n=makeNode(item.shape||'rounded',laneId,x,item.name);n.fill=TYPES[item.type||'compute'].fill;if(item.name.length>12)n.width=200;
  if(item.flow)n.subflow=cloneFlow(item.flow);
  else if(item.children){const d=createDocument();d.title=item.name;let previous=null,position=40;for(const child of item.children){const lane=d.lanes.find(l=>l.type===(child.type||'compute')),node=instantiateModule(child,lane.id,position);d.nodes.push(node);if(previous)addEdge(d,previous.id,'right',node.id,'left');position=node.x+node.width+40;previous=node;}n.subflow=d;}
  return n;
}
export function makeCustomModule(name,flow){const title=String(name).trim().slice(0,80);if(!title)throw Error('请填写模块名称。');return{id:'custom-'+uid(),name:title,type:'compute',flow:validateDocument(flow)};}
export function readCustomModules(value){if(!Array.isArray(value))return[];const seen=new Set(),result=[];for(const entry of value.slice(0,100)){try{if(!entry||typeof entry.id!=='string'||!/^custom-[-a-zA-Z0-9_]{1,120}$/.test(entry.id)||seen.has(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>80)continue;const item={id:entry.id,name:entry.name,type:'compute',flow:validateDocument(entry.flow)};seen.add(item.id);result.push(item);}catch{}}return result;}
