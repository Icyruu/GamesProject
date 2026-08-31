const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const COUNTRIES = [
"Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
"Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
"Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon",
"Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Costa Rica","Croatia",
"Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador",
"Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia",
"Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti",
"Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
"Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia",
"Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia",
"Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco",
"Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand",
"Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine",
"Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
"Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
"Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia",
"Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname",
"Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga",
"Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
"United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const shopCatalog = {
 plates:[
  {id:"default",name:"Traveler",price:0},{id:"explorer",name:"Explorer",price:250},
  {id:"cartographer",name:"Cartographer",price:600},{id:"world",name:"World Traveler",price:1000}
 ],
 fonts:[
  {id:"classic",name:"Classic",price:0},{id:"arcade",name:"Arcade",price:350},
  {id:"typewriter",name:"Typewriter",price:500},{id:"future",name:"Future",price:800}
 ],
 colors:[
  {id:"white",name:"White",price:0},{id:"gold",name:"Gold",price:300},
  {id:"cyan",name:"Cyan",price:300},{id:"mint",name:"Mint",price:450},{id:"pink",name:"Pink",price:450}
 ]
};

function roomCode(){
 let c;
 do { c = crypto.randomBytes(3).toString("hex").toUpperCase(); } while(rooms.has(c));
 return c;
}
function playerTemplate(id,name,host=false){
 return {id,name:name.slice(0,18),host,ready:false,country:null,revealed:[],discovered:false,points:0,finishedPlace:null,custom:{plate:"default",font:"classic",color:"white"},connected:true};
}
function roomView(room,socketId){
 const me=room.players.find(p=>p.id===socketId);
 return {
  room:{code:room.code,shop:getShop(me)},
  me:me?{id:me.id,name:me.name}:null,
  players:room.players.map(p=>({
   id:p.id,name:p.name,ready:p.ready,discovered:p.discovered,
   pattern:room.phase==="playing" ? makePattern(p) : null
  })),
  phase:room.phase,turnPlayerName:room.players[room.turn]?.name||"",
  timeLeft:room.timeLeft,isHost:!!me?.host,myPickNeeded:!!me&&!me.country,
  countries:COUNTRIES,
  ranking:room.players.filter(p=>p.finishedPlace).sort((a,b)=>a.finishedPlace-b.finishedPlace).map(p=>({place:p.finishedPlace,name:p.name,points:p.points}))
 };
}
function getShop(p){
 return {
  points:p?.points||0,
  plates:shopCatalog.plates.map(x=>({...x,owned:p?.custom.plate===x.id||x.price===0})),
  fonts:shopCatalog.fonts.map(x=>({...x,owned:p?.custom.font===x.id||x.price===0})),
  colors:shopCatalog.colors.map(x=>({...x,owned:p?.custom.color===x.id||x.price===0}))
 };
}
function makePattern(p){
 if(!p.country)return "";
 const chars=[...p.country];
 return chars.map((ch,i)=>ch===" "?" ":p.revealed.includes(i)?ch.toUpperCase():"_").join("");
}
function broadcast(room){
 room.players.forEach(p=>io.to(p.id).emit("roomState",roomView(room,p.id)));
}
function feedback(id,text,type){io.to(id).emit("feedback",{text,type});}

function resetGame(room){
 room.phase="picking"; room.turn=0; room.timeLeft=15; room.finished=0;
 room.players.forEach(p=>{p.country=null;p.revealed=[];p.discovered=false;p.finishedPlace=null;p.ready=false});
}
function startPlaying(room){
 room.phase="playing";room.turn=0;room.timeLeft=15;
 room.players.forEach(p=>{p.revealed=[];p.discovered=false;p.finishedPlace=null});
 clearInterval(room.timer);
 room.timer=setInterval(()=>{
   if(room.phase!=="playing")return;
   room.timeLeft--;
   io.to(room.code).emit("gameTick",{timeLeft:room.timeLeft});
   if(room.timeLeft<=0){
     room.timeLeft=15;
     nextTurn(room);
   }
 },1000);
 broadcast(room);
}
function nextTurn(room){
 room.turn=(room.turn+1)%room.players.length;
 let guard=0;
 while(room.players[room.turn].discovered && guard<room.players.length){
   room.turn=(room.turn+1)%room.players.length;guard++;
 }
 room.timeLeft=15;broadcast(room);
}
function finishPlayer(room,p){
 if(p.finishedPlace)return;
 room.finished++;
 p.finishedPlace=room.finished;
 p.points += Math.max(100,500-(room.finished-1)*75);
 if(room.finished===room.players.length-1){
   room.players.filter(x=>!x.finishedPlace).forEach(x=>{x.finishedPlace=room.players.length;});
   room.phase="finished";clearInterval(room.timer);
 }
}

