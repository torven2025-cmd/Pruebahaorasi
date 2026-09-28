const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
let W=0,H=0;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;clampCamera();}
window.addEventListener("resize",resize);resize();

const TILE=32,MAP=48;
let camera={x:MAP*TILE/2,y:MAP*TILE/2,zoom:1};
let frame=0;
let resources={gold:1500,elixir:1500,gems:50,trophies:0};
let buildings=[],obstacles=[],villagers=[],troops=[];
let selectedId=null,buildMode=false,pendingType=null,pendingX=0,pendingY=0,pendingExistingId=null;
let dragging=false,moved=false,gestureMoved=false;
let pointerStart={x:0,y:0},cameraStart={x:0,y:0};
const pointers=new Map();
let pinch={active:false,startDistance:0,startZoom:1,worldX:0,worldY:0};
let combat=null;

const BUILDINGS={
 townhall:{name:"Ayuntamiento",icon:"🏰",w:4,h:4,hp:1500,gold:0,elixir:0,color:"#59636e"},
 builder:{name:"Choza de constructor",icon:"🏠",w:2,h:2,hp:250,gold:250,elixir:0,color:"#c58b38"},
 camp:{name:"Campamento",icon:"⛺",w:3,h:3,hp:400,capacity:10,gold:300,elixir:100,color:"#8b5a2b"},
 barracks:{name:"Cuartel",icon:"⚔️",w:3,h:3,hp:500,gold:450,elixir:250,color:"#a84300"},
 goldmine:{name:"Mina de oro",icon:"⛏️",w:3,h:3,hp:350,gold:250,elixir:0,color:"#c99718"},
 elixirpump:{name:"Extractor de elixir",icon:"💧",w:3,h:3,hp:350,gold:300,elixir:0,color:"#75429b"},
 goldstorage:{name:"Almacén de oro",icon:"🪙",w:3,h:3,hp:600,gold:500,elixir:0,color:"#b7950b"},
 elixirstorage:{name:"Almacén de elixir",icon:"🫙",w:3,h:3,hp:600,gold:600,elixir:0,color:"#8e44ad"},
 cannon:{name:"Cañón",icon:"💣",w:2,h:2,hp:650,damage:35,range:7,attackSpeed:900,gold:450,elixir:0,color:"#555"},
 archerTower:{name:"Torre de arqueras",icon:"🏹",w:2,h:3,hp:550,damage:25,range:9,attackSpeed:700,gold:600,elixir:100,color:"#8e332f"},
 wall:{name:"Muro",icon:"🧱",w:1,h:1,hp:500,gold:50,elixir:0,color:"#777"}
};
const TROOPS={
 barbarian:{name:"Bárbaro",icon:"🗡️",hp:160,damage:25,speed:48,range:1,cost:30,training:2},
 archer:{name:"Arquera",icon:"🏹",hp:80,damage:35,speed:40,range:5,cost:45,training:3},
 giant:{name:"Gigante",icon:"🧌",hp:600,damage:45,speed:25,range:1,cost:100,training:7}
};
let army={barbarian:3,archer:0,giant:0};

