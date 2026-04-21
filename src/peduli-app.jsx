import { useState, useEffect, useRef } from "react";

/* ──────────────────────────────────────────────
   GOOGLE FONTS LOADER
──────────────────────────────────────────────── */
const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
};

/* ──────────────────────────────────────────────
   THEME
──────────────────────────────────────────────── */
const T = {
  primary:    "#1a5da8", primaryDk:  "#0f3d75", primaryLt:  "#2980d4",
  primaryBg:  "#f0f7ff", primaryBrd: "#bfdbfe", primaryPale:"#dbeafe",
  glow:       "#93c5fd", glowMid:    "#60a5fa", glowSoft:   "#bfdbfe",
  accent:     "#f59e0b", accentDk:   "#92400e", accentBg:   "#fffbeb", accentBrd:  "#fde68a",
  heroFrom:   "#0c1e3d", heroMid:    "#0f2d5c", heroTo:     "#14447a",
  surface:    "#f8faff", card:       "#ffffff",
};

/* ──────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────── */
const EXERCISES = [
  { id: "squats",            name: "Squats",           emoji: "🏋️", color: "#1a5da8", description: "Bend knees to 90° then stand" },
  { id: "jumping-jacks",     name: "Jumping Jacks",    emoji: "⭐", color: "#7c3aed", description: "Jump with arms & legs spread wide" },
  { id: "overhead-press",    name: "Overhead Press",   emoji: "💪", color: "#b45309", description: "Push both arms straight overhead" },
  { id: "arm-circles",       name: "Arm Circles",      emoji: "🔄", color: "#6d3fa0", description: "Swing arms in full big circles" },
];

const DAILY_LIMIT = 100;
const TOKEN       = "PEDULI";

// ── Railway backend URL ───────────────────────────────────────────────────────
const REWARD_API_URL = "https://peduli-backend-production.up.railway.app";
const PEDULI_CONTRACT = "0xaE9aBF1090EB04E1b6E83851013C3d8f1189D8C9";

/* ──────────────────────────────────────────────
   ★ DATABASE API HELPERS ★
   These replace localStorage for all user data.
   localStorage is kept only as a session cache
   so the app feels instant.
──────────────────────────────────────────────── */

// Save or update user in Railway PostgreSQL
async function apiSaveUser(user) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/save`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:  user.email,
        name:   user.name,
        wallet: user.wallet || "",
        pin:    user.pin || undefined,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("Could not save user to DB:", err);
    return null;
  }
}

// Load user from Railway PostgreSQL by email
async function apiLoadUser(email) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/${encodeURIComponent(email)}`, {
      headers: { "x-user-email": email },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Normalise DB column names to match what the app expects
    return normaliseUser(data);
  } catch (err) {
    console.error("Could not load user from DB:", err);
    return null;
  }
}

// Get daily remaining from Railway PostgreSQL
async function apiGetDailyRemaining(wallet, exerciseId) {
  if (!wallet) return DAILY_LIMIT;
  try {
    const res  = await fetch(`${REWARD_API_URL}/api/daily/${wallet}/${exerciseId}`);
    const data = await res.json();
    return data.remainingToday ?? DAILY_LIMIT;
  } catch {
    return DAILY_LIMIT;
  }
}

// Send blockchain reward via Railway
async function sendBlockchainReward(userWallet, reps, exerciseId, email) {
  if (!userWallet || reps <= 0) return { success: false, error: "No wallet" };
  try {
    const res  = await fetch(`${REWARD_API_URL}/api/reward`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userWallet, reps, exerciseId, email }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: "Could not reach reward server" };
  }
}
// Login with email + PIN
async function apiLogin(email, pin) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pin }),
    });
    return await res.json();
  } catch { return { error: "Could not reach server. Please try again." }; }
}

// Reset PIN using wallet address
async function apiResetPin(email, wallet) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/reset-pin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, wallet }),
    });
    return await res.json();
  } catch { return { error: "Could not reach server. Please try again." }; }
}

// Change PIN
async function apiChangePin(email, newPin, currentPin) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/change-pin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPin, currentPin }),
    });
    return await res.json();
  } catch { return { error: "Could not reach server. Please try again." }; }
}


// Update existing user profile (name + wallet only)
async function apiUpdateProfile(email, name, wallet, pin) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/users/profile`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, name, wallet, pin }),
    });
    return await res.json();
  } catch { return { error: "Could not reach server." }; }
}
// Admin auth
async function apiAdminLogin(password) {
  try {
    const res = await fetch(`${REWARD_API_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return await res.json();
  } catch { return { error: "Could not reach server." }; }
}

async function apiAdminLogout(token) {
  try {
    await fetch(`${REWARD_API_URL}/api/admin/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
    });
  } catch {}
}
// Normalise raw DB user to app format
function normaliseUser(data) {
  return {
    email:             data.email,
    name:              data.name,
    wallet:            data.wallet || "",
    createdAt:         data.created_at,
    lastActive:        data.last_active,
    totalTokens:       data.total_tokens || 0,
    tokensTransferred: data.tokens_transferred || 0,
    mustChangePin:     data.must_change_pin || false,
    history: (data.history || []).map(h => ({
      date: h.created_at, exerciseId: h.exercise_id,
      reps: h.reps, tokens: h.tokens, txHash: h.tx_hash,
    })),
    dailyCount: {},
  };
}

/* ──────────────────────────────────────────────
   LOCAL CACHE HELPERS
   localStorage is now just a fast cache so the
   app feels instant — truth lives in the DB.
──────────────────────────────────────────────── */
const load     = k     => { try { return JSON.parse(localStorage.getItem("pdl_" + k)); } catch { return null; } };
const save     = (k,v) => localStorage.setItem("pdl_" + k, JSON.stringify(v));
const todayKey = ()    => new Date().toISOString().split("T")[0];

/* ──────────────────────────────────────────────
   WALLET VALIDATION
──────────────────────────────────────────────── */
const WALLET_REGEX  = /^0x[0-9a-fA-F]{40}$/;
const isValidWallet = addr => WALLET_REGEX.test(addr);
const walletStatus  = addr => {
  if (!addr) return null;
  if (!addr.startsWith("0x")) return "noprefix";
  const hex = addr.slice(2);
  if (hex.length < 40 && /^[0-9a-fA-F]*$/.test(hex)) return "short";
  if (hex.length > 40) return "long";
  if (!/^[0-9a-fA-F]+$/.test(hex)) return "badchars";
  return "valid";
};

/* ──────────────────────────────────────────────
   MATH HELPERS
──────────────────────────────────────────────── */
function calcAngle(a, b, c) {
  let r = Math.atan2(c.y-b.y, c.x-b.x) - Math.atan2(a.y-b.y, a.x-b.x);
  let d = Math.abs(r*180/Math.PI);
  return d > 180 ? 360-d : d;
}
function dist2D(a, b) { return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); }

/* ──────────────────────────────────────────────
   REP DETECTOR
──────────────────────────────────────────────── */
class RepDetector {
  constructor(id) { this.id=id; this.state="ready"; this.count=0; this.feedback="Get into position!"; this.x={}; }
  process(lm) {
    if (!lm||lm.length<33) return {count:this.count,feedback:this.feedback};
    ({squats:()=>this._squat(lm),"jumping-jacks":()=>this._jj(lm),"standing-march":()=>this._march(lm),
      "overhead-press":()=>this._ohp(lm),"side-leg-raises":()=>this._sideLeg(lm),
      "calf-raises":()=>this._calf(lm),"arm-circles":()=>this._armCircle(lm),
      "bicycle-crunches":()=>this._bicycle(lm)})[this.id]?.();
    return {count:this.count,feedback:this.feedback};
  }
  _squat(lm){const a=calcAngle(lm[23],lm[25],lm[27]);if(a>160&&this.state==="down"){this.count++;this.state="up";this.feedback=`✅ ${this.count} reps! Squat again`;}else if(a<90){this.state="down";this.feedback="⬆️ Now stand back up!";}else if(a>160){this.state="up";this.feedback="⬇️ Bend knees to squat down";}else this.feedback=a>130?"⬇️ Go lower...":"⬆️ Almost there...";}
  _jj(lm){const open=lm[15].y<lm[11].y&&lm[16].y<lm[12].y&&Math.abs(lm[27].x-lm[28].x)>0.22;if(open&&this.state!=="open"){this.state="open";this.feedback="⬇️ Close arms & feet together!";}else if(!open&&this.state==="open"){this.count++;this.state="closed";this.feedback=`✅ ${this.count} reps! Open up!`;}else if(this.state!=="open")this.feedback="⭐ Jump: arms up & legs wide!";}
  _march(lm){if(!this.x.l)this.x={l:false,r:false};const lH=lm[23].y-lm[25].y>0.07,rH=lm[24].y-lm[26].y>0.07;if(lH&&!this.x.l){this.x.l=true;this.count++;this.feedback=`✅ ${this.count} reps! Right knee!`;}if(!lH)this.x.l=false;if(rH&&!this.x.r){this.x.r=true;this.count++;this.feedback=`✅ ${this.count} reps! Left knee!`;}if(!rH)this.x.r=false;if(!lH&&!rH)this.feedback="🚶 Lift your knees high!";}
  _ohp(lm){const up=lm[15].y<lm[0].y-0.04&&lm[16].y<lm[0].y-0.04,dn=lm[15].y>lm[11].y&&lm[16].y>lm[12].y;if(up&&this.state!=="up"){this.state="up";this.feedback="⬇️ Lower arms to shoulders";}else if(dn&&this.state==="up"){this.count++;this.state="down";this.feedback=`✅ ${this.count} reps! Press up!`;}else if(this.state!=="up")this.feedback="💪 Press both arms overhead!";}
  _sideLeg(lm){const lR=lm[23].x-lm[27].x>0.14,rR=lm[28].x-lm[24].x>0.14;if((lR||rR)&&this.state!=="up"){this.state="up";this.feedback="⬇️ Lower your leg";}else if(!lR&&!rR&&this.state==="up"){this.count++;this.state="down";this.feedback=`✅ ${this.count} reps! Raise again!`;}else if(this.state!=="up")this.feedback="🦵 Raise one leg to the side!";}
  _calf(lm){if(!this.x.base)this.x={base:(lm[23].y+lm[24].y)/2,hist:[]};const y=(lm[23].y+lm[24].y)/2;this.x.hist.push(y);if(this.x.hist.length>8)this.x.hist.shift();const s=this.x.hist.reduce((a,b)=>a+b)/this.x.hist.length,rise=this.x.base-s;if(rise>0.018&&this.state!=="up"){this.state="up";this.feedback="⬇️ Lower heels down";}else if(rise<0.004&&this.state==="up"){this.count++;this.state="down";this.feedback=`✅ ${this.count} reps! Rise again!`;this.x.base=s;}else if(this.state!=="up")this.feedback="🦶 Rise on your tiptoes!";}
  _armCircle(lm){const a=Math.atan2(lm[15].y-lm[11].y,lm[15].x-lm[11].x)*180/Math.PI;if(this.x.la!==undefined){let d=a-this.x.la;if(d>180)d-=360;if(d<-180)d+=360;this.x.tot=(this.x.tot||0)+d;if(Math.abs(this.x.tot)>=360){this.count++;this.x.tot=0;this.feedback=`✅ ${this.count} circles! Keep going!`;}else this.feedback=`🔄 ${Math.round(Math.abs(this.x.tot)/360*100)}% circle...`;}else{this.x={la:a,tot:0};this.feedback="🔄 Make big full arm circles!";}this.x.la=a;}
  _bicycle(lm){if(!this.x.l)this.x={l:false,r:false};const lc=dist2D(lm[13],lm[26])<0.22,rc=dist2D(lm[14],lm[25])<0.22;if(lc&&!this.x.l){this.x.l=true;this.count++;this.feedback=`✅ ${this.count} reps! Other side!`;}if(!lc)this.x.l=false;if(rc&&!this.x.r){this.x.r=true;this.count++;this.feedback=`✅ ${this.count} reps! Other side!`;}if(!rc)this.x.r=false;if(!lc&&!rc)this.feedback="🚴 Bring elbow to opposite knee!";}
}

/* ──────────────────────────────────────────────
   SHARED UI COMPONENTS
──────────────────────────────────────────────── */
function WalletInput({ value, onChange, inputStyle = {}, dark = false }) {
  const status = walletStatus(value);
  const hex    = value ? value.slice(2) : "";
  const statusColor = {
    valid:"#16a34a",short:"#ea580c",long:"#dc2626",badchars:"#dc2626",noprefix:"#dc2626",
  }[status]||(dark?"#64748b":"#94a3b8");
  const statusMsg = !status?null
    :status==="short"   ?`${hex.length}/40 hex characters — ${40-hex.length} more needed`
    :status==="long"    ?`Too long — ${hex.length}/40 hex chars`
    :status==="badchars"?"Invalid characters — only 0–9 and a–f allowed"
    :status==="noprefix"?"Must start with 0x"
    :"Valid Polygon / Ethereum address ✓";
  const borderColor=!status?(dark?"#1e3a5f":"#dbeafe"):status==="valid"?(dark?"#16a34a":"#86efac"):(dark?"#7f1d1d":"#fca5a5");
  return(
    <div>
      <div style={{position:"relative"}}>
        <input value={value} onChange={e=>onChange(e.target.value.trim())} placeholder="0x..." maxLength={42} autoComplete="off" spellCheck={false}
          style={{...inputStyle,fontFamily:"monospace",fontSize:12,border:`1.5px solid ${borderColor}`,paddingRight:48}}/>
        <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:dark?"#0d1424":"#f1f5f9",border:`1px solid ${borderColor}`,borderRadius:6,padding:"2px 6px",pointerEvents:"none"}}>
          <span style={{fontFamily:"monospace",fontSize:10,color:statusColor,fontWeight:700}}>{value.length}/42</span>
        </div>
      </div>
      {statusMsg&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:5}}>
        <span style={{fontSize:12}}>{status==="valid"?"✅":"⚠️"}</span>
        <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:statusColor,fontWeight:600}}>{statusMsg}</span>
      </div>}
      {status==="short"&&hex.length>0&&<div style={{background:dark?"#1e3a5f":"#e2e8f0",borderRadius:999,height:3,marginTop:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(hex.length/40)*100}%`,background:`linear-gradient(90deg,${T.primaryLt},${T.primary})`,borderRadius:999,transition:"width 0.2s"}}/>
      </div>}
    </div>
  );
}

