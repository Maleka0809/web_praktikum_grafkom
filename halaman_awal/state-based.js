/* =====================================================
   STATE-BASED
   Posisi player diperbarui berdasarkan state setiap frame.
===================================================== */
const stateCanvas=document.getElementById("graphicsCanvas");
const stateCtx=stateCanvas.getContext("2d");
const SW=stateCanvas.width, SH=stateCanvas.height;

const statePlayer={x:600,y:360,w:52,h:52,speed:5,color:"#f97316"};
const stateBall={x:420,y:270,r:25,vx:3,vy:2.5,color:"#8b5cf6"};
const stateMouse={x:0,y:0};
const stateKeys={};
const stateCircles=[];
const stateMoving=[
{x:100,y:530,vx:1.7,c:"#f472b6"},
{x:250,y:545,vx:2.4,c:"#facc15"},
{x:400,y:520,vx:1.2,c:"#22d3ee"}];
const stateColors=["#8b5cf6","#f43f5e","#22c55e","#facc15","#3b82f6"];
let stateColorIndex=0,statePaused=false,stateTrail=false,stateFrames=0;

const sid=id=>document.getElementById(id);
const sclamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function stateClear(){
    if(!stateTrail) stateCtx.clearRect(0,0,SW,SH);
    else {stateCtx.fillStyle="rgba(7,17,31,.13)";stateCtx.fillRect(0,0,SW,SH);}
}

function stateDraw(){
    stateCtx.fillStyle="#07111f";stateCtx.fillRect(0,0,SW,SH);
    stateCtx.strokeStyle="rgba(255,255,255,.04)";stateCtx.lineWidth=1;
    for(let x=0;x<SW;x+=40){stateCtx.beginPath();stateCtx.moveTo(x,0);stateCtx.lineTo(x,SH);stateCtx.stroke();}
    for(let y=0;y<SH;y+=40){stateCtx.beginPath();stateCtx.moveTo(0,y);stateCtx.lineTo(SW,y);stateCtx.stroke();}

    stateCtx.fillStyle="#3b82f6";stateCtx.fillRect(80,90,170,105);
    stateCtx.beginPath();stateCtx.moveTo(310,110);stateCtx.lineTo(500,185);stateCtx.strokeStyle="#f43f5e";stateCtx.lineWidth=4;stateCtx.stroke();

    stateCtx.beginPath();stateCtx.arc(700,135,58,0,Math.PI*2);stateCtx.fillStyle="#22c55e";stateCtx.fill();

    stateCtx.beginPath();stateCtx.moveTo(130,360);stateCtx.lineTo(65,490);stateCtx.lineTo(195,490);stateCtx.closePath();stateCtx.fillStyle="#f97316";stateCtx.fill();

    stateCtx.beginPath();stateCtx.arc(stateBall.x,stateBall.y,stateBall.r,0,Math.PI*2);
    stateCtx.fillStyle=stateBall.color;stateCtx.shadowBlur=25;stateCtx.shadowColor=stateBall.color;stateCtx.fill();stateCtx.shadowBlur=0;

    stateCtx.beginPath();stateCtx.arc(stateMouse.x,stateMouse.y,18,0,Math.PI*2);stateCtx.strokeStyle="#22d3ee";stateCtx.stroke();

    stateCircles.forEach(c=>{stateCtx.beginPath();stateCtx.arc(c.x,c.y,c.r,0,Math.PI*2);stateCtx.fillStyle=c.color;stateCtx.fill();});
    stateMoving.forEach(o=>{stateCtx.beginPath();stateCtx.arc(o.x,o.y,10,0,Math.PI*2);stateCtx.fillStyle=o.c;stateCtx.fill();});

    stateCtx.fillStyle=statePlayer.color;stateCtx.shadowBlur=20;stateCtx.shadowColor=statePlayer.color;stateCtx.fillRect(statePlayer.x,statePlayer.y,statePlayer.w,statePlayer.h);stateCtx.shadowBlur=0;

    stateCtx.fillStyle="#dcecff";stateCtx.font="16px monospace";stateCtx.fillText("Canvas 960 × 600 · STATE-BASED",18,28);
    stateCtx.fillStyle="#22d3ee";stateCtx.fillText(`Mouse: (${Math.round(stateMouse.x)}, ${Math.round(stateMouse.y)})`,18,575);
}