function saveGame(){
 localStorage.setItem("castleKingdomSave",JSON.stringify({resources,buildings,obstacles,army}));
}
function loadGame(){
 const save=localStorage.getItem("castleKingdomSave");
 if(!save){createNewVillage();return}
 try{
  const data=JSON.parse(save);
  resources=data.resources||resources;
  buildings=data.buildings||[];
  obstacles=data.obstacles||[];
  army=data.army||army;
  if(!buildings.length)createNewVillage();
 }catch{createNewVillage();}
}
function createNewVillage(){
 buildings=[];obstacles=[];villagers=[];
 buildings.push({id:1,type:"townhall",x:22,y:22,level:1,hp:1500,maxHp:1500});
 buildings.push({id:2,type:"builder",x:16,y:20,level:1,hp:250,maxHp:250});
 buildings.push({id:3,type:"camp",x:29,y:20,level:1,hp:400,maxHp:400});
 buildings.push({id:4,type:"barracks",x:29,y:25,level:1,hp:500,maxHp:500});
 buildings.push({id:5,type:"goldmine",x:16,y:26,level:1,hp:350,maxHp:350});
 buildings.push({id:6,type:"elixirpump",x:21,y:29,level:1,hp:350,maxHp:350});
 buildings.push({id:7,type:"cannon",x:26,y:17,level:1,hp:650,maxHp:650});
 buildings.push({id:8,type:"archerTower",x:20,y:17,level:1,hp:550,maxHp:550});
 generateObstacles();
 for(let i=0;i<4;i++)villagers.push({x:20+Math.random()*8,y:20+Math.random()*8,targetX:20+Math.random()*8,targetY:20+Math.random()*8,timer:Math.random()*3});
 saveGame();
}
function generateObstacles(){
 for(let i=0;i<75;i++){
  const type=Math.random()<.55?"tree":"rock";let x,y;
  do{x=Math.floor(Math.random()*MAP);y=Math.floor(Math.random()*MAP)}
  while(distance(x,y,24,24)<8||occupied(x,y,1,1));
  obstacles.push({x,y,type,hp:100});
 }
}
function distance(x1,y1,x2,y2){return Math.hypot(x2-x1,y2-y1)}
function getBuilding(id){return buildings.find(b=>b.id===id)}
function getCapacity(){return 10+buildings.filter(b=>b.type==="camp").length*10}
function occupied(x,y,w,h,ignoreId=null){
 if(x<0||y<0||x+w>MAP||y+h>MAP)return true;
 for(const b of buildings){
  if(b.id===ignoreId)continue;
  const d=BUILDINGS[b.type];
  if(x<b.x+d.w&&x+w>b.x&&y<b.y+d.h&&y+h>b.y)return true;
 }
 for(const o of obstacles)if(x<=o.x&&x+w>o.x&&y<=o.y&&y+h>o.y)return true;
 return false;
}

function clampCamera(){
 const viewW=W/Math.max(camera.zoom,.01),viewH=H/Math.max(camera.zoom,.01);
 const halfW=viewW/2,halfH=viewH/2,worldW=MAP*TILE,worldH=MAP*TILE;
 camera.x=worldW<viewW?worldW/2:Math.max(halfW,Math.min(worldW-halfW,camera.x));
 camera.y=worldH<viewH?worldH/2:Math.max(halfH,Math.min(worldH-halfH,camera.y));
}
function setZoom(newZoom,screenX=W/2,screenY=H/2,keepWorld=null){
 const oldZoom=camera.zoom;
 newZoom=Math.max(.55,Math.min(2.2,newZoom));
 if(keepWorld==null)keepWorld=screenToWorld(screenX,screenY);
 camera.zoom=newZoom;
 camera.x=keepWorld.x-(screenX-W/2)/camera.zoom;
 camera.y=keepWorld.y-(screenY-H/2)/camera.zoom;
 clampCamera();
}
function screenToWorld(px,py){return{x:((px-W/2)/camera.zoom)+camera.x,y:((py-H/2)/camera.zoom)+camera.y}}
function pointerToGrid(px,py){const w=screenToWorld(px,py);return{x:Math.floor(w.x/TILE),y:Math.floor(w.y/TILE)}}

function updateUI(){
 document.getElementById("gold").textContent=Math.floor(resources.gold);
 document.getElementById("elixir").textContent=Math.floor(resources.elixir);
 document.getElementById("gems").textContent=Math.floor(resources.gems);
 document.getElementById("trophies").textContent=Math.floor(resources.trophies);
 const th=buildings.find(b=>b.type==="townhall");
 document.getElementById("player-level").textContent=`Ayuntamiento ${th?th.level:1}`;
}
function notify(message){
 const box=document.getElementById("notifications"),el=document.createElement("div");
 el.className="notification";el.textContent=message;box.appendChild(el);
 setTimeout(()=>el.remove(),2500);
}

