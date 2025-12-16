/* ================= CANVAS & SCALING ================= */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const V_W = 400;
const V_H = 700;
let scale = 1;

function resize() {
    const maxH = window.innerHeight * 0.98;
    const maxW = maxH * (V_W / V_H);
    canvas.width = maxW;
    canvas.height = maxH;
    scale = canvas.width / V_W;
}
resize();
window.addEventListener("resize", resize);

/* ================= PLAYER ================= */
const player = { x: V_W/2, y: V_H-100, r: 20, hitboxR: 3, targetX: null, targetY: null };

let pointerLocked = false;

/* ================= ENEMY ================= */
const enemy = { x: V_W/2, y: 80, r: 20, dir: 1, speed: 2, shootCD: 0, mode: 0, timer: 0 };
let bullets = [];

/* ================= INPUT ================= */
let touchActive = false, offsetX = 0, offsetY = 0;

/* ---------------- SCREEN COORDS ---------------- */
function screenToWorld(px, py){ 
    const rect = canvas.getBoundingClientRect(); 
    return {x:(px-rect.left)/scale, y:(py-rect.top)/scale};
}
function nearPlayer(wx, wy){ return Math.hypot(wx-player.x, wy-player.y) < 100; }

/* ---------------- MOUSE + TOUCH ---------------- */
canvas.addEventListener("mousedown", e=>{
    const w = screenToWorld(e.clientX, e.clientY);
    if(nearPlayer(w.x,w.y)){ touchActive=true; offsetX=player.x-w.x; offsetY=player.y-w.y; }
});
canvas.addEventListener("mouseup", ()=>{ touchActive=false; });
canvas.addEventListener("mousemove", e=>{
    if(!touchActive) return;
    const w = screenToWorld(e.clientX, e.clientY);
    player.targetX = w.x + offsetX; player.targetY = w.y + offsetY;
});
canvas.addEventListener("touchstart", e=>{
    const t = e.touches[0]; const w = screenToWorld(t.clientX, t.clientY);
    if(nearPlayer(w.x,w.y)){ touchActive=true; offsetX=player.x-w.x; offsetY=player.y-w.y; }
});
canvas.addEventListener("touchend", ()=>{ touchActive=false; });
canvas.addEventListener("touchmove", e=>{
    if(!touchActive) return;
    const t = e.touches[0]; const w = screenToWorld(t.clientX, t.clientY);
    player.targetX = w.x + offsetX; player.targetY = w.y + offsetY;
});

/* ================= BULLET PATTERNS ================= */
let curvyPhase=0, zig=false;
function pat_single(){ bullets.push({x:enemy.x,y:enemy.y,r:7,speed:6,vx:0,vy:1}); }
function pat_spread(){ const count=12, spread=2; for(let i=0;i<count;i++){ const t=-spread/2+(spread/(count-1))*i; bullets.push({x:enemy.x,y:enemy.y,r:7,speed:5,vx:Math.sin(t),vy:Math.cos(t)}); } }
function pat_curvy(){ const dir=(Math.random()*2-1)*0.25; bullets.push({x:enemy.x,y:enemy.y,r:7,speed:4.7,phase:curvyPhase,dirBias:dir,life:0, update(){this.life++; this.vx=Math.sin(this.life*0.06+this.phase)*0.55+this.dirBias; this.vy=1.1;}}); curvyPhase+=0.18; }
function pat_circle(){ const count=60, spread=7; for(let i=0;i<count;i++){ const t=-spread/2+(spread/(count-1))*i; bullets.push({x:enemy.x,y:enemy.y,r:8,speed:4,vx:Math.sin(t),vy:Math.cos(t)}); } }
function pat_big(){ const count=8, total=Math.PI*2, step=total/count; zig=!zig; for(let i=0;i<count;i++){ let angle=i*step; if(zig) angle+=step/2; bullets.push({x:enemy.x,y:enemy.y,r:60,speed:3,vx:Math.sin(angle),vy:Math.cos(angle)}); } }

/* ================= BEHIND-ENEMY FLASH & PUNISH ================= */
let flashRed=false, punishActive=false, punishTimer=0, flashAlpha=0;

