import { useCallback, useEffect, useRef, useState } from 'react';

type CeremonyState = 'standby' | 'finale';
type ParticleKind = 'spark' | 'confetti' | 'firework';
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
  kind: ParticleKind;
  rotation: number;
};

const RED = '#d71920';
const GOLD = '#e6b95a';
const WHITE = '#f8f6ef';

function SmartisaCeremony() {
  const [state, setState] = useState<CeremonyState>('standby');
  const [flash, setFlash] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const launched = useRef(false);
  const timers = useRef<number[]>([]);

  const burst = useCallback((x: number, y: number, amount: number, firework = false) => {
    const colors = [RED, GOLD, WHITE, '#a80f17'];
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = firework ? 2 + Math.random() * 5 : 2 + Math.random() * 8;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 50 + Math.random() * 80,
        maxLife: 130,
        size: 1 + Math.random() * 4,
        color: colors[i % colors.length],
        gravity: firework ? 0.025 : 0.08,
        kind: firework ? 'firework' : i % 4 === 0 ? 'confetti' : 'spark',
        rotation: Math.random() * 6,
      });
    }
  }, []);

  const reset = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    launched.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState('standby');
    setFlash(false);
    particles.current = [];
  }, []);

  const launch = useCallback(() => {
    if (launched.current || state !== 'standby') return;
    launched.current = true;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Browsers may reject playback when the interaction is not treated as a gesture.
      });
    }
    setFlash(true);
    setState('finale');
    burst(window.innerWidth / 2, window.innerHeight * 0.43, 220);
    const flashTimer = window.setTimeout(() => setFlash(false), 460);
    timers.current.push(flashTimer);
  }, [burst, state]);

  useEffect(() => {
    document.title = 'Smartisa | Peluncuran Resmi';
    const description = 'Official Smartisa launch ceremony.';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') reset();
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        launch();
      }
    };
    window.addEventListener('keydown', keyHandler);
    document.body.style.cursor = state === 'standby' ? 'default' : 'none';
    return () => {
      window.removeEventListener('keydown', keyHandler);
      document.body.style.cursor = 'default';
    };
  }, [launch, reset, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let lastFirework = 0;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = (time: number) => {
      const ratio = window.devicePixelRatio || 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(ratio, ratio);
      if (state === 'finale' && time - lastFirework > 430) {
        lastFirework = time;
        burst(window.innerWidth * (0.16 + Math.random() * 0.68), window.innerHeight * (0.16 + Math.random() * 0.34), 34, true);
      }
      particles.current = particles.current.filter((particle) => particle.life > 0);
      particles.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += particle.gravity;
        particle.vx *= 0.993;
        particle.life -= 1;
        particle.rotation += 0.08;
        context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        context.fillStyle = particle.color;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        if (particle.kind === 'confetti') {
          context.fillRect(-particle.size, -particle.size * 2.5, particle.size * 2, particle.size * 5);
        } else {
          context.beginPath();
          context.arc(0, 0, particle.size, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      });
      context.restore();
      animationFrame.current = window.requestAnimationFrame(draw);
    };
    animationFrame.current = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    };
  }, [burst, state]);

  useEffect(() => () => {
    reset();
  }, [reset]);

  return (
    <main className={`ceremony ${state} ${flash ? 'flashed' : ''}`} aria-live="polite">
      <canvas ref={canvasRef} className="ceremony-canvas" aria-hidden="true" />
      <audio
        ref={audioRef}
        className="ceremony-audio"
        src="/fanfare-trumpet-announcement.mp3"
        preload="auto"
        aria-label="Fanfare peluncuran Smartisa"
      />
      <section className="ceremony-stage">
        {state === 'finale' && (
          <header className="ceremony-topline">
            <span className="ceremony-mark"><i aria-hidden="true" />SMARTISA / CEREMONY CONTROL</span>
            <button className="ceremony-replay" type="button" onClick={reset} aria-label="Replay Smartisa launch ceremony" data-testid="button-replay">
              R&nbsp; / &nbsp;Replay
            </button>
          </header>
        )}
        {state === 'standby' && (
          <div className="ceremony-launch-wrap">
              <button
                className="ceremony-launch"
                type="button"
                onClick={launch}
                aria-label="Luncurkan Smartisa"
                data-testid="button-launch"
              >
                <span>LUNCURKAN</span>
              </button>
          </div>
        )}
        {state === 'finale' && (
          <>
            <img className="ceremony-logo" src="/smartisa-logo.png" alt="Logo Smartisa" />
            <div className="ceremony-eyebrow">Resmi Diluncurkan</div>
            <h1 className="ceremony-title" data-testid="text-finale-brand">SMARTISA</h1>
            <nav className="ceremony-links" aria-label="Aplikasi Smartisa">
              <a className="ceremony-link" href="https://y4e6icv3cej4ax65idvhusde.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">SMARTISA</a>
              <a className="ceremony-link" href="https://nswzqjz1jnr821kuh3s9aji1.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">BLP</a>
              <a className="ceremony-link" href="https://sfptjjfqgqidt4736qzont0l.157.10.161.229.sslip.io/" target="_blank" rel="noreferrer">GuruEOB5</a>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}

export default SmartisaCeremony;