/* BUILDING MENU */
function openBuildingMenu(id){
 const b=getBuilding(id);if(!b)return;
 selectedId=id;const data=BUILDINGS[b.type];
 document.getElementById("building-icon").textContent=data.icon;
 document.getElementById("building-name").textContent=data.name;
 document.getElementById("building-hp").textContent=`${Math.floor(b.hp)} / ${Math.floor(b.maxHp)}`;
 document.getElementById("building-level").textContent=`Nivel ${b.level}`;
 const up=document.getElementById("upgrade-button");
 up.style.display=(b.type==="townhall"&&b.level>=10)?"none":"block";
 const level=b.level||1;
 const goldCost=Math.floor(data.gold*(level+1)*.8);
 const elixirCost=Math.floor(data.elixir*(level+1)*.8);
 document.getElementById("upgrade-cost").textContent=(goldCost||elixirCost)?`Coste: ${goldCost?goldCost+" 🪙 ":""}${elixirCost?elixirCost+" 💧":""}`:"";
 document.getElementById("building-menu").classList.remove("hidden");
}
function closeBuildingMenu(){selectedId=null;document.getElementById("building-menu").classList.add("hidden")}

function upgradeSelected(){
 const b=getBuilding(selectedId);if(!b)return;
 const data=BUILDINGS[b.type],level=b.level||1;
 const goldCost=Math.floor(data.gold*(level+1)*.8),elixirCost=Math.floor(data.elixir*(level+1)*.8);
 if(resources.gold<goldCost||resources.elixir<elixirCost){notify("❌ Recursos insuficientes.");return}
 resources.gold-=goldCost;resources.elixir-=elixirCost;b.level++;
 b.maxHp=Math.floor(data.hp*(1+(b.level-1)*.35));b.hp=b.maxHp;
 notify(`⬆️ ${data.name} ahora es nivel ${b.level}.`);closeBuildingMenu();saveGame();updateUI();
}
function relocateSelected(){
 const b=getBuilding(selectedId);if(!b)return;
 pendingType=b.type;pendingX=b.x;pendingY=b.y;pendingExistingId=b.id;buildMode=true;
 closeBuildingMenu();showBuildControls();notify("🔄 Coloca el edificio y pulsa CONFIRMAR.");
}
function destroySelected(){
 const b=getBuilding(selectedId);if(!b)return;
 if(b.type==="townhall"){notify("🏰 No puedes destruir tu Ayuntamiento.");return}
 const data=BUILDINGS[b.type];
 resources.gold+=Math.floor(data.gold*.4);resources.elixir+=Math.floor(data.elixir*.4);
 buildings=buildings.filter(item=>item.id!==b.id);
 notify("🗑️ Edificio eliminado.");closeBuildingMenu();saveGame();updateUI();
}

/* SHOP */
function openShop(){document.getElementById("shop").classList.remove("hidden");shopTab("buildings")}
function closeShop(){document.getElementById("shop").classList.add("hidden")}
function shopTab(tab,button){
 if(button){document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));button.classList.add("active")}
 const c=document.getElementById("shop-content");c.innerHTML="";let types=[];
 if(tab==="buildings")types=["builder","camp","barracks","goldmine","elixirpump","goldstorage","elixirstorage"];
 if(tab==="defenses")types=["cannon","archerTower","wall"];
 if(tab==="army"){
  c.innerHTML=`<div class="shop-card"><div class="icon">🗡️</div><h3>Bárbaro</h3><p>Soldado cuerpo a cuerpo resistente.</p><div class="price">30 💧</div></div>
  <div class="shop-card"><div class="icon">🏹</div><h3>Arquera</h3><p>Ataca desde larga distancia.</p><div class="price">45 💧</div></div>
  <div class="shop-card"><div class="icon">🧌</div><h3>Gigante</h3><p>Muchísima vida y daño contra edificios.</p><div class="price">100 💧</div></div>`;return;
 }
 types.forEach(type=>{
  const data=BUILDINGS[type],card=document.createElement("button");card.className="shop-card";
  card.innerHTML=`<div class="icon">${data.icon}</div><h3>${data.name}</h3><p>❤️ ${data.hp}${data.damage?`<br>⚔️ ${data.damage}`:""}</p>
  <div class="price">${data.gold?data.gold+" 🪙 ":""}${data.elixir?data.elixir+" 💧":""}</div>`;
  card.onclick=()=>selectBuilding(type);c.appendChild(card);
 })
}

