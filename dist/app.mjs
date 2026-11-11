import {TYPES,SHAPES,GAP,MIN_X,uid,clone,makeLane,makeNode,createDocument,laneNodes,placeNode,nudgeNode,resizeNode,duplicateLane,deleteSelection,addEdge,validateDocument} from './model.mjs';

const $=s=>document.querySelector(s), NS='http://www.w3.org/2000/svg';
const LEFT=164,TOP=52,ROW=160,NH=64,STORAGE='network-flow-sketch-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shapeNames={rect:'矩形',rounded:'圆角矩形',ellipse:'椭圆',diamond:'菱形',parallelogram:'平行四边形',capsule:'胶囊'};
const icons={cursor:'M4 3l15 9-7 1-4 7z',hand:'M8 13V6a2 2 0 014 0v6-8a2 2 0 014 0v9-6a2 2 0 014 0v9c0 5-3 7-7 7-3 0-4-1-6-4L3 13a2 2 0 013-2l2 2z',undo:'M8 4L3 9l5 5M3 9h10a6 6 0 010 12',redo:'M16 4l5 5-5 5M21 9H11a6 6 0 000 12',copy:'M9 8h11v13H9zM15 8V3H4v13h5',cut:'M9 9l11 12M9 15L20 3M9 6a3 3 0 11-6 0 3 3 0 016 0zM9 18a3 3 0 11-6 0 3 3 0 016 0z',paste:'M9 5H5v16h15V5h-4M9 3h7v5H9z',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',plus:'M12 5v14M5 12h14',folder:'M3 7V4h7l2 3h9l-2 13H3zM3 10h17',export:'M12 15V3M7 8l5-5 5 5M4 14v7h16v-7',help:'M9 8a3 3 0 016 0c0 3-3 2-3 5M12 17v.5M22 12a10 10 0 11-20 0 10 10 0 0120 0z',fit:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',alignLeft:'M4 5h16M4 10h10M4 15h16M4 20h10',alignCenter:'M3 5h18M7 10h10M3 15h18M7 20h10',alignRight:'M4 5h16M10 10h10M4 15h16M10 20h10',alignTop:'M4 4h16M7 8h10v10H7z',alignMiddle:'M4 12h16M7 7h10v10H7z',alignBottom:'M4 20h16M7 6h10v10H7z'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.cursor}"/></svg>`;}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{if(!el.querySelector('svg'))el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon));});}
const svg=$('#diagram'),viewport=$('#viewport'),sizer=$('#canvas-sizer');
let doc=createDocument(),selected=null,undoStack=[],redoStack=[],clipboard=null,gesture=null,zoom=1,panMode=false,space=false,editor=null;
let toastTimer,saveTimer,width=1800,height=604,saveFailure=false,lastNodeClick=null;
try{const raw=localStorage.getItem(STORAGE);if(raw)doc=validateDocument(JSON.parse(raw));}catch{setTimeout(()=>toast('无法读取上次画板，已打开空白画板。'),300);}
const nodeBy=id=>doc.nodes.find(n=>n.id===id),laneBy=id=>doc.lanes.find(l=>l.id===id);
function el(tag,attrs={},parent){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.append(n);return n;}
function label(text,x,y,attrs={},parent=svg){const n=el('text',{x,y,'font-family':'Segoe UI, Microsoft YaHei, sans-serif',...attrs},parent);n.textContent=text;return n;}
function seed(id){let n=1;for(const c of id)n=(n*31+c.charCodeAt(0))>>>0;return n||1;}
function shape(rc,type,x,y,w,h,options){
  if(type==='ellipse')return rc.ellipse(x+w/2,y+h/2,w,h,options);
  if(type==='diamond')return rc.polygon([[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]],options);
  if(type==='parallelogram')return rc.polygon([[x+16,y],[x+w,y],[x+w-16,y+h],[x,y+h]],options);
  if(type==='rounded'||type==='capsule'){const r=type==='capsule'?h/2:9;return rc.path(`M ${x+r} ${y} H ${x+w-r} Q ${x+w} ${y} ${x+w} ${y+r} V ${y+h-r} Q ${x+w} ${y+h} ${x+w-r} ${y+h} H ${x+r} Q ${x} ${y+h} ${x} ${y+h-r} V ${y+r} Q ${x} ${y} ${x+r} ${y} Z`,options);}
  return rc.rectangle(x,y,w,h,options);
}
function renderLibrary(){
  const container=$('#shape-library');
  for(const type of SHAPES){const b=document.createElement('button');b.className='shape-card';b.dataset.shape=type;b.setAttribute('aria-label','拖入'+shapeNames[type]);const s=el('svg',{viewBox:'0 0 60 32'});s.append(shape(rough.svg(s),type,3,3,54,26,{stroke:'#82768e',strokeWidth:1.1,roughness:.8,seed:33,fill:'#fbfaff',fillStyle:'solid'}));b.append(s);const t=document.createElement('span');t.textContent=shapeNames[type];b.append(t);container.append(b);}
  const presets=[['MatMul','compute','rect'],['Attention','compute','rounded'],['AllReduce','communication','capsule'],['AllGather','communication','parallelogram'],['H2D 拷贝','copy','rect'],['D2H 拷贝','copy','rounded']];
  $('#presets').innerHTML=presets.map(([name,type,shape])=>`<button class="preset" data-preset="${name}" data-preset-shape="${shape}" data-preset-type="${type}"><i style="background:${TYPES[type].fill}"></i>${name}<small>${TYPES[type].name.slice(0,-1)}</small></button>`).join('');
}
function nodeY(n){return TOP+doc.lanes.findIndex(l=>l.id===n.laneId)*ROW+(n.offsetY??80);}
function setVertical(n,y){const index=doc.lanes.findIndex(l=>l.id===n.laneId);n.offsetY=Math.max(32,Math.min(120,y-TOP-index*ROW));}
function portPoint(n,side){return {x:LEFT+n.x+(side==='right'?n.width:0),y:nodeY(n)};}
function curve(a,as,b,bs){
  const c=Math.max(52,Math.abs(b.x-a.x)*.46),s1=as==='right'?1:-1,s2=bs==='right'?1:-1;
  if(Math.abs(a.y-b.y)<10&&((as==='right'&&b.x<a.x)||(as==='left'&&b.x>a.x))){const arch=a.y-78;return `M ${a.x} ${a.y} C ${a.x+s1*55} ${arch} ${b.x+s2*55} ${arch} ${b.x} ${b.y}`;}
  return `M ${a.x} ${a.y} C ${a.x+s1*c} ${a.y} ${b.x+s2*c} ${b.y} ${b.x} ${b.y}`;
}
const measure=document.createElement('canvas').getContext('2d');
function linesFor(n){
  const factor=n.shape==='diamond'?.55:n.shape==='ellipse'?.72:1;
  const available=Math.max(18,n.width*factor-26);measure.font=`${n.fontSize}px "Microsoft YaHei", sans-serif`;
  const lines=[];for(const paragraph of n.text.split('\n')){let line='';for(const char of paragraph){if(line&&measure.measureText(line+char).width>available){lines.push(line);line='';}line+=char;}lines.push(line);}
  const max=Math.max(1,Math.floor((NH-18)/(n.fontSize*1.3)));
  if(lines.length>max){lines.length=max;let end=lines[max-1];while(end&&measure.measureText(end+'…').width>available)end=end.slice(0,-1);lines[max-1]=end+'…';}
  return {lines,factor};
}
function render(refreshInspector=true){
  width=Math.max(1800,...doc.nodes.map(n=>LEFT+n.x+n.width+220));height=TOP+Math.max(3,doc.lanes.length)*ROW+72;
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width*zoom);svg.setAttribute('height',height*zoom);sizer.style.width=width*zoom+'px';sizer.style.height=height*zoom+'px';
  const defs=el('defs',{},svg);for(const [id,color]of [['arrow','#8e879e'],['arrow-selected','#8668b4']]){const marker=el('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},defs);el('path',{d:'M1 1L9 5 1 9',fill:'none',stroke:color,'stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'},marker);}
  // Ruler expresses relative time only.
  label('相对时间',18,24,{'font-size':10,fill:'#a4a0b0'});
  el('line',{x1:LEFT,y1:36,x2:width-24,y2:36,stroke:'#dad8e3','stroke-width':1},svg);
  for(let x=0;x<width-LEFT-40;x+=40){el('line',{x1:LEFT+x,y1:x%200===0?25:31,x2:LEFT+x,y2:36,stroke:'#d1cedc','stroke-width':1},svg);if(x%200===0)label(String(x/40),LEFT+x+2,18,{'font-size':10,fill:'#aaa5b7'});}
  const rc=rough.svg(svg);
  doc.lanes.forEach((lane,i)=>{
    const y=TOP+i*ROW,type=TYPES[lane.type],g=el('g',{'data-lane':lane.id},svg);
    el('rect',{x:0,y,width:width-2,height:ROW-8,rx:8,fill:type.color,'fill-opacity':.85},g);
    g.append(rc.line(4,y+ROW-8,width-5,y+ROW-8,{stroke:type.stroke,strokeWidth:.55,roughness:.7,seed:seed(lane.id)}));
    el('line',{x1:LEFT-17,y1:y+17,x2:LEFT-17,y2:y+ROW-26,stroke:type.stroke,'stroke-opacity':.12},g);
    const grip=el('g',{'data-lane-grip':lane.id,class:'lane-grip',role:'button','aria-label':'拖动排序 '+lane.name},g);el('rect',{x:7,y:y+49,width:22,height:53,fill:'transparent'},grip);for(let r=0;r<3;r++)for(let c=0;c<2;c++)el('circle',{cx:14+c*6,cy:y+64+r*7,r:1.3,fill:type.stroke,'fill-opacity':.55},grip);
    const lg=el('g',{'data-lane-select':lane.id,class:'lane-select',role:'button','aria-label':'选中泳道 '+lane.name},g);el('rect',{x:30,y:y+35,width:103,height:85,fill:'transparent'},lg);label(lane.name.length>10?lane.name.slice(0,9)+'…':lane.name,35,y+70,{'font-size':14,fill:type.stroke,'font-weight':500},lg);label(type.caption,35,y+90,{'font-size':8.5,fill:type.stroke,'fill-opacity':.55},lg);
    const more=el('g',{'data-lane-more':lane.id,class:'lane-more',role:'button','aria-label':'泳道菜单 '+lane.name},g);el('rect',{x:106,y:y+110,width:27,height:24,fill:'transparent'},more);label('···',111,y+126,{'font-size':19,fill:type.stroke},more);
    if(selected?.kind==='lane'&&selected.id===lane.id)el('rect',{x:1,y:y+1,width:width-4,height:ROW-10,rx:8,class:'lane-outline'},g);
  });
  if(!doc.lanes.length)label('点击“新增泳道”，开始绘制流程',LEFT+40,160,{'font-size':18,fill:'#a299b7'});
  const edges=el('g',{'data-layer':'edges'},svg);
  for(const e of doc.edges){const from=nodeBy(e.from),to=nodeBy(e.to);if(!from||!to)continue;const d=curve(portPoint(from,e.fromSide),e.fromSide,portPoint(to,e.toSide),e.toSide),g=el('g',{'data-edge':e.id},edges),active=selected?.kind==='edge'&&selected.id===e.id;el('path',{d,fill:'none',stroke:'transparent','stroke-width':16,class:'edge-hit'},g);el('path',{d,fill:'none',stroke:active?'#8668b4':'#8e879e','stroke-width':active?2.3:1.55,'stroke-linecap':'round','marker-end':`url(#${active?'arrow-selected':'arrow'})`,'pointer-events':'none',class:'visible-edge'},g);}
  for(const n of doc.nodes){
    const lane=laneBy(n.laneId);if(!lane)continue;const type=TYPES[lane.type],x=LEFT+n.x,y=nodeY(n)-NH/2,active=selected?.kind==='node'&&selected.id===n.id,g=el('g',{'data-node':n.id,class:'node-group'+(active?' selected':''),role:'button','aria-label':n.text||'空白过程'},svg);
    const hit=el('rect',{x,y,width:n.width,height:NH,fill:'transparent',class:'node-shape'},g);
    const art=shape(rc,n.shape,x,y,n.width,NH,{stroke:type.stroke,strokeWidth:1.3,roughness:.85,bowing:.9,seed:seed(n.id),fill:n.fill==='auto'?type.fill:n.fill,fillStyle:'solid'});art.setAttribute('pointer-events','none');g.append(art);g.append(hit);
    const {lines,factor}=linesFor(n),inset=(n.width-n.width*factor)/2+14;
    const tx=n.align==='left'?x+inset:n.align==='right'?x+n.width-inset:x+n.width/2;
    const th=lines.length*n.fontSize*1.3,ty=n.valign==='top'?y+12:n.valign==='bottom'?y+NH-12-th:y+(NH-th)/2;
    const text=el('text',{'font-family':'Segoe Print, KaiTi, Microsoft YaHei, sans-serif','font-size':n.fontSize,fill:'#3e4b55','text-anchor':n.align==='left'?'start':n.align==='right'?'end':'middle','pointer-events':'none'},g);lines.forEach((line,i)=>{const t=el('tspan',{x:tx,y:ty+n.fontSize*.95+i*n.fontSize*1.3},text);t.textContent=line;});
    const title=el('title',{},g);title.textContent=n.text;
    if(active)el('rect',{x:x-5,y:y-5,width:n.width+10,height:NH+10,rx:4,class:'selected-outline'},g);
    for(const side of ['left','right']){const edge=side==='left'?x:x+n.width;const h=el('g',{'data-resize':n.id+':'+side,class:'resize-handle'},g);el('rect',{x:edge-6,y:y-2,width:12,height:NH+4,fill:'transparent'},h);el('rect',{x:edge-2,y:y+9,width:4,height:12,rx:2,fill:'#b4a3ce'},h);el('rect',{x:edge-2,y:y+NH-21,width:4,height:12,rx:2,fill:'#b4a3ce'},h);const p=el('g',{'data-port':n.id+':'+side,class:'port',role:'button','aria-label':n.text+' '+(side==='left'?'左':'右')+'连接点'},g);el('circle',{cx:edge,cy:y+NH/2,r:5},p);el('circle',{cx:edge,cy:y+NH/2,r:11,fill:'transparent',stroke:'none',style:'fill:transparent;stroke:none'},p);}
  }
  if(gesture?.type==='connection'){const n=nodeBy(gesture.id);if(n)el('path',{d:curve(portPoint(n,gesture.side),gesture.side,gesture.point,gesture.side==='right'?'left':'right'),fill:'none',stroke:'#9c83be','stroke-width':1.6,'stroke-dasharray':'5 4','pointer-events':'none'},svg);}
  if(gesture?.targetLane){const index=doc.lanes.findIndex(l=>l.id===gesture.targetLane);if(index>=0)el('rect',{x:1,y:TOP+index*ROW+1,width:width-4,height:ROW-10,rx:8,class:'drop-target','pointer-events':'none'},svg);}
  $('#empty-hint').hidden=!!doc.nodes.length||!doc.lanes.length||gesture?.type==='library';
  $('#document-stats').textContent=`${doc.lanes.length} 条泳道 · ${doc.nodes.length} 个过程 · ${doc.edges.length} 条依赖`;
  $('#zoom-value').textContent=Math.round(zoom*100)+'%';
  $('#document-title').value=doc.title;
  $('#undo-btn').disabled=!undoStack.length;$('#redo-btn').disabled=!redoStack.length;
  for(const id of ['copy-btn','cut-btn','delete-btn'])$('#'+id).disabled=!selected;
  $('#paste-btn').disabled=!clipboard;
  document.body.classList.toggle('connecting',gesture?.type==='connection');
  if(refreshInspector)renderInspector();hydrateIcons();
}
function renderInspector(){
  const box=$('#inspector-content'),inspector=$('.inspector');inspector.classList.toggle('has-selection',!!selected);
  const buttons=`<div class="selection-actions"><button data-selection-action="copy" data-icon="copy">复制</button><button data-selection-action="cut" data-icon="cut">剪切</button><button class="danger" data-selection-action="delete" data-icon="trash">删除</button></div>`;
  if(!selected){box.innerHTML=`<div class="panel-heading"><h2>画板笔记</h2><span class="selection-kind">轻松开始</span></div><div class="inspector-empty"><svg viewBox="0 0 70 75" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 11L52 7 59 62 18 67ZM19 23l25-3M22 33l27-3M25 44l13-2M49 47l10-15 5 4-10 15-7 4z"/><path d="M9 65Q5 67 4 71M63 10l3-6M62 15l7-1"/></svg><h3>选中一个过程</h3><p>文字、对齐和宽度，<br>都可以在这里调整。</p><div class="hint-card"><strong>找到可以掩盖的时间</strong><p>让没有数据依赖的过程上下对齐，观察计算、通信和拷贝的重叠空间。</p></div></div><button class="new-canvas-btn" id="new-btn">新建空白画板</button>`;return;}
  if(selected.kind==='node'){
    const n=nodeBy(selected.id);if(!n){selected=null;renderInspector();return;}
    box.innerHTML=`<div class="panel-heading"><h2>过程属性</h2><span class="selection-kind">${esc(TYPES[laneBy(n.laneId).type].name)}</span></div><div class="field"><label for="node-text">文字内容</label><textarea id="node-text" maxlength="4000">${esc(n.text)}</textarea></div><div class="field"><label for="node-shape">形状</label><select id="node-shape">${SHAPES.map(s=>`<option value="${s}" ${s===n.shape?'selected':''}>${shapeNames[s]}</option>`).join('')}</select></div><div class="field field-row"><div><label for="node-x">横向位置</label><input id="node-x" type="number" min="20" max="50000" value="${Math.round(n.x)}"></div><div><label for="node-width">宽度</label><input id="node-width" type="number" min="64" max="10000" value="${Math.round(n.width)}"></div></div><div class="field"><span class="field-title">文字对齐</span><div class="segmented">${[['left','alignLeft','文字左对齐'],['center','alignCenter','文字水平居中'],['right','alignRight','文字右对齐']].map(([v,ic,a])=>`<button data-align="${v}" aria-label="${a}" aria-pressed="${n.align===v}" class="${n.align===v?'active':''}">${icon(ic)}</button>`).join('')}</div><div class="segmented subfield">${[['top','alignTop','文字靠上'],['middle','alignMiddle','文字垂直居中'],['bottom','alignBottom','文字靠下']].map(([v,ic,a])=>`<button data-valign="${v}" aria-label="${a}" aria-pressed="${n.valign===v}" class="${n.valign===v?'active':''}">${icon(ic)}</button>`).join('')}</div></div><div class="field"><label for="node-font">字号</label><select id="node-font">${[12,14,16,18,20,24,28,32].map(s=>`<option value="${s}" ${s===n.fontSize?'selected':''}>${s} px</option>`).join('')}</select></div><div class="field"><span class="field-title">填充颜色</span><div class="swatches">${['auto','#c7e0ff','#c5e8ce','#f5e6a6','#e4d7f4','#f5d5d9','#ffffff'].map(c=>`<button data-fill="${c}" class="swatch ${n.fill===c?'active':''}" style="--swatch:${c==='auto'?TYPES[laneBy(n.laneId).type].fill:c}" aria-label="${c==='auto'?'跟随泳道':c}" title="${c==='auto'?'跟随泳道':c}">${c==='auto'?'↻':''}</button>`).join('')}</div></div><hr>${buttons}<p class="inspector-note">← → 微移 1px，Shift 加速到 10px。<br>拖动两侧圆点，为过程添加依赖。</p>`;
  }else if(selected.kind==='lane'){
    const l=laneBy(selected.id);if(!l){selected=null;renderInspector();return;}
    box.innerHTML=`<div class="panel-heading"><h2>泳道属性</h2><span class="selection-kind">整条泳道</span></div><div class="field"><label for="lane-name">泳道名称</label><input id="lane-name" maxlength="120" value="${esc(l.name)}"></div><div class="field"><label for="lane-type">泳道类型</label><select id="lane-type">${Object.entries(TYPES).map(([v,t])=>`<option value="${v}" ${l.type===v?'selected':''}>${t.name}</option>`).join('')}</select></div><div class="field"><span class="field-title">上下顺序</span><div class="segmented"><button data-lane-step="-1" aria-label="泳道上移">↑ 上移</button><button data-lane-step="1" aria-label="泳道下移">↓ 下移</button></div></div><hr>${buttons}<p class="inspector-note">复制整条泳道时，会同时复制其中的组件和内部依赖线。<br>也可以抓住左侧六点手柄拖动排序。</p>`;
  }else{
    const e=doc.edges.find(e=>e.id===selected.id);if(!e){selected=null;renderInspector();return;}
    box.innerHTML=`<div class="panel-heading"><h2>数据依赖</h2><span class="selection-kind">曲线连接</span></div><div class="field"><span class="field-title">前置过程</span><p style="font-size:12px;line-height:1.7">${esc(nodeBy(e.from).text)}</p></div><div class="field"><span class="field-title">后续过程</span><p style="font-size:12px;line-height:1.7">${esc(nodeBy(e.to).text)}</p></div><hr><button class="quiet" data-selection-action="delete" data-icon="trash">删除依赖线</button><p class="inspector-note">移动或缩放组件后，连线会自动跟随。箭头指向依赖数据的后续过程。</p>`;
  }
}
function toast(message){const n=$('#toast');n.textContent=message;n.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('visible'),2800);}
function save(){clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(doc));saveFailure=false;$('#save-state').innerHTML='<i></i>已自动保存到本机';}catch{saveFailure=true;$('#save-state').textContent='未能保存，请导出 JSON 备份';toast('本机存储不可用，请导出 JSON 保存画板。');}}
function commit(before,message,refreshInspector=true){if(JSON.stringify(before)!==JSON.stringify(doc)){undoStack.push(before);if(undoStack.length>80)undoStack.shift();redoStack=[];save();}render(refreshInspector);if(message)toast(message);}
function mutate(fn,message,refreshInspector=true){finishEditing();const before=clone(doc);fn();commit(before,message,refreshInspector);}
function undo(){finishEditing();if(!undoStack.length)return;redoStack.push(clone(doc));doc=undoStack.pop();selected=null;save();render();}
function redo(){finishEditing();if(!redoStack.length)return;undoStack.push(clone(doc));doc=redoStack.pop();selected=null;save();render();}
function copySelection(cut=false){
  if(!selected)return;
  if(selected.kind==='node')clipboard={kind:'node',node:clone(nodeBy(selected.id))};
  else if(selected.kind==='lane'){const l=laneBy(selected.id);clipboard={kind:'lane',lane:clone(l),nodes:clone(doc.nodes.filter(n=>n.laneId===l.id)),edges:clone(doc.edges)};}
  else {toast('请选择一个组件或泳道进行复制。');return;}
  if(cut)mutate(()=>{deleteSelection(doc,selected);selected=null;},'已剪切，可以粘贴');else{render();toast(clipboard.kind==='lane'?'已复制整条泳道':'已复制过程');}
}
function paste(){
  if(!clipboard){toast('先选中组件或泳道并复制。');return;}
  mutate(()=>{
    if(clipboard.kind==='lane'){const l=duplicateLane(doc,selected?.kind==='lane'?selected.id:clipboard.lane.id,clipboard);selected={kind:'lane',id:l.id};}
    else{let laneId=selected?.kind==='lane'?selected.id:selected?.kind==='node'?nodeBy(selected.id)?.laneId:clipboard.node.laneId;if(!laneBy(laneId))laneId=doc.lanes[0]?.id;if(!laneId){const l=makeLane('compute');doc.lanes.push(l);laneId=l.id;}const n={...clone(clipboard.node),id:uid(),laneId};n.x+=24;doc.nodes.push(n);placeNode(doc,n.id,laneId,n.x);selected={kind:'node',id:n.id};clipboard.node.x=n.x;}
  },'已粘贴');
}
function removeSelected(){if(selected)mutate(()=>{deleteSelection(doc,selected);selected=null;});}
function setNode(key,value,refreshInspector=true){if(selected?.kind==='node')mutate(()=>{nodeBy(selected.id)[key]=value;},undefined,refreshInspector);}
function closePopover(){$('#popover').hidden=true;}
function openPopover(anchor,html){const menu=$('#popover');menu.innerHTML=html;menu.hidden=false;hydrateIcons(menu);const rect=anchor.getBoundingClientRect();menu.style.left=Math.min(innerWidth-menu.offsetWidth-10,Math.max(8,rect.right-menu.offsetWidth))+'px';menu.style.top=Math.min(innerHeight-menu.offsetHeight-10,rect.bottom+7)+'px';}
function point(e){const c=svg.getScreenCTM();if(!c)return {x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(c.inverse());return {x:p.x,y:p.y};}
function laneAt(p){const i=Math.floor((p.y-TOP)/ROW);return p.y>=TOP&&i>=0&&i<doc.lanes.length?doc.lanes[i]:null;}
function inside(e){const r=viewport.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
function clearGesture(){gesture=null;document.querySelector('.drag-ghost')?.remove();document.body.classList.remove('busy','connecting');viewport.classList.remove('panning');}
function cancelGesture(){if(!gesture)return;if(gesture.before)doc=gesture.before;clearGesture();render();}
function autoScroll(e){const r=viewport.getBoundingClientRect();if(e.clientX<r.left+30)viewport.scrollLeft-=12;if(e.clientX>r.right-30)viewport.scrollLeft+=12;if(e.clientY<r.top+25)viewport.scrollTop-=10;if(e.clientY>r.bottom-25)viewport.scrollTop+=10;}
document.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1)return;
  const clickedNode=e.target.closest('[data-node]')?.dataset.node;
  if(!clickedNode||clickedNode!==lastNodeClick?.id||e.target.closest('[data-port],[data-resize]'))lastNodeClick=null;
  const palette=e.target.closest('[data-shape],[data-preset]');
  if(palette){finishEditing();closePopover();e.preventDefault();gesture={type:'library',shape:palette.dataset.shape||palette.dataset.presetShape,text:palette.dataset.preset||'新建过程',startX:e.clientX,startY:e.clientY};const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=palette.dataset.preset||shapeNames[gesture.shape];ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';document.body.append(ghost);document.body.classList.add('busy');return;}
  if(!e.target.closest('#diagram')&&!((space||panMode||e.button===1)&&e.target.closest('#viewport')))return;
  if(editor&&e.target!==editor)finishEditing();closePopover();
  const p=point(e),port=e.target.closest('[data-port]'),resize=e.target.closest('[data-resize]'),node=e.target.closest('[data-node]'),grip=e.target.closest('[data-lane-grip]'),lane=e.target.closest('[data-lane-select]'),edge=e.target.closest('[data-edge]');
  e.preventDefault();viewport.focus({preventScroll:true});
  if(space||panMode||e.button===1){gesture={type:'pan',startX:e.clientX,startY:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.classList.add('panning');return;}
  if(port){const [id,side]=port.dataset.port.split(':');selected={kind:'node',id};gesture={type:'connection',id,side,point:p};render();return;}
  if(resize){const [id,side]=resize.dataset.resize.split(':');selected={kind:'node',id};gesture={type:'resize',id,side,before:clone(doc),startX:e.clientX,startY:e.clientY};render();return;}
  if(node){const n=nodeBy(node.dataset.node);selected={kind:'node',id:n.id};gesture={type:'node',id:n.id,dx:p.x-LEFT-n.x,dy:p.y-nodeY(n),before:clone(doc),startX:e.clientX,startY:e.clientY,moved:false,double:lastNodeClick?.id===n.id&&Date.now()-lastNodeClick.time<450};render();return;}
  if(grip){selected={kind:'lane',id:grip.dataset.laneGrip};gesture={type:'lane',id:grip.dataset.laneGrip,before:clone(doc),startX:e.clientX,startY:e.clientY,moved:false};render();return;}
  if(lane){selected={kind:'lane',id:lane.dataset.laneSelect};render();return;}
  if(edge){selected={kind:'edge',id:edge.dataset.edge};render();return;}
  if(e.target.closest('[data-lane-more]'))return;
  selected=null;render();
});
document.addEventListener('pointermove',e=>{
  if(!gesture)return;
  const g=gesture;
  if(g.type==='pan'){viewport.scrollLeft=g.left-(e.clientX-g.startX);viewport.scrollTop=g.top-(e.clientY-g.startY);return;}
  if(g.type!=='connection'&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)<4&&!g.moved)return;
  g.moved=true;lastNodeClick=null;document.body.classList.add('busy');if(inside(e))autoScroll(e);
  const p=point(e),lane=laneAt(p);
  if(g.type==='library'){const ghost=$('.drag-ghost');ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';g.targetLane=inside(e)?lane?.id:null;render();return;}
  if(g.type==='connection'){g.point=p;render();return;}
  if(g.type==='node'){doc=clone(g.before);if(lane&&inside(e)){placeNode(doc,g.id,lane.id,p.x-LEFT-g.dx);setVertical(nodeBy(g.id),p.y-g.dy);g.targetLane=lane.id;}render();return;}
  if(g.type==='resize'){doc=clone(g.before);resizeNode(doc,g.id,g.side,p.x-LEFT);render();return;}
  if(g.type==='lane'){const index=Math.max(0,Math.min(doc.lanes.length-1,Math.floor((p.y-TOP)/ROW))),old=doc.lanes.findIndex(l=>l.id===g.id);if(index!==old){const [l]=doc.lanes.splice(old,1);doc.lanes.splice(index,0,l);render();}}
});
document.addEventListener('pointerup',e=>{
  if(!gesture)return;
  const g=gesture;
  if(g.type==='node'&&!g.moved){lastNodeClick={id:g.id,time:Date.now()};clearGesture();if(g.double){lastNodeClick=null;startEditing(g.id);}else render();return;}
  if(g.type==='library'){
    const p=point(e),l=inside(e)&&laneAt(p);if(l&&g.moved){const before=clone(doc),n=makeNode(g.shape,l.id,Math.max(MIN_X,p.x-LEFT-76),g.text);setVertical(n,p.y);doc.nodes.push(n);placeNode(doc,n.id,l.id,n.x);selected={kind:'node',id:n.id};clearGesture();commit(before);return;}
  }else if(g.type==='connection'){
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-port]');if(target){const [id,side]=target.dataset.port.split(':'),before=clone(doc),edge=addEdge(doc,g.id,g.side,id,side);if(edge){selected={kind:'edge',id:edge.id};clearGesture();commit(before,'已建立数据依赖');return;}toast('无法建立依赖：不能自连、重复连接或形成循环。');}
  }else if(g.before&&g.moved){clearGesture();commit(g.before);return;}
  clearGesture();render();
});
document.addEventListener('pointercancel',cancelGesture);
function startEditing(id){
  finishEditing();const n=nodeBy(id);if(!n)return;selected={kind:'node',id};render();const group=svg.querySelector(`[data-node="${id}"]`),r=group.getBBox(),matrix=svg.getScreenCTM(),p=new DOMPoint(LEFT+n.x,nodeY(n)-NH/2).matrixTransform(matrix);const textarea=document.createElement('textarea');textarea.id='text-editor';textarea.setAttribute('aria-label','编辑组件文字');textarea.maxLength=4000;textarea.value=n.text;textarea.dataset.nodeId=id;textarea.style.left=p.x+'px';textarea.style.top=p.y+'px';textarea.style.width=Math.max(120,n.width*zoom)+'px';textarea.style.height=Math.max(70,NH*zoom)+'px';textarea.style.fontSize=n.fontSize*zoom+'px';textarea.style.textAlign=n.align;document.body.append(textarea);editor=textarea;textarea.focus();textarea.select();textarea.addEventListener('blur',()=>finishEditing());textarea.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();finishEditing(true);}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishEditing();viewport.focus({preventScroll:true});}});
}
function finishEditing(cancel=false){if(!editor)return;const t=editor;editor=null;const n=nodeBy(t.dataset.nodeId),before=clone(doc);t.remove();if(!cancel&&n)n.text=t.value;if(n&&n.text!==before.nodes.find(o=>o.id===n.id)?.text)commit(before);}
document.addEventListener('click',e=>{
  const b=e.target.closest('button,[data-lane-more]');
  if(!b){if(!e.target.closest('#popover'))closePopover();return;}
  if(b.dataset.closeDialog){$('#'+b.dataset.closeDialog).close();return;}
  if(b.dataset.addLane){const type=b.dataset.addLane;closePopover();mutate(()=>{const l=makeLane(type);doc.lanes.push(l);selected={kind:'lane',id:l.id};},'已新增'+TYPES[type].name);return;}
  if(b.dataset.export){const type=b.dataset.export;closePopover();exportFile(type);return;}
  if(b.dataset.selectionAction){closePopover();({copy:()=>copySelection(),cut:()=>copySelection(true),delete:removeSelected})[b.dataset.selectionAction]();return;}
  if(b.dataset.align){setNode('align',b.dataset.align);return;}
  if(b.dataset.valign){setNode('valign',b.dataset.valign);return;}
  if(b.dataset.fill){setNode('fill',b.dataset.fill);return;}
  if(b.dataset.laneStep){mutate(()=>{const i=doc.lanes.findIndex(l=>l.id===selected.id),j=Math.max(0,Math.min(doc.lanes.length-1,i+Number(b.dataset.laneStep)));const [l]=doc.lanes.splice(i,1);doc.lanes.splice(j,0,l);});return;}
  if(b.dataset.laneMore){const id=b.dataset.laneMore;selected={kind:'lane',id};render();openPopover(svg.querySelector(`[data-lane-more="${id}"]`),`<button data-selection-action="copy" data-icon="copy">复制泳道 <small>Ctrl+C</small></button><button data-selection-action="cut" data-icon="cut">剪切泳道 <small>Ctrl+X</small></button><button data-selection-action="delete" data-icon="trash">删除泳道</button>`);return;}
  switch(b.id){
    case 'add-lane-btn':openPopover(b,Object.entries(TYPES).map(([type,t])=>`<button data-add-lane="${type}"><i style="background:${t.fill}"></i>${t.name}</button>`).join(''));return;
    case 'export-btn':finishEditing();openPopover(b,'<button data-export="json" aria-label="保存流程 JSON">保存流程 JSON<small>继续编辑</small></button><hr><button data-export="svg" aria-label="导出 SVG">导出 SVG<small>矢量图</small></button><button data-export="png" aria-label="导出 PNG">导出 PNG<small>图片</small></button>');return;
    case 'import-btn':$('#import-file').click();break;
    case 'copy-btn':copySelection();break;case 'cut-btn':copySelection(true);break;case 'paste-btn':paste();break;case 'delete-btn':removeSelected();break;
    case 'undo-btn':undo();break;case 'redo-btn':redo();break;
    case 'help-btn':$('#help-dialog').showModal();break;
    case 'example-btn':showReplace('example');break;case 'new-btn':showReplace('new');break;
    case 'replace-confirm':{const kind=b.dataset.kind;$('#replace-dialog').close();mutate(()=>{doc=kind==='new'?createDocument():exampleDocument();selected=null;},kind==='new'?'已新建画板':'已载入示例，可用撤销恢复');if(kind!=='new')fitCanvas();else{zoom=1;viewport.scrollTo(0,0);render();}break;}
    case 'select-tool':panMode=false;syncMode();break;case 'pan-tool':panMode=true;syncMode();break;
    case 'zoom-out':changeZoom(zoom-.1);break;case 'zoom-in':changeZoom(zoom+.1);break;case 'zoom-value':changeZoom(1);break;case 'fit-btn':fitCanvas();break;
  }
  closePopover();
});
function showReplace(kind){$('#replace-heading').textContent=kind==='new'?'新建空白画板':'载入重叠示例';$('#replace-description').textContent=(kind==='new'?'新建画板':'示例')+'会替换当前画板。你可以随时通过撤销恢复，也可以先导出 JSON 保存。';const b=$('#replace-confirm');b.dataset.kind=kind;b.textContent=kind==='new'?'新建并替换':'载入示例并替换';b.setAttribute('aria-label',b.textContent);$('#replace-dialog').showModal();}
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='document-title'){const value=t.value.trim()||'未命名流程图';mutate(()=>{doc.title=value;});}
  // Keep property controls attached while blur/change fires; otherwise the
  // control the user is about to click disappears before its click event.
  if(t.id==='node-text')setNode('text',t.value,false);
  if(t.id==='node-shape')setNode('shape',t.value,false);
  if(t.id==='node-font')setNode('fontSize',Number(t.value),false);
  if(t.id==='node-x'){const value=Number(t.value);if(Number.isFinite(value))mutate(()=>nudgeNode(doc,selected.id,value-nodeBy(selected.id).x),undefined,false);t.value=Math.round(nodeBy(selected.id).x);}
  if(t.id==='node-width'){const value=Number(t.value);if(Number.isFinite(value))mutate(()=>resizeNode(doc,selected.id,'right',nodeBy(selected.id).x+value),undefined,false);t.value=Math.round(nodeBy(selected.id).width);}
  if(t.id==='lane-name'){const name=t.value.trim()||TYPES[laneBy(selected.id).type].name;mutate(()=>{laneBy(selected.id).name=name;},undefined,false);t.value=name;}
  if(t.id==='lane-type')mutate(()=>{laneBy(selected.id).type=t.value;},undefined,false);
});
document.addEventListener('keydown',e=>{
  if(e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if($('dialog[open]'))return;
  const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
  if(e.key==='Escape'){cancelGesture();closePopover();selected=null;render();return;}
  if(gesture)return;
  if(mod&&['c','x','v','z','y'].includes(key)){e.preventDefault();if(key==='c')copySelection();if(key==='x')copySelection(true);if(key==='v')paste();if(key==='z')e.shiftKey?redo():undo();if(key==='y')redo();return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();return;}
  if(selected?.kind==='node'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();mutate(()=>nudgeNode(doc,selected.id,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1)));return;}
  if(e.code==='Space'){e.preventDefault();space=true;syncMode();}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;syncMode();}});