/* ================= RESET FUNCTION ================= */
function resetGame() {
    player.x = V_W/2; player.y = V_H-100; player.targetX = null; player.targetY = null;
    enemy.x = V_W/2; enemy.y = 80; enemy.dir=1; enemy.mode=0; enemy.shootCD=0; enemy.timer=0;
    bullets = []; flashRed=false; punishActive=false; punishTimer=0; flashAlpha=0;
}

/* ================= UPDATE ================= */
function update(){
    // ---------------- PLAYER FOLLOWING ----------------
    if(player.targetX!=null && player.targetY!=null){
        // OLD-STYLE SMOOTH FOLLOW
        player.x += (player.targetX - player.x) * 0.2;
        player.y += (player.targetY - player.y) * 0.2;
    }

    // clamp
    player.x = Math.max(player.r, Math.min(V_W-player.r, player.x));
    player.y = Math.max(player.r, Math.min(V_H-player.r, player.y));

    // enemy movement
    enemy.x += enemy.dir*enemy.speed;
    if(enemy.x<enemy.r || enemy.x>V_W-enemy.r) enemy.dir*=-1;

    // enemy mode switch
    enemy.timer++;
    if(enemy.timer>250 && enemy.mode<5){ enemy.mode=(enemy.mode+1)%5; enemy.timer=0; }

    // behind enemy punish
    if(!punishActive && player.y<enemy.y+1 && enemy.mode<=2){ flashRed=true; flashAlpha=0.5; punishActive=true; punishTimer=0; }
    if(flashRed){ flashAlpha -=0.008; if(flashAlpha<=0){ flashRed=false; flashAlpha=0; enemy.mode=99; enemy.shootCD=6; punishTimer=0; } }
    if(enemy.mode===99){ punishTimer++; if(punishTimer>720){ enemy.mode=0; enemy.shootCD=0; punishActive=false; } }

    // shooting
    enemy.shootCD--;
    if(enemy.shootCD<=0){
        if(enemy.mode===0){ pat_single(); enemy.shootCD=14; }
        else if(enemy.mode===1){ pat_spread(); enemy.shootCD=20; }
        else if(enemy.mode===2){ pat_curvy(); enemy.shootCD=8; }
        else if(enemy.mode===3){ pat_circle(); enemy.shootCD=40; }
        else if(enemy.mode===4){ pat_big(); enemy.shootCD=30; }
        else if(enemy.mode===99){ 
            const count=80, step=Math.PI*2/count;
            for(let i=0;i<count;i++){ let angle=i*step+(Math.random()-0.5)*0.1; bullets.push({x:enemy.x,y:enemy.y,r:10,speed:4,vx:Math.sin(angle),vy:Math.cos(angle)}); }
            enemy.shootCD=6;
        }
    }

    // bullet update
    bullets.forEach(b=>{ if(b.update)b.update(); b.x+=b.vx*b.speed; b.y+=b.vy*b.speed; });
    bullets = bullets.filter(b=>b.y<V_H+100 && b.y>-50);

    // collision
    for(let b of bullets){
        const dx=b.x-player.x, dy=b.y-player.y;
        if(dx*dx+dy*dy<(player.hitboxR+b.r)**2){ resetGame(); }
    }
}

/* ================= DRAW ================= */
function draw(){
    ctx.save(); ctx.scale(scale,scale);
    ctx.clearRect(0,0,V_W,V_H);

    if(flashRed){ ctx.fillStyle=`rgba(255,0,0,${flashAlpha})`; ctx.fillRect(0,0,V_W,V_H); }

    // player
    ctx.fillStyle="rgba(0,255,255,0.45)"; ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="white"; ctx.beginPath(); ctx.arc(player.x,player.y,player.hitboxR,0,Math.PI*2); ctx.fill();

    // enemy
    ctx.fillStyle="red"; ctx.beginPath(); ctx.arc(enemy.x,enemy.y,enemy.r,0,Math.PI*2); ctx.fill();

    // bullets
    ctx.fillStyle="cyan"; bullets.forEach(b=>{ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); });

    ctx.restore();
}

/* ================= GAME LOOP ================= */
function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();