/* CONSTRUCTION */
function selectBuilding(type){
 const data=BUILDINGS[type];
 if(resources.gold<data.gold||resources.elixir<data.elixir){notify("❌ No tienes suficientes recursos.");return}
 pendingType=type;pendingExistingId=null;
 const center=screenToWorld(W/2,H/2);pendingX=Math.floor(center.x/TILE);pendingY=Math.floor(center.y/TILE);
 buildMode=true;closeShop();showBuildControls();notify(`🏗️ Coloca ${data.name} y pulsa CONFIRMAR.`);
}
function showBuildControls(){document.getElementById("build-controls").classList.remove("hidden")}
function hideBuildControls(){document.getElementById("build-controls").classList.add("hidden")}
function confirmConstruction(){
 if(!pendingType)return;
 const data=BUILDINGS[pendingType];
 if(occupied(pendingX,pendingY,data.w,data.h,pendingExistingId)){notify("❌ No puedes construir aquí.");return}
 if(pendingExistingId!=null){
  const b=getBuilding(pendingExistingId);
  if(!b){cancelConstruction();return}
  b.x=pendingX;b.y=pendingY;
  notify(`🔄 ${data.name} reubicado.`);
 }else{
  if(resources.gold<data.gold||resources.elixir<data.elixir){notify("❌ Recursos insuficientes.");cancelConstruction();return}
  resources.gold-=data.gold;resources.elixir-=data.elixir;
  buildings.push({id:Date.now()+Math.random(),type:pendingType,x:pendingX,y:pendingY,level:1,hp:data.hp,maxHp:data.hp});
  notify(`🏗️ ${data.name} construido.`);
 }
 pendingType=null;pendingExistingId=null;buildMode=false;hideBuildControls();saveGame();updateUI();
}
function cancelConstruction(){pendingType=null;pendingExistingId=null;buildMode=false;hideBuildControls();notify("Construcción cancelada.");}

/* ARMY */
function armyCount(){return Object.values(army).reduce((a,b)=>a+b,0)}
function openArmy(){document.getElementById("army").classList.remove("hidden");renderArmy()}
function closeArmy(){document.getElementById("army").classList.add("hidden")}
function renderArmy(){
 document.getElementById("army-count").textContent=`${armyCount()} / ${getCapacity()}`;
 const c=document.getElementById("army-content");c.innerHTML="";
 Object.entries(TROOPS).forEach(([type,data])=>{
  const card=document.createElement("div");card.className="troop-card";
  card.innerHTML=`<div class="troop-icon">${data.icon}</div><h3>${data.name}</h3><p>❤️ ${data.hp}<br>⚔️ ${data.damage}<br>💧 ${data.cost}</p><button class="train-button">ENTRENAR</button>`;
  card.querySelector("button").onclick=()=>trainTroop(type);c.appendChild(card);
 })
}
function trainTroop(type){
 const data=TROOPS[type];
 if(armyCount()>=getCapacity()){notify("🪖 Campamentos llenos.");return}
 if(resources.elixir<data.cost){notify("💧 Falta elixir.");return}
 resources.elixir-=data.cost;army[type]++;notify(`${data.icon} ${data.name} entrenado.`);renderArmy();updateUI();saveGame();
}