function stateUpdatePlayer(){
    const s=Number(sid("speed").value);
    if(stateKeys.ArrowLeft||stateKeys.a)statePlayer.x-=s;
    if(stateKeys.ArrowRight||stateKeys.d)statePlayer.x+=s;
    if(stateKeys.ArrowUp||stateKeys.w)statePlayer.y-=s;
    if(stateKeys.ArrowDown||stateKeys.s)statePlayer.y+=s;
    statePlayer.x=sclamp(statePlayer.x,0,SW-statePlayer.w);
    statePlayer.y=sclamp(statePlayer.y,0,SH-statePlayer.h);
}

function stateUpdate(){
    stateUpdatePlayer();
    stateBall.x+=stateBall.vx;stateBall.y+=stateBall.vy;
    if(stateBall.x<stateBall.r||stateBall.x>SW-stateBall.r)stateBall.vx*=-1;
    if(stateBall.y<stateBall.r||stateBall.y>SH-stateBall.r)stateBall.vy*=-1;
    stateMoving.forEach(o=>{o.x+=o.vx;if(o.x<20||o.x>SW-20)o.vx*=-1;});
}

function stateFrame(){
    if(!statePaused){stateClear();stateUpdate();stateDraw();stateFrames++;sid("frameText").textContent=stateFrames;}
    requestAnimationFrame(stateFrame);
}

stateCanvas.addEventListener("mousemove",e=>{
    const r=stateCanvas.getBoundingClientRect();
    stateMouse.x=(e.clientX-r.left)*SW/r.width;
    stateMouse.y=(e.clientY-r.top)*SH/r.height;
    sid("mouseText").textContent=`(${Math.round(stateMouse.x)}, ${Math.round(stateMouse.y)})`;
});

stateCanvas.addEventListener("click",()=>{
    stateColorIndex=(stateColorIndex+1)%stateColors.length;
    stateBall.color=stateColors[stateColorIndex];
    stateCircles.push({x:stateMouse.x,y:stateMouse.y,r:14,color:stateColors[(stateColorIndex+2)%stateColors.length]});
});

window.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    stateKeys[e.key]=true;stateKeys[k]=true;
    sid("keysText").textContent=Object.keys(stateKeys).filter(k=>stateKeys[k]).join(" + ")||"none";
    if(!e.repeat){
        if(k==="p")stateTogglePause();
        if(k==="r")stateReset();
        if(k==="c"){stateColorIndex=(stateColorIndex+1)%stateColors.length;stateBall.color=stateColors[stateColorIndex];}
    }
});
window.addEventListener("keyup",e=>{stateKeys[e.key]=false;stateKeys[e.key.toLowerCase()]=false;});

function stateTogglePause(){
    statePaused=!statePaused;
    sid("mode").textContent=statePaused?"PAUSED":"RUNNING";
    sid("pause").textContent=statePaused?"Resume (P)":"Pause (P)";
}
function stateReset(){
    statePlayer.x=600;statePlayer.y=360;stateBall.x=420;stateBall.y=270;stateBall.vx=3;stateBall.vy=2.5;stateCircles.length=0;statePaused=false;
    sid("mode").textContent="RUNNING";sid("pause").textContent="Pause (P)";
}
sid("pause").onclick=stateTogglePause;
sid("reset").onclick=stateReset;
sid("clear").onclick=()=>stateCircles.length=0;
sid("speed").oninput=e=>sid("speedText").textContent=e.target.value;
sid("trail").onchange=e=>stateTrail=e.target.checked;
setInterval(()=>sid("playerText").textContent=`(${Math.round(statePlayer.x)}, ${Math.round(statePlayer.y)})`,80);

stateDraw();requestAnimationFrame(stateFrame);
