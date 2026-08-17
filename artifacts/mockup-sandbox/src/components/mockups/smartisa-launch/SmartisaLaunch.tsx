import { useCallback, useEffect, useRef, useState } from "react";

type CeremonyState = "standby" | "countdown" | "finale";
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  kind: "spark" | "confetti" | "firework";
  rotation: number;
};

const RED = "#d71920";
const GOLD = "#e6b95a";
const WHITE = "#f8f6ef";

export function SmartisaLaunch() {
  const [state, setState] = useState<CeremonyState>("standby");
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const launched = useRef(false);

  const burst = useCallback((x: number, y: number, amount: number, firework = false) => {
    const colors = [RED, GOLD, WHITE, "#a80f17"];
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = firework ? 2 + Math.random() * 5 : 2 + Math.random() * 8;
      particles.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 50 + Math.random() * 80, maxLife: 130, size: 1 + Math.random() * 4,
        color: colors[i % colors.length], gravity: firework ? 0.025 : 0.08,
        kind: firework ? "firework" : i % 4 === 0 ? "confetti" : "spark", rotation: Math.random() * 6,
      });
    }
  }, []);

  const sound = useCallback((finale = false) => {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio.current ??= new Ctx();
    const ctx = audio.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = finale ? "sine" : "triangle";
    osc.frequency.setValueAtTime(finale ? 110 : 74, now);
    osc.frequency.exponentialRampToValueAtTime(finale ? 880 : 42, now + (finale ? 2.2 : 0.7));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(finale ? 0.25 : 0.5, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (finale ? 2.6 : 0.9));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (finale ? 2.7 : 1));
  }, []);

  const reset = useCallback(() => {
    launched.current = false;
    setState("standby");
    setCount(3);
    setFlash(false);
    particles.current = [];
  }, []);

  const launch = useCallback(() => {
    if (launched.current || state !== "standby") return;
    launched.current = true;
    sound();
    setState("countdown");
    let n = 3;
    const timer = window.setInterval(() => {
      n -= 1;
      setCount(n);
      sound();
      if (n <= 0) {
        window.clearInterval(timer);
        setTimeout(() => {
          setFlash(true);
          sound(true);
          setState("finale");
          burst(window.innerWidth / 2, window.innerHeight * 0.43, 220);
          window.setTimeout(() => setFlash(false), 460);
        }, 520);
      }
    }, 800);
  }, [burst, sound, state]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); launch(); }
      if (event.key.toLowerCase() === "r") reset();
    };
    window.addEventListener("keydown", key);
    document.body.style.cursor = state === "standby" ? "default" : "none";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.cursor = "default";
    };
  }, [launch, reset, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth * devicePixelRatio; canvas.height = window.innerHeight * devicePixelRatio; };
    resize();
    window.addEventListener("resize", resize);
    let lastFirework = 0;
    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(devicePixelRatio, devicePixelRatio);
      if (state === "finale" && time - lastFirework > 430) {
        lastFirework = time;
        burst(window.innerWidth * (0.16 + Math.random() * 0.68), window.innerHeight * (0.16 + Math.random() * 0.34), 34, true);
      }
      particles.current = particles.current.filter((p) => p.life > 0);
      particles.current.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= 0.993; p.life -= 1; p.rotation += 0.08;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        if (p.kind === "confetti") ctx.fillRect(-p.size, -p.size * 2.5, p.size * 2, p.size * 5);
        else { ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      ctx.restore();
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { window.removeEventListener("resize", resize); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [burst, state]);

  return (
    <main className={`ceremony ${state} ${flash ? "flashed" : ""}`} aria-live="polite">
      <style>{`
        @keyframes breathe { 0%,100%{transform:scale(.98);opacity:.72} 50%{transform:scale(1.04);opacity:1} }
        @keyframes ring { from{transform:scale(.65);opacity:.8} to{transform:scale(1.7);opacity:0} }
        @keyframes reveal { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rise { from{opacity:0;transform:translateY(35px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scan { from{transform:translateY(-100%)} to{transform:translateY(100vh)} }
        .ceremony{--red:${RED};--gold:${GOLD};--white:${WHITE};position:relative;min-height:100dvh;overflow:hidden;background:#0d0d11;color:var(--white);font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;cursor:default}
        .ceremony:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(128,10,19,.26),transparent 55%),linear-gradient(120deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:auto,84px 84px;opacity:.7}
        .ceremony:after{content:"";position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.18;animation:scan 6s linear infinite;pointer-events:none}
        .ceremony.flashed{background:#f6eee3;transition:background .08s}
        .ceremony.flashed *{opacity:0}
        .stage{position:relative;z-index:2;width:min(1120px,92vw);min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:44px 0}
        .topline{position:absolute;top:30px;left:0;right:0;display:flex;justify-content:space-between;align-items:center;font:10px 'Space Mono',monospace;letter-spacing:.22em;color:rgba(248,246,239,.55);text-transform:uppercase}
        .mark{display:flex;align-items:center;gap:10px;color:var(--gold);font-weight:700}.mark i{display:block;width:9px;height:9px;background:var(--red);transform:rotate(45deg);box-shadow:0 0 16px var(--red)}
        .replay{appearance:none;background:transparent;border:1px solid rgba(230,185,90,.4);color:var(--gold);padding:10px 14px;font:10px 'Space Mono',monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:background .25s,border-color .25s}.replay:hover{background:rgba(230,185,90,.12);border-color:var(--gold)}
        .eyebrow{font:11px 'Space Mono',monospace;letter-spacing:.4em;color:var(--gold);margin-bottom:18px;animation:reveal .8s both}.title{font-family:'Playfair Display',serif;font-size:clamp(28px,4.5vw,58px);font-weight:500;letter-spacing:.02em;margin:0;animation:reveal .8s .12s both}.subtitle{font:12px 'Space Mono',monospace;letter-spacing:.34em;color:rgba(248,246,239,.52);margin:16px 0 44px;animation:reveal .8s .24s both}
        .launch-wrap{position:relative;width:min(290px,68vw);height:min(290px,68vw);display:grid;place-items:center}.launch-wrap:before,.launch-wrap:after{content:"";position:absolute;border:1px solid rgba(230,185,90,.3);border-radius:50%;inset:4%;animation:ring 3s ease-out infinite}.launch-wrap:after{inset:-11%;animation-delay:1.1s;opacity:.4}
        .launch{width:72%;height:72%;border-radius:50%;border:1px solid rgba(230,185,90,.8);background:radial-gradient(circle at 50% 42%,#ed2830 0,#aa1019 35%,#450a10 72%,#150c0f 100%);box-shadow:inset 0 0 35px rgba(255,210,135,.25),0 0 60px rgba(215,25,32,.25);color:var(--white);position:relative;cursor:pointer;animation:breathe 2.8s ease-in-out infinite;transition:transform .2s,box-shadow .2s}.launch:hover{transform:scale(1.04);box-shadow:inset 0 0 35px rgba(255,210,135,.35),0 0 85px rgba(215,25,32,.5)}.launch:active{transform:scale(.96)}.launch span{display:block;font:700 clamp(15px,2vw,22px) 'Space Mono',monospace;letter-spacing:.12em}.launch small{display:block;margin-top:12px;font-size:9px;letter-spacing:.16em;color:#f5d99a}
        .hint{margin-top:40px;color:rgba(248,246,239,.48);font:10px 'Space Mono',monospace;letter-spacing:.18em;animation:reveal 1s .6s both}.kbd{border:1px solid rgba(248,246,239,.35);padding:4px 7px;color:var(--white);margin:0 4px}
        .count{font:clamp(120px,22vw,260px) 'Playfair Display',serif;color:var(--gold);line-height:1;animation:rise .5s}.count-label{font:10px 'Space Mono',monospace;letter-spacing:.38em;color:var(--white);margin-top:20px}
         .finale .stage{animation:rise 1.2s both}.finale .eyebrow{color:var(--red)}.finale .title{font-size:clamp(74px,15vw,180px);font-weight:700;letter-spacing:.08em;color:var(--white);text-shadow:0 0 35px rgba(230,185,90,.3)}.finale .subtitle{color:var(--gold);font-family:'DM Sans',sans-serif;font-size:clamp(15px,2vw,22px);letter-spacing:.08em}.links{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:42px}.link{min-width:138px;padding:14px 22px;border:1px solid rgba(230,185,90,.72);color:var(--white);font:11px 'Space Mono',monospace;letter-spacing:.16em;text-decoration:none;transition:background-color .2s,border-color .2s,color .2s,transform .2s}.link:hover{border-color:var(--white);background:rgba(230,185,90,.14);color:var(--gold);transform:translateY(-2px)}.link:focus-visible{outline:2px solid var(--white);outline-offset:4px}.logo{display:block;width:86px;height:86px;margin-bottom:26px;border:1px solid rgba(230,185,90,.72);border-radius:50%;background:var(--white);box-shadow:0 0 26px rgba(230,185,90,.2);object-fit:contain}
        canvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}.countdown .launch-wrap{display:none}
         @media(max-width:600px){.topline{top:18px;font-size:8px}.topline .mark{font-size:9px}.replay{padding:8px 9px;font-size:8px}.subtitle{letter-spacing:.17em;margin-bottom:32px}.hint{font-size:8px;letter-spacing:.1em}.finale .title{font-size:22vw;letter-spacing:.04em}.links{gap:10px;margin-top:30px}.link{min-width:112px;padding:12px 14px;font-size:9px}}
      `}</style>
      <canvas ref={canvasRef} />
      <section className="stage">
        <header className="topline"><span className="mark"><i /> SMARTISA / CEREMONY CONTROL</span><button className="replay" onClick={reset} aria-label="Replay ceremony">R&nbsp; / &nbsp;Replay</button></header>
        {state === "standby" && <>
          <h1 className="title">PELUNCURAN RESMI APLIKASI SMARTISA</h1>
           <div className="launch-wrap"><button className="launch" onClick={launch} aria-label="Luncurkan Smartisa"><span>LUNCURKAN</span></button></div>
          <p className="hint">TAP CONTROL &nbsp;·&nbsp; PRESS <b className="kbd">SPACE</b> TO ACTIVATE</p>
        </>}
        {state === "countdown" && <><div className="eyebrow">Protokol Peluncuran Aktif</div><div className="count" aria-label={`Countdown ${count}`}>{count > 0 ? count : "—"}</div><div className="count-label">INDONESIA MAJU / SMARTISA</div></>}
         {state === "finale" && <><img className="logo" src="/__mockup/smartisa-logo.png" alt="Logo Smartisa" /><div className="eyebrow">Resmi Diluncurkan</div><h1 className="title">SMARTISA</h1><nav className="links" aria-label="Aplikasi Smartisa"><a className="link" href="https://y4e6icv3cej4ax65idvhusde.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">SMARTISA</a><a className="link" href="https://nswzqjz1jnr821kuh3s9aji1.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">BLP</a><a className="link" href="https://sfptjjfqgqidt4736qzont0l.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">GuruEOB5</a></nav></>}
      </section>
    </main>
  );
}