/* ATTACK */
function openAttackMenu(){
 if(armyCount()<=0){notify("⚔️ Necesitas tropas para atacar.");openArmy();return}
 document.getElementById("attack-menu").classList.remove("hidden");
}
function closeAttackMenu(){document.getElementById("attack-menu").classList.add("hidden")}
function startCombat(){closeAttackMenu();createCombat();document.getElementById("combat-ui").classList.remove("hidden");notify("⚔️ ¡Comienza el ataque!")}
function createCombat(){
 const enemyBuildings=[{id:1,type:"townhall",x:22,y:22,level:2,hp:2200,maxHp:2200}];
 [[18,19,"cannon"],[28,19,"cannon"],[19,27,"archerTower"],[28,28,"archerTower"],[22,17,"cannon"]].forEach((d,i)=>{
  const data=BUILDINGS[d[2]];enemyBuildings.push({id:i+2,type:d[2],x:d[0],y:d[1],level:2,hp:data.hp*1.3,maxHp:data.hp*1.3,cooldown:0})
 });
 for(let i=0;i<14;i++)enemyBuildings.push({id:20+i,type:"wall",x:17+(i%7),y:i<7?17:29,level:2,hp:800,maxHp:800});
 const combatTroops=[];
 Object.entries(army).forEach(([type,count])=>{for(let i=0;i<count;i++)combatTroops.push({id:Date.now()+Math.random(),type,x:8+Math.random()*3,y:20+Math.random()*10,hp:TROOPS[type].hp,maxHp:TROOPS[type].hp,target:null,attackCooldown:0})});
 combat={time:180,enemyBuildings,troops:combatTroops,damage:0,enemyDamage:0,ended:false};
 troops=combatTroops;camera.x=24*TILE;camera.y=24*TILE;camera.zoom=.9;clampCamera();
}