io.on("connection",socket=>{
 socket.on("createRoom",({name,mode})=>{
   const code=roomCode(), room={code,mode:mode||"online",players:[],phase:"lobby",turn:0,timeLeft:15,finished:0,timer:null};
   room.players.push(playerTemplate(socket.id,name,true));rooms.set(code,room);socket.join(code);broadcast(room);
 });
 socket.on("joinRoom",({name,code})=>{
   const room=rooms.get(String(code||"").toUpperCase());
   if(!room)return feedback(socket.id,"Room not found.","wrong");
   if(room.phase!=="lobby")return feedback(socket.id,"That game has already started.","wrong");
   if(room.players.length>=8)return feedback(socket.id,"Room is full.","wrong");
   room.players.push(playerTemplate(socket.id,name,false));socket.join(room.code);broadcast(room);
 });
 socket.on("ready",({code})=>{
   const r=rooms.get(code),p=r?.players.find(x=>x.id===socket.id);if(!p)return;
   p.ready=!p.ready;broadcast(r);
 });
 socket.on("start",({code})=>{
   const r=rooms.get(code),p=r?.players.find(x=>x.id===socket.id);if(!r||!p?.host)return;
   if(r.players.length<2)return feedback(socket.id,"Need at least 2 players.","wrong");
   if(!r.players.every(x=>x.ready||x.host))return feedback(socket.id,"Everyone must be ready.","wrong");
   resetGame(r);broadcast(r);
 });
 socket.on("pickCountry",({code,country})=>{
   const r=rooms.get(code),p=r?.players.find(x=>x.id===socket.id);if(!r||!p||r.phase!=="picking")return;
   const found=COUNTRIES.find(c=>c.toLowerCase()===String(country||"").trim().toLowerCase());
   if(!found)return feedback(socket.id,"❌ Invalid country. Fictional or unknown countries are not allowed.","wrong");
   p.country=found;p.revealed=[];
   if(r.players.every(x=>x.country)){startPlaying(r);}
   else broadcast(r);
 });
 socket.on("guess",({code,targetId,guess})=>{
   const r=rooms.get(code),me=r?.players.find(x=>x.id===socket.id),target=r?.players.find(x=>x.id===targetId);
   if(!r||!me||!target||r.phase!=="playing")return;
   if(r.players[r.turn]?.id!==me.id)return feedback(socket.id,"It's not your turn.","wrong");
   if(target.discovered)return feedback(socket.id,"That player's country is already discovered.","wrong");
   const g=String(guess||"").trim();
   if(!g)return;
   const answer=target.country.toLowerCase();
   if(g.toLowerCase()===answer){
     target.revealed=[...Array([...target.country].length).keys()];target.discovered=true;me.points+=100;
     feedback(socket.id,`🎉 CORRECT! ${target.name}'s country is ${target.country}!`,"correct");
     finishPlayer(r,me);
     if(r.phase==="finished"){broadcast(r);return;}
     nextTurn(r);return;
   }
   if([...g].length===1){
     const letter=g.toLowerCase(), chars=[...target.country], indexes=[];
     chars.forEach((c,i)=>{if(c.toLowerCase()===letter)indexes.push(i)});
     if(indexes.length){
       target.revealed=[...new Set(target.revealed.concat(indexes))];
       me.points+=10;
       feedback(socket.id,`🟢 "${g.toUpperCase()}" is in the country!`,"correct");
       if(target.revealed.length===chars.filter(c=>c!==" ").length){
         target.discovered=true;finishPlayer(r,me);
       }
       if(r.phase==="finished"){broadcast(r);return;}
       nextTurn(r);return;
     }
   }
   feedback(socket.id,`🔴 "${g}" is wrong. No letter revealed.`,"wrong");
   nextTurn(r);
 });
 socket.on("buy",({type,itemId})=>{
   const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id)),p=r?.players.find(x=>x.id===socket.id);if(!p)return;
   const list=shopCatalog[type];const item=list?.find(x=>x.id===itemId);if(!item)return;
   if(item.price>p.points)return feedback(socket.id,"Not enough points.","wrong");
   if(type==="plates")p.custom.plate=item.id;
   if(type==="fonts")p.custom.font=item.id;
   if(type==="colors")p.custom.color=item.id;
   p.points-=item.price;
   io.to(socket.id).emit("shopState",getShop(p));broadcast(r);
 });
 socket.on("backLobby",({code})=>{
   const r=rooms.get(code);if(!r)return;clearInterval(r.timer);r.phase="lobby";r.turn=0;r.timeLeft=15;r.players.forEach(p=>{p.ready=false;p.country=null;p.revealed=[];p.discovered=false;p.finishedPlace=null});broadcast(r);
 });
 socket.on("leave",({code})=>{
   const r=rooms.get(code);if(!r)return;
   r.players=r.players.filter(p=>p.id!==socket.id);socket.leave(code);
   if(!r.players.length){clearInterval(r.timer);rooms.delete(code);return;}
   r.players[0].host=true;broadcast(r);
 });
 socket.on("disconnect",()=>{
   for(const r of rooms.values()){
     const p=r.players.find(x=>x.id===socket.id);
     if(!p)continue;
     p.connected=false;
     if(r.phase==="lobby")r.players=r.players.filter(x=>x.id!==socket.id);
     if(!r.players.length){clearInterval(r.timer);rooms.delete(r.code);continue}
     if(!r.players.some(x=>x.host))r.players[0].host=true;
     broadcast(r);
   }
 });
});

server.listen(PORT, "0.0.0.0", ()=>console.log(`Guess My Country running on port ${PORT}`));