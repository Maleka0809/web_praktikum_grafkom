/* =====================================================
   EVENT-BASED
   Player bergerak karena event keyboard.
===================================================== */
const eventCanvas=document.getElementById("eventCanvas");
const eventCtx=eventCanvas.getContext("2d");
const EW=eventCanvas.width,EH=eventCanvas.height;

const eventPlayer={x:600,y:360,w:52,h:52,speed:5,color:"#22d3ee"};
const eventBall={x:420,y:270,r:25,vx:3,vy:2.5,color:"#f472b6"};
const eventMouse={x:0,y:0,inside:false};
const eventCircles=[];
const eventMoving=[
{x:100,y:530,vx:1.7,c:"#8b5cf6"},
{x:250,y:545,vx:2.4,c:"#facc15"},
{x:400,y:520,vx:1.2,c:"#22c55e"}];
const eventColors=["#22d3ee","#8b5cf6","#f472b6","#facc15","#22c55e"];
let eventColorIndex=0,eventPaused=false,eventCount=0;

const eid=id=>document.getElementById(id);

function eventDraw(){
    eventCtx.fillStyle="#07111f";eventCtx.fillRect(0,0,EW,EH);
    eventCtx.strokeStyle="rgba(255,255,255,.04)";eventCtx.lineWidth=1;
    for(let x=0;x<EW;x+=40){eventCtx.beginPath();eventCtx.moveTo(x,0);eventCtx.lineTo(x,EH);eventCtx.stroke();}
    for(let y=0;y<EH;y+=40){eventCtx.beginPath();eventCtx.moveTo(0,y);eventCtx.lineTo(EW,y);eventCtx.stroke();}

    eventCtx.fillStyle="#6366f1";eventCtx.fillRect(80,90,170,105);
    eventCtx.beginPath();eventCtx.moveTo(310,110);eventCtx.lineTo(500,185);eventCtx.strokeStyle="#f43f5e";eventCtx.lineWidth=4;eventCtx.stroke();

    eventCtx.beginPath();eventCtx.arc(700,135,58,0,Math.PI*2);eventCtx.fillStyle="#22c55e";eventCtx.fill();

    eventCtx.beginPath();eventCtx.moveTo(130,360);eventCtx.lineTo(65,490);eventCtx.lineTo(195,490);eventCtx.closePath();eventCtx.fillStyle="#f97316";eventCtx.fill();

    eventCtx.beginPath();eventCtx.arc(eventBall.x,eventBall.y,eventBall.r,0,Math.PI*2);
    eventCtx.fillStyle=eventBall.color;eventCtx.shadowBlur=25;eventCtx.shadowColor=eventBall.color;eventCtx.fill();eventCtx.shadowBlur=0;

    eventCircles.forEach(c=>{eventCtx.beginPath();eventCtx.arc(c.x,c.y,c.r,0,Math.PI*2);eventCtx.fillStyle=c.color;eventCtx.fill();});
    eventMoving.forEach(o=>{eventCtx.beginPath();eventCtx.arc(o.x,o.y,10,0,Math.PI*2);eventCtx.fillStyle=o.c;eventCtx.fill();});

    eventCtx.fillStyle=eventPlayer.color;eventCtx.shadowBlur=20;eventCtx.shadowColor=eventPlayer.color;eventCtx.fillRect(eventPlayer.x,eventPlayer.y,eventPlayer.w,eventPlayer.h);eventCtx.shadowBlur=0;

    eventCtx.fillStyle="#dcecff";eventCtx.font="16px monospace";eventCtx.fillText("Canvas 960 × 600 · EVENT-BASED",18,28);
    eventCtx.fillStyle="#22d3ee";eventCtx.fillText(`Mouse: (${Math.round(eventMouse.x)}, ${Math.round(eventMouse.y)})`,18,575);
}

function eventAnimationUpdate(){
    if(eventPaused)return;
    eventBall.x+=eventBall.vx;eventBall.y+=eventBall.vy;
    if(eventBall.x<eventBall.r||eventBall.x>EW-eventBall.r)eventBall.vx*=-1;
    if(eventBall.y<eventBall.r||eventBall.y>EH-eventBall.r)eventBall.vy*=-1;
    eventMoving.forEach(o=>{o.x+=o.vx;if(o.x<20||o.x>EW-20)o.vx*=-1;});
}

function eventFrame(){eventAnimationUpdate();eventDraw();requestAnimationFrame(eventFrame);}

eventCanvas.addEventListener("mousemove",e=>{
    const r=eventCanvas.getBoundingClientRect();
    eventMouse.x=(e.clientX-r.left)*EW/r.width;
    eventMouse.y=(e.clientY-r.top)*EH/r.height;
    eventMouse.inside=true;
    eid("eventMouseText").textContent=`(${Math.round(eventMouse.x)}, ${Math.round(eventMouse.y)})`;
});
eventCanvas.addEventListener("mouseleave",()=>eventMouse.inside=false);

eventCanvas.addEventListener("click",()=>{
    eventColorIndex=(eventColorIndex+1)%eventColors.length;
    eventBall.color=eventColors[eventColorIndex];
    eventCircles.push({x:eventMouse.x,y:eventMouse.y,r:14,color:eventColors[(eventColorIndex+2)%eventColors.length]});
});

window.addEventListener("keydown",e=>{
    eventCount++;eid("eventText").textContent=`${eventCount} keydown`;
    const k=e.key.toLowerCase(),s=eventPlayer.speed;

    if(e.key==="ArrowRight"||k==="d")eventPlayer.x+=s;
    if(e.key==="ArrowLeft"||k==="a")eventPlayer.x-=s;
    if(e.key==="ArrowUp"||k==="w")eventPlayer.y-=s;
    if(e.key==="ArrowDown"||k==="s")eventPlayer.y+=s;

    if(k==="p")eventTogglePause();
    if(k==="r")eventReset();
    if(k==="c"){eventColorIndex=(eventColorIndex+1)%eventColors.length;eventBall.color=eventColors[eventColorIndex];}

    eventPlayer.x=Math.max(0,Math.min(EW-eventPlayer.w,eventPlayer.x));
    eventPlayer.y=Math.max(0,Math.min(EH-eventPlayer.h,eventPlayer.y));
    eid("eventKeysText").textContent=e.key;
});
window.addEventListener("keyup",()=>eid("eventKeysText").textContent="none");

function eventTogglePause(){
    eventPaused=!eventPaused;
    eid("eventMode").textContent=eventPaused?"PAUSED":"EVENT MODE";
    eid("eventPause").textContent=eventPaused?"Resume (P)":"Pause (P)";
}
function eventReset(){
    eventPlayer.x=600;eventPlayer.y=360;eventBall.x=420;eventBall.y=270;eventBall.vx=3;eventBall.vy=2.5;eventCircles.length=0;eventPaused=false;
    eid("eventMode").textContent="EVENT MODE";eid("eventPause").textContent="Pause (P)";
}
eid("eventPause").onclick=eventTogglePause;
eid("eventReset").onclick=eventReset;
eid("eventClear").onclick=()=>eventCircles.length=0;

eventDraw();requestAnimationFrame(eventFrame);