function updateCombat(dt){
 if(!combat||combat.ended)return;
 combat.time-=dt;if(combat.time<=0){finishCombat();return}
 combat.troops.forEach(troop=>{
  if(troop.hp<=0)return;
  const data=TROOPS[troop.type],target=findClosestEnemyBuilding(troop);if(!target)return;
  const td=BUILDINGS[target.type],cx=target.x+td.w/2,cy=target.y+td.h/2,dx=cx-troop.x,dy=cy-troop.y,dist=Math.hypot(dx,dy);
  if(dist>data.range){troop.x+=(dx/dist)*data.speed*dt;troop.y+=(dy/dist)*data.speed*dt}
  else{troop.attackCooldown-=dt;if(troop.attackCooldown<=0){target.hp-=data.damage;troop.attackCooldown=.8;combat.damage+=data.damage;if(target.hp<=0)notify(`${data.icon} ¡Edificio destruido!`)}}
 });
 combat.enemyBuildings.forEach(b=>{
  if(b.hp<=0||!BUILDINGS[b.type].damage)return;
  b.cooldown=(b.cooldown||0)-dt;if(b.cooldown>0)return;
  const d=BUILDINGS[b.type];let closest=null,cd=Infinity;
  combat.troops.forEach(t=>{if(t.hp<=0)return;const dd=distance(b.x,b.y,t.x,t.y);if(dd<d.range&&dd<cd){cd=dd;closest=t}});
  if(closest){closest.hp-=d.damage;combat.enemyDamage+=d.damage;b.cooldown=d.attackSpeed/1000}
 });
 let totalHp=0,destroyedHp=0;
 combat.enemyBuildings.forEach(b=>{totalHp+=b.maxHp;destroyedHp+=b.maxHp-Math.max(0,b.hp)});
 combat.damage=Math.floor(destroyedHp/totalHp*100);
 document.getElementById("combat-my-percent").textContent=Math.min(100,combat.damage)+"%";
 document.getElementById("combat-enemy-percent").textContent="0%";
 const remaining=combat.troops.filter(t=>t.hp>0).length;
 if(combat.enemyBuildings.some(b=>b.type==="townhall"&&b.hp<=0))finishCombat(true);
 else if(remaining===0)finishCombat(false);
}
function findClosestEnemyBuilding(troop){
 let best=null,bd=Infinity;
 combat.enemyBuildings.forEach(b=>{if(b.hp<=0)return;const d=distance(troop.x,troop.y,b.x,b.y);if(d<bd){bd=d;best=b}});
 return best;
}
function finishCombat(forceWin=null){
 if(!combat||combat.ended)return;
 combat.ended=true;const destruction=combat.damage;const victory=forceWin!==null?forceWin:destruction>=50;
 let trophies;
 if(victory){trophies=10+Math.floor(destruction/5);resources.trophies+=trophies;resources.gold+=500+destruction*10;resources.elixir+=500+destruction*10}
 else{trophies=-Math.floor(Math.max(1,20-destruction/5));resources.trophies=Math.max(0,resources.trophies+trophies)}
 army={barbarian:0,archer:0,giant:0};
 document.getElementById("combat-ui").classList.add("hidden");document.getElementById("combat-result").classList.remove("hidden");
 document.getElementById("result-title").textContent=victory?"¡VICTORIA!":"DERROTA";
 document.getElementById("result-icon").textContent=victory?"🏆":"💀";
 document.getElementById("result-damage").textContent=destruction+"%";
 document.getElementById("result-trophies").textContent=(trophies>=0?"+":"")+trophies;
 document.getElementById("result-gold").textContent=victory?"+"+(500+destruction*10):"0";
 document.getElementById("result-stars").textContent=destruction>=100?"⭐ ⭐ ⭐":destruction>=67?"⭐ ⭐":destruction>=33?"⭐":"—";
 saveGame();updateUI();
}
function closeCombatResult(){document.getElementById("combat-result").classList.add("hidden");combat=null;troops=[];camera.x=24*TILE;camera.y=24*TILE;camera.zoom=1;renderArmy()}
function surrenderCombat(){finishCombat(false)}