window.addEventListener('blur',()=>{space=false;cancelGesture();syncMode();});
function syncMode(){viewport.classList.toggle('pan-mode',panMode||space);$('#select-tool').classList.toggle('active',!panMode);$('#pan-tool').classList.toggle('active',panMode);}
function changeZoom(value,anchor){
  finishEditing();const next=Math.round(Math.max(.3,Math.min(2,value))*100)/100;if(next===zoom)return;
  const r=viewport.getBoundingClientRect(),x=anchor?.clientX-r.left||viewport.clientWidth/2,y=anchor?.clientY-r.top||viewport.clientHeight/2,ratio=next/zoom;
  const sx=(viewport.scrollLeft+x)*ratio-x,sy=(viewport.scrollTop+y)*ratio-y;zoom=next;render();viewport.scrollLeft=sx;viewport.scrollTop=sy;
}
function fitCanvas(){const right=Math.max(900,...doc.nodes.map(n=>LEFT+n.x+n.width+50)),bottom=TOP+Math.max(1,doc.lanes.length)*ROW+20;zoom=Math.max(.3,Math.min(1,(viewport.clientWidth-56)/right,(viewport.clientHeight-40)/bottom));zoom=Math.round(zoom*100)/100;render();viewport.scrollTo(0,0);}
viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();changeZoom(zoom*(e.deltaY>0?.92:1.08),e);}},{passive:false});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>5*1024*1024)throw Error('文件过大，请选择小于 5MB 的流程 JSON。');const imported=validateDocument(JSON.parse(await file.text()));mutate(()=>{doc=imported;selected=null;},'已打开流程文件');fitCanvas();}catch(err){toast(err instanceof SyntaxError?'JSON 文件无法解析，当前画板未改变。':err.message);}finally{e.target.value='';}
});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportedSVG(){
  const copy=svg.cloneNode(true);copy.querySelectorAll('.port,.resize-handle,.selected-outline,.lane-outline,.edge-hit,.lane-more,.drop-target').forEach(n=>n.remove());
  copy.querySelectorAll('.node-shape').forEach(n=>n.remove());
  const w=Math.max(900,...doc.nodes.map(n=>LEFT+n.x+n.width+65)),h=TOP+Math.max(1,doc.lanes.length)*ROW+24;
  copy.setAttribute('viewBox',`0 0 ${w} ${h}`);copy.setAttribute('width',w);copy.setAttribute('height',h);copy.setAttribute('xmlns',NS);copy.style.background='white';
  // Export all lanes at a consistent, compact width independent of scroll position.
  copy.querySelectorAll('[data-lane]>rect').forEach(r=>r.setAttribute('width',w-2));copy.querySelectorAll('[data-lane]>g.lane-grip').forEach(g=>g.remove());
  const bg=el('rect',{x:0,y:0,width:w,height:h,fill:'#ffffff'});copy.insertBefore(bg,copy.firstChild);const title=el('title');title.textContent=doc.title;copy.insertBefore(title,copy.firstChild);
  return {xml:new XMLSerializer().serializeToString(copy),w,h};
}
async function exportFile(type){
  finishEditing();const name=(doc.title||'网络流程图').replace(/[<>:"/\\|?*]/g,'_');
  if(type==='json'){download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),name+'.json');toast('已导出可编辑的流程 JSON');return;}
  const {xml,w,h}=exportedSVG(),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  if(type==='svg'){download(blob,name+'.svg');toast('已导出 SVG');return;}
  try{const scale=Math.min(2,12000/w,12000/h,Math.sqrt(32000000/(w*h))),canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d'),img=new Image(),url=URL.createObjectURL(blob);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});ctx.scale(scale,scale);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!output)throw Error();download(output,name+'.png');toast('已导出 PNG');}catch{toast('图片导出失败，请尝试 SVG 格式。');}
}
function exampleDocument(){
  const d=createDocument();d.title='通信与计算重叠示例';
  const add=(lane,shape,x,w,text)=>{const n=makeNode(shape,d.lanes[lane].id,x,text);n.width=w;d.nodes.push(n);return n;};
  const a=add(0,'rounded',170,180,'MatMul · 计算 A'),b=add(0,'rounded',370,210,'Attention · 计算 B'),c=add(0,'rounded',810,180,'MatMul · 计算 C');
  const r=add(1,'capsule',370,225,'AllReduce'),g=add(1,'parallelogram',610,180,'AllGather');
  const h=add(2,'rect',25,120,'H2D 拷贝'),o=add(2,'rect',610,150,'D2H 拷贝');
  addEdge(d,h.id,'right',a.id,'left');addEdge(d,a.id,'right',r.id,'left');addEdge(d,r.id,'right',c.id,'left');addEdge(d,b.id,'right',o.id,'left');addEdge(d,g.id,'right',c.id,'left');return d;
}
// A read-only snapshot interface makes browser verification independent of DOM details.
window.flowApp=Object.freeze({getDocument:()=>clone(doc)});
renderLibrary();render();hydrateIcons();
