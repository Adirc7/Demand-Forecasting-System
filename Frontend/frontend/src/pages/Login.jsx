import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

const CSS = `
@keyframes scanline{0%{transform:translateY(-100vh)}100%{transform:translateY(100vh)}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeInDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
@keyframes cardGlow{0%,100%{box-shadow:0 0 40px rgba(249,115,22,.15),0 30px 80px rgba(0,0,0,.6)}50%{box-shadow:0 0 60px rgba(249,115,22,.25),0 30px 80px rgba(0,0,0,.6)}}
@keyframes logoFlicker{0%,100%{opacity:1;text-shadow:0 0 20px rgba(249,115,22,.6),0 0 40px rgba(249,115,22,.3)}93%{opacity:.8;text-shadow:0 0 10px rgba(249,115,22,.3)}96%{opacity:1}}
@keyframes btnShimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes hexSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes dataTicker{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}
@keyframes blinkCursor{0%,100%{opacity:1}50%{opacity:0}}
@keyframes ringPulse{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.5);opacity:0}}
@keyframes orbitRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes welcomePulse{0%,100%{transform:scale(1);box-shadow:0 0 30px rgba(249,115,22,.4),0 0 60px rgba(249,115,22,.2)}50%{transform:scale(1.04);box-shadow:0 0 50px rgba(249,115,22,.7),0 0 100px rgba(249,115,22,.3)}}
@keyframes dotBlink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes arrowBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}

*{box-sizing:border-box;margin:0;padding:0}
body,html{height:100%;overflow:hidden;background:#050508;}

.wrap{
  width:100vw;height:100vh;
  background:#050508;
  display:flex;align-items:center;justify-content:center;
  font-family:'Share Tech Mono',monospace;
  position:relative;overflow:hidden;
}

canvas{position:absolute;inset:0;z-index:0}

/* HUD corners */
.hud-tl,.hud-tr,.hud-bl,.hud-br{position:absolute;width:60px;height:60px;z-index:2;pointer-events:none}
.hud-tl{top:20px;left:20px;border-top:1px solid rgba(249,115,22,.5);border-left:1px solid rgba(249,115,22,.5)}
.hud-tr{top:20px;right:20px;border-top:1px solid rgba(249,115,22,.5);border-right:1px solid rgba(249,115,22,.5)}
.hud-bl{bottom:20px;left:20px;border-bottom:1px solid rgba(249,115,22,.5);border-left:1px solid rgba(249,115,22,.5)}
.hud-br{bottom:20px;right:20px;border-bottom:1px solid rgba(249,115,22,.5);border-right:1px solid rgba(249,115,22,.5)}

/* Scanline sweep */
.scanline-sweep{
  position:absolute;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(249,115,22,.4),transparent);
  animation:scanline 6s linear infinite;
  z-index:2;pointer-events:none;
}

/* Ticker strips */
.ticker-left,.ticker-right{
  position:absolute;top:0;bottom:0;width:48px;
  overflow:hidden;z-index:2;pointer-events:none;
  display:flex;flex-direction:column;
}
.ticker-left{left:80px;border-left:1px solid rgba(249,115,22,.1)}
.ticker-right{right:80px;border-right:1px solid rgba(249,115,22,.1)}
.ticker-inner{
  display:flex;flex-direction:column;gap:18px;
  padding:8px 6px;
  animation:dataTicker 20s linear infinite;
  font-size:8px;color:rgba(249,115,22,.3);letter-spacing:1px;
}

/* Base Overlays */
.screen-layer{
  position:absolute;inset:0;z-index:10;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  transition:all 0.8s cubic-bezier(0.76,0,0.24,1);
}

.welcome-screen.hide{opacity:0;transform:scale(0.9);pointer-events:none}

.login-screen{
  opacity:0;
  transform:translateY(60px);
  pointer-events:none;
}
.login-screen.show{
  opacity:1;
  transform:translateY(0);
  pointer-events:auto;
}

/* Welcome Screen Elements */
.welcome-brand{font-family:'Orbitron',monospace;font-weight:900;font-size:13px;color:rgba(249,115,22,.5);letter-spacing:6px;text-transform:uppercase;margin-bottom:40px;animation:fadeInDown .6s ease .2s both}
.admin-icon-wrap{position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:36px;cursor:pointer;animation:fadeInUp .7s ease .4s both;}
.orbit-ring{position:absolute;width:180px;height:180px;border:1px dashed rgba(249,115,22,.2);border-radius:50%;animation:orbitRing 12s linear infinite;}
.orbit-ring-2{position:absolute;width:220px;height:220px;border:1px dashed rgba(249,115,22,.1);border-radius:50%;animation:orbitRing 20s linear infinite reverse;}
.orbit-dot{position:absolute;top:0;left:50%;width:6px;height:6px;margin-left:-3px;margin-top:-3px;background:#f97316;border-radius:50%;box-shadow:0 0 8px #f97316}

.admin-hex-btn{
  position:relative;width:130px;height:130px;
  background:linear-gradient(135deg,rgba(249,115,22,.15),rgba(234,88,12,.08));
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
  display:flex;align-items:center;justify-content:center;flex-direction:column;
  cursor:pointer;border:none;outline:none;
  animation:welcomePulse 3s ease-in-out infinite;transition:all .2s;z-index:2;
}
.admin-hex-btn::before{
  content:'';position:absolute;inset:0;
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
  border:2px solid rgba(249,115,22,.5);
}
.admin-hex-btn:hover{transform:scale(1.06)}

.admin-icon-svg{font-size:40px;margin-bottom:4px;filter:drop-shadow(0 0 10px rgba(249,115,22,.7))}
.admin-icon-label{font-family:'Orbitron',monospace;font-size:7px;color:#f97316;letter-spacing:2px}

.welcome-title{font-family:'Orbitron',monospace;font-weight:900;color:#fff;text-align:center;margin-bottom:10px;animation:fadeInUp .6s ease .6s both;}
.welcome-word{font-size:clamp(36px,5vw,56px); letter-spacing:12px; line-height:1.2; text-shadow:0 0 40px rgba(249,115,22,.6);}
.to-the-word{font-size:clamp(12px,1.5vw,14px); color:rgba(226,232,240,.4); letter-spacing:6px; font-weight:700; margin-bottom:8px;}
.portal-word{font-size:clamp(18px,3vw,28px); letter-spacing:4px; text-shadow:0 0 30px rgba(249,115,22,.2);}
.portal-word span{color:#f97316;text-shadow:0 0 20px rgba(249,115,22,.6)}
.welcome-sub{font-size:11px;color:rgba(226,232,240,.3);letter-spacing:2px;text-align:center;margin-bottom:48px;animation:fadeInUp .6s ease .7s both;line-height:1.8}
.welcome-sub em{color:rgba(249,115,22,.6);font-style:normal}

.modules-row{display:flex;gap:12px;margin-bottom:40px;animation:fadeInUp .6s ease .8s both}
.mod-chip{font-family:'Orbitron',monospace;font-size:8px;letter-spacing:2px;color:rgba(226,232,240,.3);border:1px solid rgba(249,115,22,.15);padding:6px 14px;border-radius:2px;display:flex;align-items:center;gap:6px;}
.mod-dot{width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 5px #22c55e;}

.arrow-hint{
  position:absolute;bottom:80px;left:0;right:0;
  display:flex;flex-direction:column;align-items:center;gap:6px;
  animation:arrowBounce 1.5s ease-in-out infinite,fadeInUp .6s ease 1.2s both;
  cursor:pointer;
}
.arrow-label{font-size:8px;letter-spacing:3px;color:rgba(249,115,22,.4);text-transform:uppercase}
.arrow-svg{color:rgba(249,115,22,.4);font-size:18px}

/* Back button */
.back-btn{
  position:absolute;top:28px;left:40px;
  background:transparent;border:1px solid rgba(249,115,22,.3);
  color:#f97316;font-family:'Orbitron',monospace;font-size:9px;letter-spacing:2px;
  padding:8px 18px;cursor:pointer;border-radius:2px;z-index:20;
  transition:all .3s;display:flex;align-items:center;gap:8px;
}
.back-btn:hover{background:rgba(249,115,22,.1);box-shadow:0 0 16px rgba(249,115,22,.3)}

/* Status line bottom */
.status-line{
  position:absolute;bottom:28px;left:0;right:0;
  display:flex;justify-content:center;gap:32px;z-index:3;
  animation:fadeInUp .8s ease 1.2s both;
}
.s-item{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:2px;color:rgba(226,232,240,.25)}
.s-dot{width:5px;height:5px;border-radius:50%}

/* LOGIN CARD */
.card{
  position:relative;z-index:10;
  width:420px;
  background:linear-gradient(145deg,rgba(10,8,20,.96),rgba(15,5,25,.96));
  border:1px solid rgba(249,115,22,.3);
  border-radius:4px;
  padding:44px 40px 40px;
  animation:cardGlow 4s ease-in-out infinite, fadeInUp .8s ease .2s both;
}
.card::before{content:'';position:absolute;top:-1px;left:-1px;width:20px;height:20px;border-top:2px solid #f97316;border-left:2px solid #f97316}
.card::after{content:'';position:absolute;bottom:-1px;right:-1px;width:20px;height:20px;border-bottom:2px solid #f97316;border-right:2px solid #f97316}

/* Corner accents */
.c-tr{position:absolute;top:-1px;right:-1px;width:20px;height:20px;border-top:2px solid #f97316;border-right:2px solid #f97316}
.c-bl{position:absolute;bottom:-1px;left:-1px;width:20px;height:20px;border-bottom:2px solid #f97316;border-left:2px solid #f97316}

/* Ring pulse behind card */
.ring{
  position:absolute;top:50%;left:50%;
  width:500px;height:500px;
  margin:-250px 0 0 -250px;
  border:1px solid rgba(249,115,22,.15);
  border-radius:50%;
  animation:ringPulse 4s ease-out infinite;
  z-index:1;pointer-events:none;
}
.ring2{animation-delay:2s}

.logo-wrap{text-align:center;margin-bottom:32px;animation:fadeInDown .6s ease .4s both}
.logo-hex-wrap{display:flex;justify-content:center;margin-bottom:12px}
.logo-hex{
  width:44px;height:44px;
  background:linear-gradient(135deg,#f97316,#ea580c);
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
  box-shadow:0 0 30px rgba(249,115,22,.6),0 0 60px rgba(249,115,22,.2);
}
.logo-title{
  font-family:'Orbitron',monospace;font-weight:900;font-size:28px;
  color:#f97316;letter-spacing:4px;
  animation:logoFlicker 6s infinite;
}
.logo-title span{color:#fff}
.logo-sub{
  font-size:10px;color:rgba(226,232,240,.3);letter-spacing:4px;
  margin-top:6px;text-transform:uppercase;
}
.logo-sub em{color:rgba(249,115,22,.5);font-style:normal}

.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(249,115,22,.2),transparent);margin:0 0 28px}

.field-label{font-size:9px;color:rgba(226,232,240,.35);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px}
.field-wrap{position:relative;margin-bottom:20px}
.cyber-input{
  width:100%;
  background:rgba(5,5,10,.8);
  border:1px solid rgba(249,115,22,.2);
  border-radius:2px;
  padding:13px 16px 13px 40px;
  color:#e2e8f0;
  font-family:'Share Tech Mono',monospace;
  font-size:13px;letter-spacing:1px;
  outline:none;
  transition:all .3s;
}
.cyber-input:focus{border-color:rgba(249,115,22,.7);box-shadow:0 0 16px rgba(249,115,22,.15)}
.cyber-input::placeholder{color:rgba(226,232,240,.15)}
.input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:13px;color:rgba(249,115,22,.4);pointer-events:none}

.signin-btn{
  width:100%;margin-top:8px;
  position:relative;overflow:hidden;
  background:linear-gradient(90deg,#f97316,#ea580c,#f97316,#ea580c);
  background-size:300% auto;
  border:none;
  padding:15px;
  color:#fff;
  font-family:'Orbitron',monospace;font-weight:700;
  font-size:12px;letter-spacing:3px;
  text-transform:uppercase;
  cursor:pointer;
  clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%);
  transition:all .3s;
  animation:btnShimmer 3s linear infinite;
}
.signin-btn:hover{box-shadow:0 0 30px rgba(249,115,22,.7),0 0 60px rgba(249,115,22,.3);letter-spacing:4px}
.signin-btn::before{
  content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);
  transition:left .6s;
}
.signin-btn:hover::before{left:150%}

.card-footer{margin-top:20px;text-align:center;font-size:9px;color:rgba(226,232,240,.15);letter-spacing:2px}
.cursor{display:inline-block;animation:blinkCursor 1s step-end infinite}

.success-msg{background:rgba(34,197,94,.1);color:#22c55e;padding:12px;border-radius:4px;font-size:10px;font-family:'Orbitron',monospace;letter-spacing:1px;border:1px solid rgba(34,197,94,.3);margin-bottom:16px;text-align:center;}
.forgot-link{font-family:'Share Tech Mono',monospace;font-size:10px;color:rgba(249,115,22,.6);text-decoration:none;cursor:pointer;float:right;margin-top:6px;transition:all .2s;text-transform:uppercase;letter-spacing:2px;}
.forgot-link:hover{color:#f97316;text-shadow:0 0 10px rgba(249,115,22,.4);}

/* Version tag */
.version-tag{
  position:absolute;top:-12px;right:16px;
  background:#050508;
  border:1px solid rgba(249,115,22,.3);
  color:#f97316;font-size:8px;letter-spacing:2px;
  padding:2px 10px;border-radius:2px;
  font-family:'Orbitron',monospace;
}
`;

function useCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    const GRID = 60;
    const N = 80;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      type: Math.random() > 0.7 ? "blue" : "orange",
    }));

    const COLS = Math.floor(W / 22);
    const streams = Array.from({ length: Math.floor(COLS * 0.3) }, () => ({
      col: Math.floor(Math.random() * COLS),
      y: Math.random() * H,
      speed: Math.random() * 1.2 + 0.4,
      len: Math.floor(Math.random() * 12 + 4),
      alpha: Math.random() * 0.12 + 0.03,
      chars: Array.from({ length: 18 }, () => String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))),
    }));

    const hexNodes = Array.from({ length: 12 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 30 + 15,
      alpha: Math.random() * 0.06 + 0.02,
      speed: Math.random() * 0.003 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;

    function drawHex(x, y, r, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.strokeStyle = "rgba(249,115,22,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      hexNodes.forEach(h => {
        const oy = Math.sin(t * h.speed + h.phase) * 20;
        drawHex(h.x, h.y + oy, h.r, h.alpha + Math.sin(t * 0.01) * 0.02);
      });

      streams.forEach(s => {
        s.y += s.speed;
        if (s.y > H + s.len * 16) s.y = -s.len * 16;
        const x = s.col * 22 + 11;
        for (let i = 0; i < s.len; i++) {
          const fy = s.y - i * 14;
          if (fy < 0 || fy > H) continue;
          const fade = 1 - i / s.len;
          ctx.save();
          ctx.globalAlpha = s.alpha * fade;
          ctx.fillStyle = i === 0 ? "#f97316" : "rgba(249,115,22,0.8)";
          ctx.font = `10px 'Share Tech Mono'`;
          const ci = Math.floor((t * 0.05 + i) % s.chars.length);
          ctx.fillText(s.chars[ci], x, fy);
          ctx.restore();
        }
      });

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.type === "blue" ? "#3b82f6" : "#f97316";
        ctx.shadowColor = p.type === "blue" ? "#3b82f6" : "#f97316";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 100) * 0.08;
            ctx.strokeStyle = "#f97316";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      const g1 = ctx.createRadialGradient(W * 0.15, H * 0.3, 0, W * 0.15, H * 0.3, 300);
      g1.addColorStop(0, "rgba(249,115,22,0.05)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W * 0.85, H * 0.7, 0, W * 0.85, H * 0.7, 350);
      g2.addColorStop(0, "rgba(59,130,246,0.04)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

      t++;
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return ref;
}

const tickerData = ["SKU-4821", "STOCK:497", "DAYS:49700", "SKU-1848", "STOCK:536", "DAYS:53600", "REORDER:NOMINAL", "MODEL:HIGH", "SKU-5865", "STOCK:323", "SYNC:LIVE", "M3:ONLINE", "FORECAST:30D", "DRIFT:0.02", "SKU-6843", "STOCK:21", "ALERT:OK", "MODEL:M5", "SKU-9428", "STOCK:17"];
const modules = ["M1 · Add Product", "M2 · Record Sales", "M3 · Inv. Alerts", "M4 · Forecasts", "M5 · Analytics"];

export default function Login() {
  const [showLogin, setShowLogin] = useState(false);
  const [isForgotPass, setIsForgotPass] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const canvasRef = useCanvas();
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleEnter = () => setShowLogin(true);
  const handleBack = () => {
    if (isForgotPass) {
      setIsForgotPass(false);
      setErr("");
      setMsg("");
    } else {
      setShowLogin(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (isForgotPass) {
      if (!email) {
        setErr("Please enter your email address.");
        return;
      }
      try {
        await resetPassword(email);
        setMsg("Password reset link sent! Check your inbox.");
        setIsForgotPass(false);
      } catch (error) {
        setErr(error.message || "Failed to send reset link.");
      }
      return;
    }

    try {
      await login(email, pass);
      navigate('/inventory');
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || (error.message && error.message.includes('auth/invalid-credential'))) {
        setErr("Invalid Credentials");
      } else {
        setErr(error.message || "Authentication Failed.");
      }
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">
        <canvas ref={canvasRef} />

        {/* Persistent UI Elements (always show) */}
        <div className="scanline-sweep" />
        <div className="hud-tl" /><div className="hud-tr" />
        <div className="hud-bl" /><div className="hud-br" />

        <div className="ticker-left">
          <div className="ticker-inner">
            {[...tickerData, ...tickerData].map((d, i) => (
              <div key={i} style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>{d}</div>
            ))}
          </div>
        </div>
        <div className="ticker-right">
          <div className="ticker-inner" style={{ animationDelay: "-10s" }}>
            {[...tickerData, ...tickerData].reverse().map((d, i) => (
              <div key={i} style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>{d}</div>
            ))}
          </div>
        </div>

        <div className="status-line">
          {[
            { label: "SYSTEM", val: "ONLINE", color: "#22c55e" },
            { label: "MODEL", val: "M5", color: "#f97316" },
            { label: "ENGINE", val: "ACTIVE", color: "#3b82f6" },
            { label: "SYNC", val: "LIVE", color: "#818cf8" },
          ].map(s => (
            <div key={s.label} className="s-item">
              <span className="s-dot" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              {s.label}: <span style={{ color: s.color, marginLeft: 4 }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* WELCOME SCREEN */}
        <div className={`screen-layer welcome-screen ${showLogin ? "hide" : ""}`}>
          <div className="welcome-brand">DROPEX.AI · RETAIL DEMAND FORECAST SYSTEM</div>

          <div className="admin-icon-wrap" onClick={handleEnter}>
            <div className="orbit-ring"><div className="orbit-dot" /></div>
            <div className="orbit-ring-2" />
            <button className="admin-hex-btn" onClick={handleEnter}>
              <div className="ripple-effect" />
              <span className="admin-icon-svg">🛡️</span>
              <span className="admin-icon-label">ADMIN</span>
            </button>
          </div>

          <div className="welcome-title">
            <div className="welcome-word">WELCOME</div>
            <div className="to-the-word">TO THE</div>
            <div className="portal-word"><span>ADMINISTRATION</span> PORTAL</div>
          </div>
          <p className="welcome-sub">
            Authorized staff access only · Dropex AI v3.1<br />
            <em>Click the shield</em> to proceed to secure login
          </p>

          <div className="modules-row">
            {modules.map((m, i) => (
              <div key={i} className="mod-chip">
                <span className="mod-dot" style={{ animationDelay: `${i * .4}s` }} />
                {m}
              </div>
            ))}
          </div>

          <div className="arrow-hint" onClick={handleEnter}>
            <span className="arrow-label">Tap to login</span>
            <span className="arrow-svg">▼</span>
          </div>
        </div>

        {/* LOGIN SCREEN */}
        <div className={`screen-layer login-screen ${showLogin ? "show" : ""}`}>
          <button className="back-btn" onClick={handleBack} type="button">← BACK</button>

          <div className="ring" /><div className="ring ring2" />

          <div className="card">
            <div className="version-tag">v3.1</div>
            <div className="c-tr" /><div className="c-bl" />

            <div className="logo-wrap">
              <div className="logo-hex-wrap"><div className="logo-hex" /></div>
              <div className="logo-title">DROPEX<span>.AI</span></div>
              <div className="logo-sub">Smart Inventory System &nbsp;<em>·</em>&nbsp; Retail <em>Demand Forecast</em></div>
            </div>

            <div className="divider" />

            {err && (
              <div style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', padding: '12px', borderRadius: '4px', fontSize: '10px', fontFamily: "'Orbitron', monospace", letterSpacing: '1px', border: '1px solid rgba(239,68,68,.3)', marginBottom: '16px', textAlign: 'center' }}>
                [ERR] {err}
              </div>
            )}
            {msg && (
              <div className="success-msg">
                {msg}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="field-label">Email Address</div>
              <div className="field-wrap">
                <span className="input-icon">◈</span>
                <input
                  className="cyber-input"
                  type="email"
                  placeholder="user@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {!isForgotPass && (
                <>
                  <div className="field-label">
                    Password
                    <span className="forgot-link" onClick={() => {setIsForgotPass(true); setErr(""); setMsg("");}}>Forgot?</span>
                  </div>
                  <div className="field-wrap">
                    <span className="input-icon">⬡</span>
                    <input
                      className="cyber-input"
                      type="password"
                      placeholder="••••••••••••"
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <button className="signin-btn" type="submit">
                {isForgotPass ? "SEND RESET LINK" : "⚡ SIGN IN"}
              </button>
              
              {isForgotPass && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <span className="forgot-link" style={{ float: 'none' }} onClick={() => {setIsForgotPass(false); setErr("");}}>
                    Back to Login
                  </span>
                </div>
              )}
            </form>

            <div className="card-footer">
              SECURE CONNECTION ESTABLISHED<span className="cursor">_</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