/* DRAW */
function drawMap(){
 const size=MAP*TILE;ctx.fillStyle="#487d2c";ctx.fillRect(0,0,size,size);
 for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const variation=((x*17+y*31)%20);ctx.fillStyle=variation<4?"#4e8430":"#4a7f2d";ctx.fillRect(x*TILE,y*TILE,TILE,TILE)}
 ctx.strokeStyle="#294719";ctx.lineWidth=8;ctx.strokeRect(0,0,size,size);
}
function drawObstacles(){
 obstacles.forEach(o=>{ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="30px Arial";ctx.fillText(o.type==="tree"?"🌳":"🪨",o.x*TILE+TILE/2,o.y*TILE+TILE/2)})
}
function drawBuildings(list=buildings){
 list.forEach(b=>{
  if(b.hp<=0)return;const data=BUILDINGS[b.type],x=b.x*TILE,y=b.y*TILE,w=data.w*TILE,h=data.h*TILE;
  ctx.fillStyle="rgba(0,0,0,.3)";ctx.fillRect(x+5,y+6,w,h);
  ctx.fillStyle=data.color;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=b.id===selectedId?"#ffe600":"#292929";ctx.lineWidth=b.id===selectedId?4:2;ctx.strokeRect(x,y,w,h);
  ctx.font=`${Math.min(w,h)*.65}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(data.icon,x+w/2,y+h/2);
  if(b.level){ctx.fillStyle="#ffe600";ctx.font="11px Arial";ctx.fillText("Nv."+b.level,x+w/2,y+h-8)}
  if(b.hp<b.maxHp){const ratio=Math.max(0,b.hp/b.maxHp);ctx.fillStyle="#111";ctx.fillRect(x,y-7,w,5);ctx.fillStyle=ratio>.5?"#2ecc71":ratio>.25?"#f1c40f":"#e74c3c";ctx.fillRect(x,y-7,w*ratio,5)}
 });
}
function updateVillagers(dt){
 villagers.forEach(v=>{v.timer-=dt;if(v.timer<=0){v.targetX=16+Math.random()*15;v.targetY=16+Math.random()*15;v.timer=2+Math.random()*4}
 const dx=v.targetX-v.x,dy=v.targetY-v.y,d=Math.hypot(dx,dy);if(d>.1){v.x+=dx/d*.4*dt;v.y+=dy/d*.4*dt}})
}
function drawVillagers(){villagers.forEach(v=>{ctx.font="20px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("👷",v.x*TILE,v.y*TILE)})}
function drawCombatTroops(){
 if(!combat)return;
 combat.troops.forEach(t=>{if(t.hp<=0)return;const d=TROOPS[t.type];ctx.font="24px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(d.icon,t.x*TILE,t.y*TILE);
 ctx.fillStyle="#222";ctx.fillRect(t.x*TILE-12,t.y*TILE-20,24,3);ctx.fillStyle="#2ecc71";ctx.fillRect(t.x*TILE-12,t.y*TILE-20,24*Math.max(0,t.hp/t.maxHp),3)})
}
function drawBuildingPreview(){
 if(!buildMode||!pendingType)return;
 const data=BUILDINGS[pendingType],x=pendingX*TILE,y=pendingY*TILE,w=data.w*TILE,h=data.h*TILE,valid=!occupied(pendingX,pendingY,data.w,data.h,pendingExistingId);
 ctx.globalAlpha=.55;ctx.fillStyle=valid?"#2ecc71":"#e74c3c";ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
 ctx.font=`${Math.min(w,h)*.65}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(data.icon,x+w/2,y+h/2);
 ctx.strokeStyle=valid?"#2ecc71":"#e74c3c";ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);
}
function drawCombatMap(){
 ctx.fillStyle="#486f31";ctx.fillRect(0,0,MAP*TILE,MAP*TILE);
 for(let i=0;i<30;i++){const x=(i*17)%MAP,y=(i*29)%MAP;ctx.font="22px Arial";ctx.fillText(i%2?"🌲":"🌿",x*TILE,y*TILE)}
 combat.enemyBuildings.filter(b=>b.type==="wall"&&b.hp>0).forEach(b=>{ctx.fillStyle="#777";ctx.fillRect(b.x*TILE,b.y*TILE,TILE,TILE);ctx.strokeStyle="#333";ctx.strokeRect(b.x*TILE,b.y*TILE,TILE,TILE)});
 drawBuildings(combat.enemyBuildings);drawCombatTroops();
}
function draw(){
 ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(W/2,H/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);drawMap();
 if(combat)drawCombatMap();else{drawObstacles();drawBuildings();drawVillagers();drawBuildingPreview()}
 ctx.restore();
}

/* POINTERS + PINCH ZOOM */
function pointerPos(e){return{x:e.clientX,y:e.clientY}}
function getTwoPointers(){return [...pointers.values()].slice(0,2)}
function startPinch(){
 const [a,b]=getTwoPointers();if(!a||!b)return;
 const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2;
 pinch.active=true;pinch.startDistance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));pinch.startZoom=camera.zoom;
 const world=screenToWorld(midX,midY);pinch.worldX=world.x;pinch.worldY=world.y;gestureMoved=true;dragging=false;
}
function updatePinch(){
 const [a,b]=getTwoPointers();if(!a||!b)return;
 const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2,dist=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
 const z=pinch.startZoom*(dist/pinch.startDistance);
 camera.zoom=Math.max(.55,Math.min(2.2,z));
 camera.x=pinch.worldX-(midX-W/2)/camera.zoom;
 camera.y=pinch.worldY-(midY-H/2)/camera.zoom;
 clampCamera();
}
canvas.addEventListener("pointerdown",e=>{
 canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,pointerPos(e));
 if(pointers.size===2){startPinch();return}
 dragging=true;moved=false;gestureMoved=false;pointerStart={x:e.clientX,y:e.clientY};cameraStart={x:camera.x,y:camera.y};
 if(buildMode){const g=pointerToGrid(e.clientX,e.clientY);pendingX=g.x;pendingY=g.y}
});
canvas.addEventListener("pointermove",e=>{
 if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,pointerPos(e));
 if(pointers.size>=2){updatePinch();return}
 if(!dragging)return;
 const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;
 if(Math.abs(dx)>6||Math.abs(dy)>6){moved=true;gestureMoved=true}
 if(buildMode){
  const g=pointerToGrid(e.clientX,e.clientY);pendingX=g.x;pendingY=g.y;
 }else{
  camera.x=cameraStart.x-dx/camera.zoom;camera.y=cameraStart.y-dy/camera.zoom;clampCamera();
 }
});
function finishPointer(e){
 pointers.delete(e.pointerId);
 if(pointers.size<2)pinch.active=false;
 if(!dragging)return;
 dragging=false;
 if(moved||gestureMoved)return;
 if(buildMode){const g=pointerToGrid(e.clientX,e.clientY);pendingX=g.x;pendingY=g.y;return}
 const g=pointerToGrid(e.clientX,e.clientY);
 const clicked=buildings.find(b=>{const d=BUILDINGS[b.type];return g.x>=b.x&&g.x<b.x+d.w&&g.y>=b.y&&g.y<b.y+d.h});
 if(clicked){openBuildingMenu(clicked.id);return}
 const oi=obstacles.findIndex(o=>o.x===g.x&&o.y===g.y);
 if(oi>=0){const o=obstacles[oi],reward=o.type==="tree"?30:50;resources.gold+=reward;obstacles.splice(oi,1);notify(`🌳 Obstáculo eliminado. +${reward} 🪙`);saveGame();updateUI()}
}
canvas.addEventListener("pointerup",finishPointer);
canvas.addEventListener("pointercancel",finishPointer);
canvas.addEventListener("wheel",e=>{e.preventDefault();const z=camera.zoom*(e.deltaY<0?1.1:.9);setZoom(z,e.clientX,e.clientY)},{passive:false});