function BottomNav({ page, navigate }) {
  const tabs=[{id:"home",icon:"🏠",label:"Home"},{id:"exercise-select",icon:"🏃",label:"Exercise"},
    {id:"dashboard",icon:"🪙",label:"Rewards"},{id:"profile",icon:"👤",label:"Profile"},{id:"disclaimer",icon:"ℹ️",label:"About"}];
  return(
    <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:"#fff",borderTop:`2px solid ${T.primaryPale}`,display:"flex",zIndex:999,boxShadow:"0 -4px 24px rgba(26,93,168,0.10)"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>navigate(t.id)} style={{flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:page===t.id?T.primary:"#94a3b8",transition:"all 0.2s"}}>
          <span style={{fontSize:20}}>{t.icon}</span>
          <span style={{fontSize:9,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:page===t.id?700:400,letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
          {page===t.id&&<div style={{width:20,height:2,background:T.primary,borderRadius:2,marginTop:2}}/>}
        </button>
      ))}
    </nav>
  );
}

function TokenBadge({ amount, size="md" }) {
  const sz=size==="lg"?{f:26,p:"8px 18px",r:16}:{f:13,p:"4px 10px",r:8};
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:6,background:`linear-gradient(135deg,${T.accentBg},${T.accentBrd})`,border:`1.5px solid ${T.accent}`,borderRadius:sz.r,padding:sz.p,fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:sz.f,color:T.accentDk}}>
      🪙 {amount?.toLocaleString?.()||amount} {TOKEN}
    </span>
  );
}

function Card({ children, style={} }) {
  return <div style={{background:T.card,borderRadius:20,padding:"20px 18px",boxShadow:"0 4px 20px rgba(26,93,168,0.07)",border:`1px solid ${T.primaryPale}`,...style}}>{children}</div>;
}