/* GAME LOOP */
let lastTime=performance.now();
function update(time){
 const dt=Math.min(.1,(time-lastTime)/1000);lastTime=time;frame++;
 if(frame%60===0&&!combat){
  buildings.forEach(b=>{if(b.type==="goldmine")resources.gold=Math.min(resources.gold+15,999999);if(b.type==="elixirpump")resources.elixir=Math.min(resources.elixir+15,999999)});
  saveGame();updateUI();
 }
 updateVillagers(dt);
 if(combat){updateCombat(dt);document.getElementById("combat-time").textContent=formatTime(Math.ceil(combat.time))}
 draw();requestAnimationFrame(update);
}
function formatTime(seconds){const m=Math.floor(seconds/60),s=seconds%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}

async function toggleFullscreen(){
 try{
  if(!document.fullscreenElement){await document.documentElement.requestFullscreen();if(screen.orientation?.lock)try{await screen.orientation.lock("landscape")}catch{}}
  else await document.exitFullscreen();
 }catch{notify("Tu navegador no permite pantalla completa.")}
}
window.addEventListener("keydown",e=>{
 if(e.key==="Escape"){
  if(buildMode){cancelConstruction();return}
  closeBuildingMenu();closeShop();closeArmy();closeAttackMenu();
 }
 if(e.key==="+"||e.key==="=")setZoom(camera.zoom*1.1);
 if(e.key==="-")setZoom(camera.zoom*.9);
});
loadGame();updateUI();requestAnimationFrame(update);setInterval(saveGame,10000);