/* ──────────────────────────────────────────────
   HOME PAGE
──────────────────────────────────────────────── */
function HomePage({ navigate, user }) {
  const total=user?.totalTokens||0;
  const tapRef=useRef(0),tapTimer=useRef(null);
  const handleTitleTap=()=>{
    tapRef.current+=1;clearTimeout(tapTimer.current);
    if(tapRef.current>=7){tapRef.current=0;navigate("admin");return;}
    tapTimer.current=setTimeout(()=>{tapRef.current=0;},3000);
  };
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.heroFrom} 0%,${T.heroMid} 40%,${T.heroTo} 100%)`,padding:"0 0 80px"}}>
      <div style={{padding:"40px 24px 28px",textAlign:"center"}}>
        <img src="/logo.svg" alt="PEDULI" style={{width:90,height:90,marginBottom:8,objectFit:"contain"}}/>
        <h1 onClick={handleTitleTap} style={{fontFamily:"'Unbounded',sans-serif",fontWeight:900,fontSize:32,color:"#fff",margin:"0 0 6px",letterSpacing:"-1px",lineHeight:1.1,cursor:"default",userSelect:"none"}}>PEDULI</h1>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:14,margin:"0 0 20px",fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase"}}>Move · Earn · Empower</p>
        {user?(
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 20px",display:"inline-block",backdropFilter:"blur(8px)"}}>
            <p style={{color:T.glowSoft,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,margin:"0 0 4px"}}>Welcome back, {user.name?.split(" ")[0]}! 👋</p>
            <TokenBadge amount={total} size="lg"/>
          </div>
        ):(
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 20px",backdropFilter:"blur(8px)"}}>
            <p style={{color:T.glowSoft,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,margin:0,lineHeight:1.7}}>🎁 Every rep earns <strong>1 PEDULI token</strong>.<br/>Self-challenger, parent, or community member —<br/>register to save your rewards!</p>
          </div>
        )}
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={{background:"rgba(255,255,255,0.05)",borderRadius:24,padding:"20px 16px",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.10)"}}>
          <h2 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:13,fontWeight:700,margin:"0 0 14px",letterSpacing:"0.05em"}}>CHOOSE YOUR EXERCISE</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {EXERCISES.map(ex=>(
              <button key={ex.id} onClick={()=>navigate("exercise-select",{exercise:ex})}
                style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px 10px",cursor:"pointer",textAlign:"center",transition:"all 0.2s",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <span style={{fontSize:28}}>{ex.emoji}</span>
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:11,color:"#e2e8f0",lineHeight:1.3}}>{ex.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <Card style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",backdropFilter:"blur(8px)"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:12,margin:"0 0 10px",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>How It Works</p>
          {[["💪 Move Your Body","Pick any exercise, complete reps with your camera as witness"],["🪙 Earn PEDULI","1 rep = 1 PEDULI token, up to 100 per exercise per day"],["💸 Your Tokens, Your Value","Hold, exchange on Uniswap, or redeem however you define it"]].map(([t,d])=>(
            <div key={t} style={{marginBottom:10}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,color:"#fff",margin:"0 0 2px"}}>{t}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#94a3b8",margin:0}}>{d}</p>
            </div>
          ))}
        </Card>
      </div>

      <div style={{padding:"16px 16px 0"}}>
        <Card style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",backdropFilter:"blur(8px)"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:12,margin:"0 0 12px",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Who Is PEDULI For?</p>
          {[
            ["🏆","The Self-Challenger","Put your own capital into the PEDULI liquidity pool. The only way to get it back is to earn it through exercise. Time pressure included — others can earn from the same pool too."],
            ["👨‍👩‍👧","Parents & Children","Reward your kids with PEDULI tokens as pocket money for exercise. You define what each token is worth to your family — they build healthy habits and crypto literacy at the same time."],
            ["🤝","Underprivileged Communities","No capital needed. Just a device, internet, and the will to move. Earn PEDULI anytime, exchange it later at market rate on any DEX or CEX."],
            ["🏢","CSR & Corporate Giving","Companies and individuals can contribute to the PEDULI liquidity pool on Uniswap. The deeper the pool, the more token holders benefit — a direct link between giving and impact."],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{display:"flex",gap:12,marginBottom:14,alignItems:"flex-start"}}>
              <div style={{fontSize:24,flexShrink:0,marginTop:2}}>{icon}</div>
              <div>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,color:"#fff",margin:"0 0 3px"}}>{title}</p>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#94a3b8",margin:0,lineHeight:1.6}}>{desc}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{padding:"16px 16px 0"}}>
        <Card style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",backdropFilter:"blur(8px)"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:12,margin:"0 0 8px",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>💧 Support the Liquidity Pool</p>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#94a3b8",margin:"0 0 12px",lineHeight:1.6}}>
            Add PEDULI liquidity on Uniswap to grow the ecosystem. Pair PEDULI with MATIC and earn trading fees while supporting the community.
          </p>
          <a href="https://app.uniswap.org/explore/tokens/polygon/0xae9abf1090eb04e1b6e83851013c3d8f1189d8c9"
            target="_blank" rel="noopener noreferrer"
            style={{display:"block",width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center",textDecoration:"none",boxSizing:"border-box"}}>
            💧 ADD LIQUIDITY ON UNISWAP →
          </a>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#475569",margin:"8px 0 0",textAlign:"center"}}>
            Opens the PEDULI token page on Uniswap. Connect your wallet there to add liquidity or swap.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   EXERCISE SELECT PAGE
──────────────────────────────────────────────── */
function ExerciseSelectPage({ navigate, user, getDailyRemaining }) {
  const [selected,setSelected]=useState(null);
  const [target,setTarget]=useState(20);
  const MIN_REPS = 5;
  const remaining=selected?getDailyRemaining(selected.id):0;
  const maxTarget=Math.min(remaining,100);
  return(
    <div style={{minHeight:"100vh",background:T.surface,paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${T.primary},${T.primaryDk})`,padding:"28px 20px 20px"}}>
        <h1 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:22,margin:0,fontWeight:900}}>Pick Exercise</h1>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:13,margin:"6px 0 0"}}>Every rep earns 1 PEDULI · Max {DAILY_LIMIT} per exercise per day</p>
      </div>
      <div style={{padding:"16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          {EXERCISES.map(ex=>{
            const rem=getDailyRemaining(ex.id),sel=selected?.id===ex.id;
            return(
              <button key={ex.id} onClick={()=>{setSelected(ex);setTarget(Math.max(MIN_REPS,Math.min(20,rem)));}}
                style={{background:sel?ex.color:"#fff",border:sel?`2px solid ${ex.color}`:`2px solid ${T.primaryPale}`,borderRadius:16,padding:"16px 12px",cursor:rem===0?"not-allowed":"pointer",opacity:rem===0?0.4:1,textAlign:"center",transition:"all 0.2s",boxShadow:sel?`0 4px 16px ${ex.color}40`:"none"}}>
                <div style={{fontSize:30,marginBottom:6}}>{ex.emoji}</div>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:sel?"#fff":"#1e293b",margin:"0 0 4px"}}>{ex.name}</p>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:sel?"rgba(255,255,255,0.8)":"#64748b",margin:0}}>{rem===0?"✅ Daily limit done!":`${rem} reps left today`}</p>
              </button>
            );
          })}
        </div>
        {selected&&(
          <Card style={{marginBottom:12}}>
            <h3 style={{fontFamily:"'Unbounded',sans-serif",fontSize:14,color:"#0f172a",margin:"0 0 4px"}}>{selected.emoji} {selected.name}</h3>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#64748b",margin:"0 0 16px"}}>{selected.description}</p>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,color:T.primary,margin:"0 0 8px"}}>Target Reps: <span style={{fontSize:28,color:"#0f172a",fontFamily:"'Unbounded',sans-serif"}}>{target}</span></p>
            <input type="range" min={MIN_REPS} max={maxTarget||MIN_REPS} value={target} onChange={e=>setTarget(+e.target.value)} style={{width:"100%",accentColor:T.primary,marginBottom:12}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#94a3b8"}}>5 reps</span>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#94a3b8"}}>{maxTarget} reps</span>
            </div>
            <div style={{background:T.primaryBg,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:T.primary}}>You will earn:</span>
              <TokenBadge amount={target}/>
            </div>
            {!user&&<p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#92400e",background:T.accentBg,border:`1px solid ${T.accentBrd}`,borderRadius:8,padding:"8px 12px",margin:"0 0 12px"}}>⚠️ Register to save your token rewards!</p>}
            <button onClick={()=>navigate("exercise",{exercise:selected,target})}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",letterSpacing:"0.02em"}}>
              🎬 START EXERCISE
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   EXERCISE PAGE
──────────────────────────────────────────────── */
function ExercisePage({ exercise, targetReps, user, setUser, navigate, addTokens, getDailyRemaining }) {
  const videoRef=useRef(null),canvasRef=useRef(null);
  const checkVideoRef=useRef(null),checkCanvasRef=useRef(null);
  const detectorRef=useRef(new RepDetector(exercise.id));
  const poseRef=useRef(null),cameraRef=useRef(null);
  const checkPoseRef=useRef(null),checkCameraRef=useRef(null);
  const [count,setCount]=useState(0);
  const [feedback,setFeedback]=useState("Loading camera...");
  const [poseReady,setPoseReady]=useState(false);
  const [cameraError,setCameraError]=useState(false);
  const [completed,setCompleted]=useState(false);
  const [tokensEarned,setTokensEarned]=useState(0);
  const [txStatus,setTxStatus]=useState(null);
  const [txHash,setTxHash]=useState(null);
  const [phase,setPhase]=useState("check"); // "check" | "exercise"
  const [bodyDetected,setBodyDetected]=useState(false);
  const [checkReady,setCheckReady]=useState(false);
  const countRef=useRef(0),completedRef=useRef(false),mountedRef=useRef(true);
  const effectiveTarget=Math.min(targetReps,getDailyRemaining(exercise.id));

  const triggerReward=async(exerciseId,repCount)=>{
    // Stop cameras immediately — prevents onResults firing after navigate
    cameraRef.current?.stop?.();
    cameraRef.current = null;
    if(poseRef.current){ try{ poseRef.current.close(); }catch(e){} poseRef.current=null; }
    const result=addTokens(exerciseId,repCount);
    const earned=result?.tokens??repCount;
    if(!mountedRef.current)return;
    setTokensEarned(earned);setCompleted(true);
    if(!user?.wallet){setTxStatus("no-wallet");return;}
    if(earned<=0)return;
    setTxStatus("pending");
    const txResult=await sendBlockchainReward(user.wallet,earned,exerciseId,user.email);
    if(!mountedRef.current)return; // user navigated away — don't update state
    if(txResult.success){
      setTxStatus("success");
      setTxHash(txResult.txHash);
      if(txResult.dailyRemaining!==undefined){
        setUser(prev=>{
          if(!prev)return prev;
          const updated={...prev,serverDailyRemaining:{...prev.serverDailyRemaining,[exerciseId]:txResult.dailyRemaining}};
          save("user",updated);
          return updated;
        });
      }
    }
    else{setTxStatus("failed");}
  };

  // Load MediaPipe scripts once
  useEffect(()=>{
    const loadScript=src=>new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`))return res();
      const s=document.createElement("script");s.src=src;s.crossOrigin="anonymous";s.onload=res;s.onerror=rej;document.head.appendChild(s);
    });
    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"),
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"),
    ]).then(()=>setPoseReady(true)).catch(()=>{setCameraError(true);});
    return()=>{
      mountedRef.current=false;
      cameraRef.current?.stop?.(); cameraRef.current=null;
      if(poseRef.current){ try{ poseRef.current.close(); }catch(e){} poseRef.current=null; }
      checkCameraRef.current?.stop?.(); checkCameraRef.current=null;
      if(checkPoseRef.current){ try{ checkPoseRef.current.close(); }catch(e){} checkPoseRef.current=null; }
    };
  },[]);

  // ── CAMERA CHECK PHASE ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(!poseReady||phase!=="check"||!checkVideoRef.current||!checkCanvasRef.current)return;
    try{
      const pose=new window.Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`});
      pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
      pose.onResults(results=>{
        const canvas=checkCanvasRef.current;if(!canvas)return;
        const ctx=canvas.getContext("2d");
        ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.scale(-1,1);ctx.translate(-canvas.width,0);
        if(results.image)ctx.drawImage(results.image,0,0,canvas.width,canvas.height);
        const detected=!!(results.poseLandmarks&&results.poseLandmarks.length>=25);
        setBodyDetected(detected);
        if(detected){
          window.drawConnectors?.(ctx,results.poseLandmarks,window.POSE_CONNECTIONS,{color:"rgba(41,128,212,0.8)",lineWidth:2});
          window.drawLandmarks?.(ctx,results.poseLandmarks,{color:"#60a5fa",lineWidth:1,radius:3});
        }
        ctx.restore();
        setCheckReady(true);
      });
      checkPoseRef.current=pose;
      const cam=new window.Camera(checkVideoRef.current,{
        onFrame:async()=>{if(checkVideoRef.current)await pose.send({image:checkVideoRef.current});},
        width:640,height:480
      });
      checkCameraRef.current=cam;
      cam.start().catch(()=>{setCameraError(true);});
    }catch{setCameraError(true);}
  },[poseReady,phase]);

  // ── EXERCISE PHASE ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!poseReady||phase!=="exercise"||!videoRef.current||!canvasRef.current)return;
    try{
      const pose=new window.Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`});
      pose.setOptions({modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
      pose.onResults(results=>{
        const canvas=canvasRef.current;if(!canvas)return;
        const ctx=canvas.getContext("2d");
        ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.scale(-1,1);ctx.translate(-canvas.width,0);
        if(results.image)ctx.drawImage(results.image,0,0,canvas.width,canvas.height);
        if(results.poseLandmarks&&mountedRef.current){
          window.drawConnectors?.(ctx,results.poseLandmarks,window.POSE_CONNECTIONS,{color:"rgba(41,128,212,0.65)",lineWidth:2});
          window.drawLandmarks?.(ctx,results.poseLandmarks,{color:"#60a5fa",lineWidth:1,radius:3});
          if(!completedRef.current){
            const r=detectorRef.current.process(results.poseLandmarks);
            if(r){
              setFeedback(r.feedback);
              if(r.count!==countRef.current){
                countRef.current=r.count;setCount(r.count);
                if(r.count>=effectiveTarget&&!completedRef.current){
                  completedRef.current=true;
                  triggerReward(exercise.id,r.count);
                }
              }
            }
          }
        }
        ctx.restore();
      });
      poseRef.current=pose;
      const cam=new window.Camera(videoRef.current,{
        onFrame:async()=>{if(videoRef.current)await pose.send({image:videoRef.current});},
        width:640,height:480
      });
      cameraRef.current=cam;
      cam.start().catch(()=>{setCameraError(true);setFeedback("Camera access denied.");});
    }catch{setCameraError(true);setFeedback("Pose detection failed.");}
  },[poseReady,phase]);

  const startExercise=()=>{
    checkCameraRef.current?.stop?.();
    checkPoseRef.current?.close?.();
    setPhase("exercise");
  };

  const handleStop=()=>{
    cameraRef.current?.stop?.();poseRef.current?.close?.();
    if(count>0&&!completed)triggerReward(exercise.id,count);
    else if(count===0)navigate("exercise-select");
  };

  // ── COMPLETED SCREEN ───────────────────────────────────────────────────────
  if(completed)return(
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.heroFrom},${T.heroMid})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
      <div style={{fontSize:72,marginBottom:16}}>🎉</div>
      <h1 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 8px"}}>Exercise Complete!</h1>
      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:16,margin:"0 0 24px"}}>{count} {exercise.name} completed</p>
      <div style={{background:"rgba(255,255,255,0.10)",borderRadius:20,padding:"20px 32px",marginBottom:16}}>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.accentBrd,fontSize:13,margin:"0 0 8px"}}>TOKENS EARNED</p>
        <TokenBadge amount={tokensEarned} size="lg"/>
        {!user&&<p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fca5a5",fontSize:11,marginTop:10}}>⚠️ Register to save your rewards!</p>}
      </div>
      {txStatus==="pending"&&<div style={{background:"rgba(96,165,250,0.12)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:14,padding:"14px 20px",marginBottom:16,width:"100%",maxWidth:320}}>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:13,margin:0}}>⏳ Sending {tokensEarned} PEDULI to your wallet…</p>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#64748b",fontSize:11,margin:"4px 0 0"}}>This takes 15–30 seconds on Polygon</p>
      </div>}
      {txStatus==="success"&&txHash&&<div style={{background:"rgba(34,197,94,0.10)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:14,padding:"14px 20px",marginBottom:16,width:"100%",maxWidth:320}}>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#4ade80",fontSize:13,margin:"0 0 6px",fontWeight:700}}>✅ {tokensEarned} PEDULI sent to your wallet!</p>
        <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          style={{fontFamily:"monospace",color:T.glow,fontSize:10,wordBreak:"break-all",textDecoration:"none"}}>🔍 View on PolygonScan ↗</a>
      </div>}
      {txStatus==="failed"&&<div style={{background:"rgba(239,68,68,0.10)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:14,padding:"14px 20px",marginBottom:16,width:"100%",maxWidth:320}}>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fca5a5",fontSize:13,margin:"0 0 4px",fontWeight:700}}>⚠️ Blockchain transfer failed</p>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#64748b",fontSize:11,margin:0}}>Your {tokensEarned} tokens are saved. Admin will retry.</p>
      </div>}
      {txStatus==="no-wallet"&&<div style={{background:"rgba(245,158,11,0.10)",border:`1px solid ${T.accentBrd}`,borderRadius:14,padding:"14px 20px",marginBottom:16,width:"100%",maxWidth:320}}>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.accent,fontSize:13,margin:"0 0 4px",fontWeight:700}}>💡 No wallet linked yet</p>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#64748b",fontSize:11,margin:0}}>Add your Polygon wallet in Profile to receive tokens on-chain.</p>
      </div>}
      <button onClick={()=>navigate("exercise-select")} style={{background:T.primary,color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:12}}>DO ANOTHER EXERCISE</button>
      <button onClick={()=>navigate("dashboard")} style={{background:"transparent",color:T.glow,border:`1px solid ${T.primaryLt}`,borderRadius:14,padding:"12px 32px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer"}}>View My Rewards</button>
    </div>
  );

  // ── CAMERA CHECK SCREEN ────────────────────────────────────────────────────
  if(phase==="check")return(
    <div style={{position:"relative",height:"100vh",overflow:"hidden",background:"#000"}}>
      <video ref={checkVideoRef} style={{display:"none"}} playsInline muted/>
      <canvas ref={checkCanvasRef} width={640} height={480} style={{width:"100%",height:"100%",objectFit:"cover"}}/>

      {/* Top bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)",padding:"16px 16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={()=>navigate("exercise-select")} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,padding:"8px 14px",color:"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer"}}>✕ Cancel</button>
        <p style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:12,margin:0,fontWeight:700}}>{exercise.emoji} {exercise.name}</p>
        <div style={{width:60}}/>
      </div>

      {/* Bottom instructions */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,0.92),transparent)",padding:"32px 20px 40px"}}>

        {!checkReady&&(
          <div style={{textAlign:"center",marginBottom:16}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:14,margin:0}}>⏳ Starting camera…</p>
          </div>
        )}

        {checkReady&&(
          <>
            {/* Detection status */}
            <div style={{background:bodyDetected?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",border:`1px solid ${bodyDetected?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,borderRadius:14,padding:"12px 16px",marginBottom:16,textAlign:"center"}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,color:bodyDetected?"#4ade80":"#fca5a5",margin:"0 0 4px"}}>
                {bodyDetected?"✅ Body detected — tracking ready!":"❌ Body not detected"}
              </p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#94a3b8",margin:0}}>
                {bodyDetected
                  ?"You can start your exercise now"
                  :"Step back so your full body is visible in the frame"}
              </p>
            </div>

            {/* Tips */}
            {!bodyDetected&&(
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#94a3b8",margin:0,lineHeight:1.7}}>
                  💡 Tips: Make sure you are well lit · Step back 1–2 metres · Keep your full body in frame · Avoid dark clothing on dark backgrounds
                </p>
              </div>
            )}

            {/* Start button */}
            <button onClick={startExercise} disabled={!bodyDetected}
              style={{width:"100%",background:bodyDetected?`linear-gradient(135deg,${T.primary},${T.primaryLt})`:"rgba(255,255,255,0.1)",color:bodyDetected?"#fff":"#64748b",border:"none",borderRadius:14,padding:"18px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:16,cursor:bodyDetected?"pointer":"not-allowed",transition:"all 0.3s"}}>
              {bodyDetected?"🚀 START EXERCISE":"Waiting for body detection…"}
            </button>
          </>
        )}

        {cameraError&&(
          <div style={{background:"rgba(239,68,68,0.15)",borderRadius:12,padding:"10px 14px",textAlign:"center",marginTop:12}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fca5a5",fontSize:12,margin:0}}>📷 Camera required. Please allow camera access and refresh.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── EXERCISE SCREEN ────────────────────────────────────────────────────────
  return(
    <div style={{position:"relative",height:"100vh",overflow:"hidden",background:"#000"}}>
      <video ref={videoRef} style={{display:"none"}} playsInline muted/>
      <canvas ref={canvasRef} width={640} height={480} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)",padding:"16px 16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={handleStop} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,padding:"8px 14px",color:"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer"}}>✕ Stop</button>
        <p style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:12,margin:0,fontWeight:700}}>{exercise.emoji} {exercise.name}</p>
        <div style={{background:"rgba(0,0,0,0.4)",borderRadius:10,padding:"6px 10px"}}>
          <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.accentBrd,fontSize:11}}>🪙 {count}</span>
        </div>
      </div>
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,0.88),transparent)",padding:"32px 20px 24px"}}>
        <div style={{background:"rgba(255,255,255,0.15)",borderRadius:999,height:6,marginBottom:16,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(100,(count/effectiveTarget)*100)}%`,background:`linear-gradient(90deg,${T.glowMid},${T.primaryLt})`,borderRadius:999,transition:"width 0.4s ease"}}/>
        </div>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{display:"inline-flex",alignItems:"baseline",gap:6}}>
            <span style={{fontFamily:"'Unbounded',sans-serif",fontWeight:900,fontSize:72,color:"#fff",lineHeight:1,textShadow:"0 0 30px rgba(96,165,250,0.55)"}}>{count}</span>
            <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,color:T.glow,fontWeight:600}}>/ {effectiveTarget}</span>
          </div>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:T.glow,margin:"2px 0 0",letterSpacing:"0.1em",textTransform:"uppercase"}}>reps</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.10)",borderRadius:12,padding:"10px 16px",textAlign:"center"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fff",fontSize:14,margin:0,fontWeight:500}}>{feedback}</p>
        </div>
        {cameraError&&<div style={{marginTop:12,background:"rgba(239,68,68,0.15)",borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fca5a5",fontSize:12,margin:0}}>📷 Camera required. Please allow camera access and refresh.</p>
        </div>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   DASHBOARD PAGE
──────────────────────────────────────────────── */
function DashboardPage({ user, navigate }) {
  if(!user)return(
    <div style={{minHeight:"100vh",background:T.surface,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,paddingBottom:80,textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:16}}>🔐</div>
      <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:20,color:"#0f172a",margin:"0 0 8px"}}>Your Rewards Await</h2>
      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,color:"#64748b",margin:"0 0 24px",lineHeight:1.6}}>Register to save your PEDULI tokens, link your crypto wallet, and track every rep you've earned.</p>
      <button onClick={()=>navigate("profile")} style={{background:T.primary,color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>GET STARTED →</button>
    </div>
  );
  const history=user.history||[];
  const today=todayKey();
  const todayTokens=history.filter(h=>h.date?.startsWith(today)).reduce((s,h)=>s+h.tokens,0);
  const byDate={};
  history.forEach(h=>{const d=h.date?.split("T")[0];if(d)byDate[d]=(byDate[d]||0)+h.tokens;});
  const dateEntries=Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7);
  return(
    <div style={{minHeight:"100vh",background:T.surface,paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${T.primary},${T.primaryDk})`,padding:"28px 20px 24px"}}>
        <h1 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:22,margin:"0 0 16px",fontWeight:900}}>My Rewards</h1>
        <div style={{display:"flex",gap:12}}>
          {[["Total Earned",user.totalTokens||0,"PEDULI tokens"],["Today",todayTokens,"PEDULI tokens"]].map(([label,val,sub])=>(
            <div key={label} style={{flex:1,background:"rgba(255,255,255,0.10)",borderRadius:14,padding:"14px"}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:10,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</p>
              <p style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:24,margin:0,fontWeight:900}}>{val.toLocaleString()}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:11,margin:"2px 0 0"}}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"16px"}}>
        <Card style={{marginBottom:12}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔗 Polygon Wallet</p>
          {user.wallet?(
            <>
              <p style={{fontFamily:"monospace",fontSize:11,color:"#0f172a",margin:"0 0 4px",wordBreak:"break-all",background:T.primaryBg,padding:"8px 10px",borderRadius:8,border:`1px solid ${T.primaryPale}`}}>{user.wallet}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",margin:0}}>Tokens will be sent to this address on Polygon chain</p>
            </>
          ):(
            <>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#64748b",margin:"0 0 8px"}}>No wallet linked yet.</p>
              <button onClick={()=>navigate("profile")} style={{background:T.primary,color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer"}}>Add Wallet Address →</button>
            </>
          )}
        </Card>
        <Card style={{marginBottom:12}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>📊 Activity History</p>
          {dateEntries.length===0
            ?<p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>No activity yet. Start exercising! 🏋️</p>
            :dateEntries.map(([date,tokens])=>(
              <div key={date} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.primaryPale}`}}>
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#475569"}}>{date===today?"Today":date}</span>
                <TokenBadge amount={tokens}/>
              </div>
            ))
          }
        </Card>
        {history.length>0&&(
          <Card>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>📝 Recent Sessions</p>
            {history.slice(0,8).map((h,i)=>{
              const ex=EXERCISES.find(e=>e.id===h.exerciseId);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.primaryPale}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>{ex?.emoji}</span>
                    <div>
                      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:12,color:"#0f172a",margin:0}}>{ex?.name}</p>
                      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#94a3b8",margin:0}}>{h.reps} reps</p>
                    </div>
                  </div>
                  <TokenBadge amount={h.tokens}/>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   PROFILE PAGE
──────────────────────────────────────────────── */
function ProfilePage({ user, saveUser, navigate, startMode }) {
  const [mode,setMode] = useState(startMode || (user?"edit":"login"));
  const [form,setForm]             = useState({name:user?.name||"",email:user?.email||"",wallet:user?.wallet||""});
  const [regPin,setRegPin]         = useState("");
  const [regConfirm,setRegConfirm] = useState("");
  const [loginEmail,setLoginEmail] = useState("");
  const [loginPin,setLoginPin]     = useState("");
  const [fEmail,setFEmail]         = useState("");
  const [fWallet,setFWallet]       = useState("");
  const [cpEmail,setCpEmail]       = useState(user?.email||"");
  const [currentPin,setCurrentPin] = useState("");
  const [newPin,setNewPin]         = useState("");
  const [confirmPin,setConfirmPin] = useState("");
  const [busy,setBusy]             = useState(false);
  const [error,setError]           = useState("");
  const [success,setSuccess]       = useState("");
  const clr = () => { setError(""); setSuccess(""); };

  const inp    = {width:"100%",padding:"12px 14px",border:`1.5px solid ${T.primaryPale}`,borderRadius:10,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,color:"#0f172a",outline:"none",boxSizing:"border-box",marginBottom:12};
  const pinInp = {...inp,letterSpacing:"0.5em",fontSize:22,textAlign:"center",fontFamily:"monospace"};

  const handleRegister = async () => {
    if(!form.name.trim())return setError("Please enter your name.");
    if(!form.email.includes("@"))return setError("Please enter a valid email.");
    if(form.wallet){const ws=walletStatus(form.wallet);if(ws!=="valid"){const hex=form.wallet.slice(2);
      if(ws==="noprefix")return setError("Wallet must start with 0x.");
      if(ws==="short")return setError(`Too short — ${hex.length}/40 hex characters.`);
      if(ws==="long")return setError("Too long — must be exactly 42 characters.");
      if(ws==="badchars")return setError("Invalid characters — only 0–9 and a–f after 0x.");}}
    if(!/^\d{4}$/.test(regPin))return setError("PIN must be exactly 4 digits.");
    if(regPin!==regConfirm)return setError("PINs do not match. Please re-enter.");
    clr();setBusy(true);
    const result = await apiSaveUser({...form,email:form.email.trim().toLowerCase(),pin:regPin});
    setBusy(false);
    if(!result||result.error){
      return setError(result?.error||"Could not connect to server. Please check your connection and try again.");
    }
    await saveUser({...form,email:form.email.trim().toLowerCase(),pin:regPin,createdAt:new Date().toISOString(),totalTokens:0});
    navigate("home");
  };

  const handleLogin = async () => {
    if(!loginEmail.includes("@"))return setError("Please enter a valid email.");
    if(!/^\d{4}$/.test(loginPin))return setError("PIN must be 4 digits.");
    clr();setBusy(true);
    const result=await apiLogin(loginEmail.trim().toLowerCase(),loginPin);
    setBusy(false);
    if(result.error)return setError(result.error);
    const u=normaliseUser(result.user);
    if(result.mustChangePin||result.user?.must_change_pin){
      await saveUser(u);
      setCpEmail(loginEmail.trim().toLowerCase());
      setNewPin("");setConfirmPin("");setMode("change-pin");return;
    }
    await saveUser(u);navigate("home");
  };

  const handleForgot = async () => {
    if(!fEmail.includes("@"))return setError("Please enter your registered email.");
    if(!isValidWallet(fWallet))return setError("Please enter your full wallet address (42 characters starting with 0x).");
    clr();setBusy(true);
    const result=await apiResetPin(fEmail.trim().toLowerCase(),fWallet.trim());
    setBusy(false);
    if(result.error)return setError(result.error);
    setSuccess("✅ PIN reset to 0000! Redirecting to sign in…");
    setTimeout(()=>{setLoginEmail(fEmail);setLoginPin("");clr();setMode("login");},2500);
  };

  const handleChangePin = async () => {
    if(!/^\d{4}$/.test(newPin))return setError("PIN must be exactly 4 digits.");
    if(newPin==="0000")return setError("Please choose a different PIN — not 0000.");
    if(newPin!==confirmPin)return setError("PINs do not match.");
    const email=cpEmail||user?.email;
    if(!email)return setError("Session expired. Please sign in again.");
    clr();setBusy(true);
    const result=await apiChangePin(email,newPin,currentPin);
    setBusy(false);
    if(result.error)return setError(result.error);
    setCurrentPin("");setNewPin("");setConfirmPin("");
    if(user){navigate("home");}
    else{const r=await apiLogin(email,newPin);if(r.error){setMode("login");return;}await saveUser(normaliseUser(r.user));navigate("home");}
  };

  const handleSave = async () => {
    if(!form.name.trim())return setError("Please enter your name.");
    if(!/^\d{4}$/.test(currentPin))return setError("Please enter your 4-digit PIN to save changes.");
    if(form.wallet){const ws=walletStatus(form.wallet);if(ws!=="valid"){const hex=form.wallet.slice(2);
      if(ws==="noprefix") return setError("Wallet must start with 0x.");
      if(ws==="short")    return setError(`Too short — ${hex.length}/40 hex characters.`);
      if(ws==="long")     return setError("Too long — must be exactly 42 characters.");
      if(ws==="badchars") return setError("Invalid characters — only 0–9 and a–f after 0x.");}}
    clr();setBusy(true);
    const result = await apiUpdateProfile(user.email, form.name, form.wallet, currentPin);
    setBusy(false);
    if(!result||result.error) return setError(result?.error||"Could not save. Please try again.");
    await saveUser({...user,...form});
    setCurrentPin("");
    setSuccess("✅ Profile saved!");setTimeout(()=>setSuccess(""),3000);
  };

  const handleLogout=()=>{save("user",null);window.location.reload();};

  const titles    ={register:"Register",login:"Welcome Back",forgot:"Reset PIN","change-pin":"Set New PIN",edit:"My Profile"};
  const subtitles ={register:"Exercise. Earn. Exchange. It starts here.",login:"Sign in to restore your rewards",forgot:"Verify your wallet to reset PIN","change-pin":"Choose a new 4-digit PIN",edit:"Manage your account & wallet",register:"Join PEDULI — free, no capital needed"};

  return(
    <div style={{minHeight:"100vh",background:T.surface,paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${T.primary},${T.primaryDk})`,padding:"28px 20px 24px"}}>
        {(mode==="forgot"||mode==="change-pin")&&(
          <button onClick={()=>{clr();setMode(mode==="change-pin"&&user?"edit":"login");}}
            style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,cursor:"pointer",marginBottom:12}}>
            ← Back
          </button>
        )}
        <h1 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:22,margin:0,fontWeight:900}}>{titles[mode]}</h1>
        <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.glow,fontSize:13,margin:"6px 0 0"}}>{subtitles[mode]}</p>
      </div>

      {!user&&(mode==="register"||mode==="login")&&(
        <div style={{display:"flex",margin:"16px 16px 0",background:T.primaryPale,borderRadius:12,padding:4}}>
          {[["register","New User"],["login","Returning User"]].map(([m,label])=>(
            <button key={m} onClick={()=>{clr();setMode(m);}}
              style={{flex:1,padding:"10px",border:"none",borderRadius:9,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,transition:"all 0.2s",
                background:mode===m?T.primary:"transparent",color:mode===m?"#fff":T.primary}}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{padding:16}}>

        {/* LOGIN */}
        {mode==="login"&&(
          <Card>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Sign In</p>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Email Address</label>
            <input style={inp} type="email" value={loginEmail} onChange={e=>{setLoginEmail(e.target.value);clr();}} placeholder="your@email.com"/>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>4-Digit PIN</label>
            <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={loginPin} onChange={e=>{setLoginPin(e.target.value.replace(/\D/g,""));clr();}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••"/>
            <button onClick={()=>{clr();setFEmail(loginEmail);setMode("forgot");}}
              style={{background:"none",border:"none",color:T.primary,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,cursor:"pointer",padding:"4px 0 12px",fontWeight:600}}>
              Forgot PIN? →
            </button>
            {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginBottom:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#dc2626",margin:0}}>{error}</p></div>}
            {success&&<div style={{background:T.primaryBg,border:`1px solid ${T.glow}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:T.primary,margin:0}}>{success}</p></div>}
            <button onClick={handleLogin} disabled={busy}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",opacity:busy?0.7:1}}>
              {busy?"SIGNING IN…":"SIGN IN →"}
            </button>
          </Card>
        )}

        {/* FORGOT PIN */}
        {mode==="forgot"&&(
          <Card>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#64748b",margin:"0 0 16px",lineHeight:1.6}}>
              Enter your registered email and linked wallet address. If they match, your PIN will be reset to <strong>0000</strong>.
            </p>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Email Address</label>
            <input style={inp} type="email" value={fEmail} onChange={e=>{setFEmail(e.target.value);clr();}} placeholder="your@email.com"/>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Your Registered Wallet Address</label>
            <WalletInput value={fWallet} onChange={v=>{setFWallet(v);clr();}} inputStyle={inp}/>
            {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",margin:"8px 0 12px"}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#dc2626",margin:0}}>{error}</p></div>}
            {success&&<div style={{background:T.primaryBg,border:`1px solid ${T.glow}`,borderRadius:10,padding:"10px 14px",margin:"8px 0 12px"}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:T.primary,margin:0}}>{success}</p></div>}
            <button onClick={handleForgot} disabled={busy}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",opacity:busy?0.7:1}}>
              {busy?"VERIFYING…":"RESET MY PIN →"}
            </button>
          </Card>
        )}

        {/* CHANGE PIN */}
        {mode==="change-pin"&&(
          <Card>
            {!user&&<div style={{background:T.accentBg,border:`1px solid ${T.accentBrd}`,borderRadius:10,padding:"10px 12px",marginBottom:16}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:T.accentDk,margin:0}}>⚠️ Your PIN was reset. Please set a new PIN to continue.</p>
            </div>}
            {user&&<>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Current PIN</label>
              <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={e=>{setCurrentPin(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
            </>}
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>New 4-Digit PIN</label>
            <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e=>{setNewPin(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Confirm New PIN</label>
            <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e=>{setConfirmPin(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
            {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginBottom:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#dc2626",margin:0}}>{error}</p></div>}
            <button onClick={handleChangePin} disabled={busy}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:4,opacity:busy?0.7:1}}>
              {busy?"SAVING…":"SET NEW PIN →"}
            </button>
          </Card>
        )}

        {/* REGISTER */}
        {mode==="register"&&(
          <>
            <Card>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Personal Information</p>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Full Name *</label>
              <input style={inp} value={form.name} onChange={e=>{setForm({...form,name:e.target.value});clr();}} placeholder="Your full name"/>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Email Address *</label>
              <input style={inp} type="email" value={form.email} onChange={e=>{setForm({...form,email:e.target.value});clr();}} placeholder="your@email.com"/>
            </Card>
            <Card style={{marginTop:12}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔗 Polygon Wallet Address</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",margin:"0 0 12px"}}>Required to receive PEDULI tokens on Polygon network</p>
              <WalletInput value={form.wallet} onChange={v=>{setForm({...form,wallet:v});clr();}} inputStyle={inp}/>
              <div style={{background:T.accentBg,border:`1px solid ${T.accentBrd}`,borderRadius:10,padding:"10px 12px",marginTop:8}}>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:T.accentDk,margin:0}}>💡 Use MetaMask or Trust Wallet on Polygon network.</p>
              </div>
            </Card>
            <Card style={{marginTop:12}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔐 Set Your PIN</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",margin:"0 0 12px"}}>Choose a 4-digit PIN to secure your account</p>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>4-Digit PIN *</label>
              <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={regPin} onChange={e=>{setRegPin(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Confirm PIN *</label>
              <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={regConfirm} onChange={e=>{setRegConfirm(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
            </Card>
            {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginTop:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#dc2626",margin:0}}>{error}</p></div>}
            <button onClick={handleRegister} disabled={busy}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:14,opacity:busy?0.7:1}}>
              {busy?"CREATING ACCOUNT…":"CREATE ACCOUNT →"}
            </button>
          </>
        )}

        {/* EDIT PROFILE */}
        {mode==="edit"&&user&&(
          <>
            <Card>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Personal Information</p>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Full Name</label>
              <input style={inp} value={form.name} onChange={e=>{setForm({...form,name:e.target.value});clr();}} placeholder="Your full name"/>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Email Address</label>
              <input style={{...inp,background:"#f8faff",color:"#94a3b8",cursor:"not-allowed"}} value={form.email} readOnly/>
            </Card>
            <Card style={{marginTop:12}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔗 Polygon Wallet Address</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",margin:"0 0 12px"}}>Required to receive PEDULI tokens on Polygon network</p>
              <WalletInput value={form.wallet} onChange={v=>{setForm({...form,wallet:v});clr();}} inputStyle={inp}/>
            </Card>
            <Card style={{marginTop:12}}>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:T.primary,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔐 Security</p>
              <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",display:"block",marginBottom:4}}>Enter your PIN to save changes</label>
              <input style={pinInp} type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={e=>{setCurrentPin(e.target.value.replace(/\D/g,""));clr();}} placeholder="••••"/>
              <button onClick={()=>{clr();setCpEmail(user.email);setCurrentPin("");setNewPin("");setConfirmPin("");setMode("change-pin");}}
                style={{width:"100%",background:T.primaryBg,border:`1.5px solid ${T.primaryPale}`,borderRadius:10,padding:"12px 14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:13,color:T.primary,cursor:"pointer",textAlign:"left",marginTop:8}}>
                🔑 Change PIN →
              </button>
            </Card>
            {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginTop:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:"#dc2626",margin:0}}>{error}</p></div>}
            {success&&<div style={{background:T.primaryBg,border:`1px solid ${T.glow}`,borderRadius:10,padding:"10px 14px",marginTop:12}}><p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,color:T.primary,margin:0}}>{success}</p></div>}
            <button onClick={handleSave} disabled={busy}
              style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:14,padding:"16px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:14,opacity:busy?0.7:1}}>
              {busy?"SAVING…":"SAVE CHANGES"}
            </button>
            <button onClick={handleLogout}
              style={{width:"100%",background:"transparent",color:"#ef4444",border:"1.5px solid #fca5a5",borderRadius:14,padding:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer",marginTop:10}}>
              Sign Out
            </button>
          </>
        )}

      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   DISCLAIMER PAGE
──────────────────────────────────────────────── */
function DisclaimerPage() {
  const USE_CASES = [
    {
      emoji: "🔒",
      title: "The Self-Challenger",
      desc: "Add your own capital into the PEDULI liquidity pool on Uniswap. The only way to reclaim value is to earn it — rep by rep. The pressure is real: other users are exercising simultaneously and drawing from the same pool. Move first, or let someone else claim what could have been yours. PEDULI turns procrastination into a financial cost.",
    },
    {
      emoji: "👨‍👩‍👧",
      title: "Parents & Children",
      desc: "Reward your children's physical activity with real digital tokens. The more they exercise, the more PEDULI they earn — straight into their crypto wallet. You decide what each token is worth as pocket money in your household. The blockchain records every rep honestly. When they're ready, they can exchange at market rate too.",
    },
    {
      emoji: "🌍",
      title: "Community Empowerment",
      desc: "No capital required. No gatekeepers. If you have a smartphone and the willingness to move, PEDULI gives you a path to earn. Designed with underprivileged communities in mind — complete exercises, collect tokens, exchange them later on Uniswap or any DEX. Honest reward for honest effort.",
    },
    {
      emoji: "🤝",
      title: "CSR & Liquidity Providers",
      desc: "Companies and individuals can contribute by adding capital to the PEDULI liquidity pool on Uniswap. The stronger the pool, the more meaningful each token reward becomes for every person who earns it through exercise. This is CSR with measurable human impact — every token earned represents a rep completed.",
    },
  ];

  const DISCLAIMERS = [
    [
      "⚠️ Health & Physical Safety",
      "Participation in any exercise programme carries inherent physical risk. PEDULI exercises are for general wellness purposes only. Users must consult a qualified medical professional before beginning any exercise programme, particularly if they have pre-existing medical conditions, injuries, disabilities, or are pregnant. By using PEDULI, you confirm that you are physically capable of performing the selected exercises. WARGATERRA, its developers, and affiliates accept no liability whatsoever for any injury, accident, health complication, or physical harm arising from use of this application.",
    ],
    [
      "📊 Not Financial Advice",
      "Nothing on this platform constitutes financial, investment, legal, or tax advice of any kind. PEDULI does not recommend that you purchase, sell, hold, or exchange any token or digital asset. All decisions regarding your participation in any liquidity pool, token exchange, or digital asset activity are made entirely at your own risk. WARGATERRA does not guarantee any monetary return, token value, or exchange rate at any time.",
    ],
    [
      "🪙 Token Utility — Not an Investment",
      "The PEDULI token (ticker: PEDULI) is a utility reward token. It is issued solely as an incentive for completing physical exercise activities within the PEDULI programme. It is NOT a security, financial instrument, investment product, or store of value. Any market value that PEDULI tokens may acquire via third-party platforms such as Uniswap arises independently of WARGATERRA's actions. Token values may fluctuate significantly or drop to zero.",
    ],
    [
      "💧 Liquidity Pool Participation Risk",
      "Users who choose to add capital to the PEDULI liquidity pool on Uniswap or any other DEX do so entirely of their own accord. WARGATERRA does not operate, control, or guarantee any liquidity pool. Liquidity provision carries risks including but not limited to impermanent loss, smart contract vulnerabilities, and total loss of deposited capital. This is not a managed fund or savings product.",
    ],
    [
      "⚙️ Operational Fee",
      "To sustain the infrastructure, operations, and continued development of the PEDULI programme, WARGATERRA retains 20% of the PEDULI tokens generated from each exercise session. This fee covers blockchain gas costs, server operations, and programme maintenance. This deduction occurs automatically at the time of each reward transfer and is non-negotiable.",
    ],
    [
      "🔐 Blockchain & Technical Risks",
      "Participation in blockchain-based reward systems carries inherent technical risks including network congestion, smart contract vulnerabilities, loss of private keys, wallet incompatibility, and regulatory changes that may affect token transferability. WARGATERRA makes no guarantees regarding the availability, speed, or reliability of blockchain transactions.",
    ],
    [
      "🛡️ Limitation of Liability",
      "To the fullest extent permitted by applicable law, WARGATERRA, its founders, directors, employees, and affiliates shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from use of the PEDULI platform, token, or associated liquidity activities — including but not limited to physical injury, financial loss, data loss, or loss of token value.",
    ],
    [
      "📋 Data & Privacy",
      "User data including name, email, and wallet address is stored securely in a private database. Wargaterra does not sell, rent, or share personal data with third parties. Wallet addresses recorded on the Polygon blockchain are public by nature of the technology. Camera and movement data captured during exercise sessions is processed entirely on-device via MediaPipe and is never transmitted to or stored by Wargaterra's servers.",
    ],
    [
      "⚖️ Regulatory Compliance",
      "The regulatory status of utility tokens and blockchain reward programmes varies by jurisdiction. It is your responsibility to ensure that your participation in PEDULI complies with the laws of your country of residence. WARGATERRA reserves the right to suspend, modify, or terminate the PEDULI programme at any time to ensure compliance with applicable laws and regulations.",
    ],
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.surface, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0c1e3d,#14447a)", padding: "32px 20px 28px" }}>
        <img src="/logo.svg" alt="PEDULI" style={{ width: 60, height: 60, marginBottom: 10, objectFit: "contain" }}/>
        <h1 style={{ fontFamily: "'Unbounded',sans-serif", color: "#fff", fontSize: 22, margin: "0 0 6px", fontWeight: 900 }}>
          About PEDULI
        </h1>
        <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: T.glow, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          A CSR initiative by WARGATERRA · Built on Polygon
        </p>
      </div>

      <div style={{ padding: 16 }}>

        {/* Mission Statement */}
        <Card style={{ marginBottom: 16, background: T.primaryBg, border: `1.5px solid ${T.primaryBrd}` }}>
          <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: T.primary, margin: "0 0 10px", letterSpacing: "0.06em" }}>
            OUR MISSION
          </p>
          <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.75, fontWeight: 500 }}>
            PEDULI exists to make physical activity genuinely rewarding — not just for health, but financially. We built a system where every rep earns a real digital token, backed by real liquidity. Whether you are a parent motivating your children, an individual challenging yourself, or a company directing CSR funds toward community wellness — PEDULI turns movement into value.
          </p>
        </Card>

        {/* Who Is This For */}
        <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: "#64748b", margin: "0 0 10px 2px", letterSpacing: "0.06em" }}>
          WHO IS THIS FOR
        </p>
        {USE_CASES.map(({ emoji, title, desc }) => (
          <Card key={title} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{emoji}</span>
              <div>
                <h3 style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 12, color: "#0f172a", margin: "0 0 6px", fontWeight: 900 }}>
                  {title}
                </h3>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.75 }}>
                  {desc}
                </p>
              </div>
            </div>
          </Card>
        ))}

        {/* How the token works */}
        <Card style={{ marginBottom: 16, background: "#fffbeb", border: `1.5px solid ${T.accentBrd}` }}>
          <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: T.accentDk, margin: "0 0 10px", letterSpacing: "0.06em" }}>
            HOW THE TOKEN WORKS
          </p>
          {[
            ["1 Rep = 1 PEDULI", "Every completed rep earns one PEDULI token, transferred directly to your Polygon wallet on-chain."],
            ["Daily Cap: 100 tokens", "Each exercise has a daily limit of 100 PEDULI tokens to ensure fair distribution."],
            ["Backed by Liquidity", "PEDULI token value is determined by its liquidity pool on Uniswap. Contributors to the pool increase the value of every token earned."],
            ["Exchange Freely", "Earned tokens can be exchanged at market rate on Uniswap or any compatible DEX/CEX at any time."],
          ].map(([title, desc]) => (
            <div key={title} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.accentBrd}` }}>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 13, color: T.accentDk, margin: "0 0 2px" }}>
                {title}
              </p>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#78350f", margin: 0, lineHeight: 1.6 }}>
                {desc}
              </p>
            </div>
          ))}
        </Card>

         {/* Official Contract Address */}
<Card style={{ marginBottom: 16, background: "#0f172a", border: "1.5px solid #1e3a5f" }}>
  <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: T.glow, margin: "0 0 10px", letterSpacing: "0.06em" }}>
    ✅ OFFICIAL TOKEN CONTRACT
  </p>
  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.6 }}>
    Always verify you are interacting with the correct PEDULI token on Polygon. Wargaterra will never ask you to approve any other contract address. If someone sends you a different address, it is a scam.
  </p>
  <div style={{ background: "#1e2d40", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
    <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 10, color: "#64748b", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      Network: Polygon (MATIC)
    </p>
    <p style={{ fontFamily: "monospace", fontSize: 12, color: "#60a5fa", margin: 0, wordBreak: "break-all", lineHeight: 1.6 }}>
      {PEDULI_CONTRACT}
    </p>
  </div>
  
    href={`https://polygonscan.com/token/${PEDULI_CONTRACT}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{ display: "inline-block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: T.glow, fontWeight: 600, textDecoration: "none" }}
  >
    🔍 Verify on PolygonScan ↗
  </a>
</Card>

{/* Camera & Privacy */}
<Card style={{ marginBottom: 16, background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
  <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: "#166534", margin: "0 0 10px", letterSpacing: "0.06em" }}>
    📷 YOUR CAMERA — WHAT WE SEE & DON'T STORE
  </p>
  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#166534", margin: "0 0 8px", lineHeight: 1.75, fontWeight: 600 }}>
    All movement analysis happens entirely on your own device. No video, no images, and no camera data ever leaves your phone or computer.
  </p>
  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.75 }}>
    PEDULI uses MediaPipe — an open-source AI library by Google — to detect body landmarks in real time directly in your browser. The camera feed is processed locally, frame by frame, and immediately discarded. Wargaterra's servers receive only the final rep count. We have no ability to view, record, or retrieve your camera footage at any point.
  </p>
</Card>

        {/* Disclaimers */}
        <p style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 11, color: "#64748b", margin: "0 0 10px 2px", letterSpacing: "0.06em" }}>
          IMPORTANT DISCLAIMERS
        </p>
        {DISCLAIMERS.map(([title, text]) => (
          <Card key={title} style={{ marginBottom: 10 }}>
            <h3 style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 10, color: T.primary, margin: "0 0 8px", fontWeight: 700, letterSpacing: "0.04em" }}>
              {title.toUpperCase()}
            </h3>
            <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.75 }}>
              {text}
            </p>
          </Card>
        ))}

        {/* Footer */}
        <Card style={{ background: "#f8fafc", marginBottom: 12, textAlign: "center" }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>
            © {new Date().getFullYear()} <strong style={{ color: "#475569" }}>WARGATERRA</strong>. All rights reserved.<br />
            Built on Polygon · Token: PEDULI (ERC-20)<br />
            Last updated: {new Date().toLocaleDateString("en-MY", { year: "numeric", month: "long" })}
          </p>
        </Card>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════ */
const checkAdminPw = pw => pw === atob("cG9GZjQwMTYwJVBFRFVMSQ==");

function AdminLogin({ onSuccess, onCancel }) {
  const [pw,setPw]     = useState("");
  const [err,setErr]   = useState("");
  const [busy,setBusy] = useState(false);
  const [shake,setShake] = useState(false);

  const attempt = async () => {
    if(!pw.trim()) return;
    setBusy(true); setErr("");
    const result = await apiAdminLogin(pw);
    setBusy(false);
    if(result.error || !result.token) {
      setErr("Incorrect password.");
      setShake(true); setPw("");
      setTimeout(()=>setShake(false), 600);
      return;
    }
    onSuccess(result.token);
  };

  return(
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{animation:shake?"shakeX 0.5s ease":"none",width:"100%",maxWidth:340}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:32,background:"linear-gradient(135deg,#1a3a6b,#0f2040)",border:"2px solid #1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🔒</div>
          <h2 style={{fontFamily:"'Unbounded',sans-serif",color:"#e2e8f0",fontSize:18,margin:"0 0 6px",fontWeight:900}}>Admin Console</h2>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#475569",fontSize:12,margin:0}}>PEDULI · WARGATERRA</p>
        </div>
        <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Enter admin password"
          style={{width:"100%",padding:"14px 16px",background:"#111827",border:`1.5px solid ${err?"#ef4444":"#1e3a5f"}`,borderRadius:12,color:"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
        {err&&<p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#ef4444",fontSize:12,margin:"0 0 12px"}}>❌ {err}</p>}
        <button onClick={attempt} disabled={busy}
          style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:10,opacity:busy?0.7:1}}>
          {busy?"VERIFYING…":"UNLOCK CONSOLE"}
        </button>
        <button onClick={onCancel}
          style={{width:"100%",background:"transparent",color:"#475569",border:"1px solid #1e3a5f",borderRadius:12,padding:"12px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,cursor:"pointer"}}>
          ← Return to App
        </button>
      </div>
    </div>
  );
}

function AdminPanel({ onExit, adminToken }) {
  const [users,setUsers]       = useState([]);
  const [loading,setLoading]   = useState(true);
  const [search,setSearch]     = useState("");
  const [view,setView]         = useState("list");
  const [selected,setSelected] = useState(null);
  const [editForm,setEditForm] = useState({});

  // ★ Fetch users from Railway database
 const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${REWARD_API_URL}/api/admin/users`, {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Could not load users:", err);
    }
    setLoading(false);
  };

  useEffect(()=>{ refresh(); },[]);

  const totalEarned      = users.reduce((s,u)=>s+(u.total_tokens||0),0);
  const totalTransferred = users.reduce((s,u)=>s+(u.tokens_transferred||0),0);
  const totalPending     = totalEarned - totalTransferred;

  const filtered = users.filter(u=>
    [u.name,u.email,u.wallet].some(f=>f?.toLowerCase().includes(search.toLowerCase()))
  );

  const openEdit = u => { setEditForm({...u}); setView("edit"); };

  // ★ Save user edits to Railway database
 const saveEdit = async () => {
    await fetch(`${REWARD_API_URL}/api/admin/users/${encodeURIComponent(editForm.email)}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body:    JSON.stringify({
        name:               editForm.name,
        wallet:             editForm.wallet,
        total_tokens:       editForm.total_tokens,
        tokens_transferred: editForm.tokens_transferred,
        admin_notes:        editForm.admin_notes,
      }),
    });
    await refresh();
    setView("detail");
  };

  // ★ Mark transferred in Railway database
  const markAllTransferred = async (u) => {
    await fetch(`${REWARD_API_URL}/api/admin/users/${encodeURIComponent(u.email)}/mark-transferred`, {
      method: "POST",
      headers: { "x-admin-token": adminToken },
    });
    await refresh();
  };
   const resetUserPin = async (u) => {
    if(!window.confirm(`Reset PIN for ${u.name} to 0000? They will be forced to set a new PIN on next login.`)) return;
    await fetch(`${REWARD_API_URL}/api/admin/users/${encodeURIComponent(u.email)}/reset-pin`, {
      method: "POST",
      headers: { "x-admin-token": adminToken },
    });
    await refresh();
  };

  /* ── EDIT VIEW ── */
  if(view==="edit"){
    return(
      <div style={{minHeight:"100vh",background:"#060d1a",padding:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setView("detail")} style={{background:"rgba(255,255,255,0.07)",border:"1px solid #1e3a5f",borderRadius:10,padding:"8px 14px",color:"#94a3b8",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,cursor:"pointer"}}>← Back</button>
          <h2 style={{fontFamily:"'Unbounded',sans-serif",color:"#e2e8f0",fontSize:16,margin:0,fontWeight:900}}>Edit User</h2>
        </div>
        {[["name","Full Name","text"],["wallet","Wallet Address","text"],["total_tokens","Total Tokens Earned","number"],["tokens_transferred","Tokens Transferred","number"]].map(([key,label,type])=>(
          <div key={key} style={{marginBottom:14}}>
            <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>
            <input type={type} value={editForm[key]||""} onChange={e=>setEditForm({...editForm,[key]:type==="number"?+e.target.value:e.target.value})}
              style={{width:"100%",padding:"11px 14px",background:"#111827",border:"1.5px solid #1e3a5f",borderRadius:10,color:"#e2e8f0",fontFamily:key==="wallet"?"monospace":"'Plus Jakarta Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
        ))}
        <div style={{marginBottom:14}}>
          <label style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>Admin Notes</label>
          <textarea value={editForm.admin_notes||""} onChange={e=>setEditForm({...editForm,admin_notes:e.target.value})} rows={3}
            style={{width:"100%",padding:"11px 14px",background:"#111827",border:"1.5px solid #1e3a5f",borderRadius:10,color:"#e2e8f0",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical"}}/>
        </div>
        <button onClick={saveEdit} style={{width:"100%",background:`linear-gradient(135deg,${T.primary},${T.primaryLt})`,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>SAVE TO DATABASE</button>
      </div>
    );
  }

  /* ── DETAIL VIEW ── */
  if(view==="detail"&&selected){
    const u=users.find(x=>x.email===selected);
    if(!u){setView("list");return null;}
    const pending=(u.total_tokens||0)-(u.tokens_transferred||0);
    const sessionsByEx={};
    (u.history||[]).forEach(h=>{sessionsByEx[h.exercise_id]=(sessionsByEx[h.exercise_id]||0)+h.tokens;});
    return(
      <div style={{minHeight:"100vh",background:"#060d1a",padding:16,paddingBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>setView("list")} style={{background:"rgba(255,255,255,0.07)",border:"1px solid #1e3a5f",borderRadius:10,padding:"8px 14px",color:"#94a3b8",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,cursor:"pointer"}}>← Back</button>
          <h2 style={{fontFamily:"'Unbounded',sans-serif",color:"#e2e8f0",fontSize:16,margin:0,fontWeight:900,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</h2>
          <button onClick={()=>openEdit(u)} style={{background:"rgba(26,93,168,0.2)",border:"1px solid rgba(26,93,168,0.4)",borderRadius:8,padding:"7px 12px",color:T.glow,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,cursor:"pointer",flexShrink:0}}>✏️ Edit</button>
        </div>
        <div style={{background:"#111827",borderRadius:14,padding:16,border:"1px solid #1e3a5f",marginBottom:12}}>
          {[["Email",u.email],["Wallet",u.wallet||"—"],["Joined",u.created_at?new Date(u.created_at).toLocaleDateString("en-MY"):"—"],["Last Active",u.last_active?new Date(u.last_active).toLocaleDateString("en-MY"):"—"]].map(([label,val])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"6px 0",borderBottom:"1px solid #1e2d40"}}>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#64748b",flexShrink:0}}>{label}</span>
              <span style={{fontFamily:val?.startsWith?.("0x")?"monospace":"'Plus Jakarta Sans',sans-serif",fontSize:val?.startsWith?.("0x")?10:12,color:"#e2e8f0",maxWidth:200,wordBreak:"break-all",textAlign:"right",marginLeft:8}}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[["Earned",u.total_tokens||0,"#60a5fa"],["Sent",u.tokens_transferred||0,"#4ade80"],["Pending",pending,"#fb923c"]].map(([label,val,col])=>(
            <div key={label} style={{background:"#111827",borderRadius:12,padding:"12px 6px",textAlign:"center",border:"1px solid #1e3a5f"}}>
              <p style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,color:col,margin:"0 0 3px",fontWeight:900}}>{val.toLocaleString()}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:9,color:"#64748b",margin:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
            </div>
          ))}
        </div>
        {pending>0&&(
          <div style={{background:"#0d2010",borderRadius:14,padding:14,border:"1px solid #14532d",marginBottom:12}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#86efac",margin:"0 0 10px",fontWeight:600}}>Mark as transferred to wallet</p>
            <button onClick={()=>{markAllTransferred(u);}} style={{width:"100%",background:"#052e16",border:"1px solid #16a34a",borderRadius:10,padding:"10px",color:"#4ade80",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,cursor:"pointer",fontWeight:700}}>
              ✅ Mark All {pending.toLocaleString()} PEDULI as Sent
            </button>
          </div>
        )}
         <div style={{background:"#1a0a00",borderRadius:14,padding:14,border:"1px solid #7c2d12",marginBottom:12}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#fdba74",margin:"0 0 10px",fontWeight:600}}>🔐 PIN Management</p>
          <button onClick={()=>resetUserPin(u)} style={{width:"100%",background:"#431407",border:"1px solid #c2410c",borderRadius:10,padding:"10px",color:"#fb923c",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,cursor:"pointer",fontWeight:700}}>
            🔑 Reset PIN to 0000
          </button>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#78350f",margin:"8px 0 0"}}>User will be forced to set a new PIN on next login.</p>
        </div>
        {Object.keys(sessionsByEx).length>0&&(
          <div style={{background:"#111827",borderRadius:14,padding:16,border:"1px solid #1e3a5f",marginBottom:12}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:11,color:T.glow,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tokens by Exercise</p>
            {Object.entries(sessionsByEx).map(([exId,tokens])=>{
              const ex=EXERCISES.find(e=>e.id===exId);
              return(
                <div key={exId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1e2d40"}}>
                  <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#cbd5e1"}}>{ex?.emoji} {ex?.name||exId}</span>
                  <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#fde68a",fontWeight:700}}>{tokens} PDL</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{background:"#111827",borderRadius:14,padding:16,border:"1px solid #1e3a5f"}}>
          <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:11,color:T.glow,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Session Log ({(u.history||[]).length} sessions)</p>
          {(u.history||[]).length===0
            ?<p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:"#475569",margin:0}}>No sessions yet.</p>
            :(u.history||[]).slice(0,20).map((h,i)=>{
              const ex=EXERCISES.find(e=>e.id===h.exercise_id);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1e2d40"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15}}>{ex?.emoji}</span>
                    <div>
                      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#e2e8f0",margin:0}}>{ex?.name||h.exercise_id}</p>
                      <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#475569",margin:0}}>{new Date(h.created_at).toLocaleString("en-MY")} · {h.reps} reps</p>
                    </div>
                  </div>
                  <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#fde68a",fontWeight:700,whiteSpace:"nowrap"}}>+{h.tokens} PDL</span>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return(
    <div style={{minHeight:"100vh",background:"#060d1a",paddingBottom:32}}>
      <div style={{background:"linear-gradient(135deg,#0a1a35,#0f2d5c)",padding:"20px 16px 16px",borderBottom:"1px solid #1e3a5f"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#475569",fontSize:10,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>PEDULI · WARGATERRA</p>
            <h1 style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:20,margin:0,fontWeight:900}}>Admin Console</h1>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={refresh} style={{background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,padding:"8px 12px",color:T.glow,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,cursor:"pointer"}}>🔄 Refresh</button>
            <button onClick={()=>{ apiAdminLogout(adminToken); onExit(); }} style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"8px 14px",color:"#fca5a5",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,cursor:"pointer",fontWeight:600}}>🚪 Exit</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {[["👥","Users",users.length],["🪙","Earned",totalEarned.toLocaleString()],["✈️","Sent",totalTransferred.toLocaleString()],["⏳","Pending",totalPending.toLocaleString()]].map(([icon,label,val])=>(
            <div key={label} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,0.07)"}}>
              <p style={{fontSize:16,margin:"0 0 2px"}}>{icon}</p>
              <p style={{fontFamily:"'Unbounded',sans-serif",color:"#fff",fontSize:13,margin:"0 0 2px",fontWeight:900}}>{val}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:8,color:"#64748b",margin:0,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <input placeholder="🔍 Search by name, email or wallet…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",padding:"11px 14px",background:"#111827",border:"1.5px solid #1e3a5f",borderRadius:12,color:"#e2e8f0",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
      </div>
      <div style={{padding:"12px 16px 0"}}>
        {loading?(
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#475569",fontSize:14}}>Loading users from database…</p>
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#475569",fontSize:14}}>
              {users.length===0?"No registered users yet.":"No users match your search."}
            </p>
          </div>
        ):filtered.map(u=>{
          const pending=(u.total_tokens||0)-(u.tokens_transferred||0);
          return(
            <div key={u.email} onClick={()=>{setSelected(u.email);setView("detail");}}
              style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #1e3a5f",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:14,color:"#f1f5f9",margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</p>
                  <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:"#64748b",margin:"0 0 2px"}}>{u.email}</p>
                  <p style={{fontFamily:"monospace",fontSize:10,color:u.wallet?"#93c5fd":"#475569",margin:0}}>{u.wallet?`${u.wallet.slice(0,10)}…${u.wallet.slice(-6)}`:"No wallet linked"}</p>
                </div>
                <button onClick={e=>{e.stopPropagation();openEdit(u);}}
                  style={{background:"rgba(26,93,168,0.2)",border:"1px solid rgba(26,93,168,0.4)",borderRadius:8,padding:"6px 10px",color:T.glow,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,cursor:"pointer",whiteSpace:"nowrap",marginLeft:8,flexShrink:0}}>✏️ Edit</button>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[
                  [`🪙 ${(u.total_tokens||0).toLocaleString()} earned`,"#1e3a5f","#60a5fa"],
                  [`✈️ ${(u.tokens_transferred||0).toLocaleString()} sent`,"#052e16","#4ade80"],
                  ...(pending>0?[[`⏳ ${pending.toLocaleString()} pending`,"#3d2000","#fb923c"]]:[]),
                ].map(([text,bg,col])=>(
                  <span key={text} style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,fontWeight:600,color:col,background:bg,borderRadius:6,padding:"3px 8px"}}>{text}</span>
                ))}
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#475569",background:"#0f172a",borderRadius:6,padding:"3px 8px"}}>
                  📅 {u.created_at?new Date(u.created_at).toLocaleDateString("en-MY"):"—"}
                </span>
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,color:"#475569",background:"#0f172a",borderRadius:6,padding:"3px 8px"}}>
                  📝 {(u.history||[]).length} sessions
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN APP
──────────────────────────────────────────────── */
export default function App() {
  const [page,setPage]         = useState("home");
  const [user,setUser]         = useState(null);
  const [exercise,setExercise] = useState(EXERCISES[0]);
  const [targetReps,setTargetReps] = useState(20);
  const [adminAuth,setAdminAuth]       = useState(false);
  const [adminToken,setAdminToken]     = useState(null);
  const [profileMode,setProfileMode]   = useState(null);

  // ★ On app load — restore session from localStorage cache,
  //   then refresh from database
  useEffect(()=>{
    const cached = load("user");
    if(cached?.email){
      setUser(cached);
      apiLoadUser(cached.email).then(async dbUser=>{
        if(dbUser){
          // Fetch today's remaining for all exercises if wallet exists
          if(dbUser.wallet){
            const remaining = {};
            await Promise.all(EXERCISES.map(async ex => {
              const r = await apiGetDailyRemaining(dbUser.wallet, ex.id);
              remaining[ex.id] = r;
            }));
            dbUser.serverDailyRemaining = remaining;
          }
          setUser(dbUser);
          save("user", dbUser);
          if(dbUser.mustChangePin){
            setProfileMode("change-pin");
            setPage("profile");
          }
        }
      });
    }
  },[]);

  // ★ saveUser — saves to DB AND local cache
  const saveUser = async u => {
    save("user", u);
    setUser(u);
    // Reload fresh from DB to get server-side totals
    const dbUser = await apiLoadUser(u.email);
    if(dbUser){ setUser(dbUser); save("user", dbUser); }
  };

  const navigate = (pg, opts={}) => {
    if(opts.exercise) setExercise(opts.exercise);
    if(opts.target)   setTargetReps(opts.target);
    if(pg!=="admin")  setAdminAuth(false);
    if(pg!=="profile") setProfileMode(null);
    setPage(pg);
  };

  // addTokens updates local cache only — DB update happens
  // inside server.js when /api/reward is called
  const addTokens = (exerciseId, reps) => {
    if(!user) return { tokens: reps, limited: false };
    const td = todayKey();
    const u  = JSON.parse(JSON.stringify(user));
    if(!u.history)    u.history    = [];
    if(!u.dailyCount) u.dailyCount = {};
    if(!u.dailyCount[td]) u.dailyCount[td] = {};
    const done    = u.dailyCount[td][exerciseId] || 0;
    const allowed = Math.min(reps, DAILY_LIMIT - done);
    u.dailyCount[td][exerciseId] = done + allowed;
    u.totalTokens = (u.totalTokens || 0) + allowed;
    u.history.unshift({
      date: new Date().toISOString(), exerciseId, reps: allowed, tokens: allowed
    });
    save("user", u);
    setUser(u);
    return { tokens: allowed, limited: allowed < reps };
  };

  // getDailyRemaining — reads from local cache for instant UI
  const getDailyRemaining = id => {
    if(!user) return DAILY_LIMIT;
    // Check server-side daily limit if wallet is available
    const serverRemaining = user.serverDailyRemaining?.[id];
    if(serverRemaining !== undefined) return serverRemaining;
    // Fall back to local cache
    const done = user.dailyCount?.[todayKey()]?.[id] || 0;
    return Math.max(0, DAILY_LIMIT - done);
  };

  const isExercise = page === "exercise";
  const isAdmin    = page === "admin";

  if(isAdmin){
    if(!adminAuth) return <AdminLogin onSuccess={(token)=>{setAdminAuth(true);setAdminToken(token);}} onCancel={()=>setPage("home")}/>;
    return <AdminPanel adminToken={adminToken} onExit={()=>{setAdminAuth(false);setAdminToken(null);setPage("home");}}/>;
  }

  return(
    <>
      <FontLoader/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${T.primaryBg};}
        input:focus{border-color:${T.primary}!important;box-shadow:0 0 0 3px rgba(26,93,168,0.15);}
        input[type=range]{height:6px;}
        @keyframes bounceIn{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(0.9)}100%{transform:scale(1);opacity:1}}
        @keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${T.glow};border-radius:4px;}
      `}</style>
      <div style={{maxWidth:500,margin:"0 auto",position:"relative"}}>
        {page==="home"            &&<HomePage navigate={navigate} user={user}/>}
        {page==="exercise-select" &&<ExerciseSelectPage navigate={navigate} user={user} getDailyRemaining={getDailyRemaining}/>}
        {page==="exercise"        &&<ExercisePage exercise={exercise} targetReps={targetReps} user={user} setUser={setUser} navigate={navigate} addTokens={addTokens} getDailyRemaining={getDailyRemaining}/>}
        {page==="dashboard"       &&<DashboardPage user={user} navigate={navigate}/>}
        {page==="profile" &&<ProfilePage user={user} saveUser={saveUser} navigate={navigate} startMode={profileMode}/>}
        {page==="disclaimer"      &&<DisclaimerPage/>}
        {!isExercise&&!isAdmin&&<BottomNav page={page} navigate={navigate}/>}
      </div>
    </>
  );
}
