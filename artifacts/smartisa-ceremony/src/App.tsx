import { useCallback, useEffect, useRef, useState } from 'react';

type CeremonyState = 'standby' | 'countdown' | 'finale';
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
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const launched = useRef(false);
  const timers = useRef<number[]>([]);
  const countdownInterval = useRef<number | null>(null);

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

  const sound = useCallback((finale = false) => {
    try {
      const browserWindow = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;
      if (!AudioContextConstructor) return;
      audioContext.current ??= new AudioContextConstructor();
      const context = audioContext.current;
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = finale ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(finale ? 110 : 74, now);
      oscillator.frequency.exponentialRampToValueAtTime(finale ? 880 : 42, now + (finale ? 2.2 : 0.7));
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(finale ? 0.25 : 0.5, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (finale ? 2.6 : 0.9));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (finale ? 2.7 : 1));
    } catch {
      // Audio is optional; a restricted browser must not block the launch state.
    }
  }, []);

  const reset = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (countdownInterval.current !== null) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    launched.current = false;
    setState('standby');
    setCount(3);
    setFlash(false);
    particles.current = [];
  }, []);

  const launch = useCallback(() => {
    if (launched.current || state !== 'standby') return;
    launched.current = true;
    sound();
    setState('countdown');
    let nextCount = 3;
    countdownInterval.current = window.setInterval(() => {
      nextCount -= 1;
      setCount(nextCount);
      sound();
      if (nextCount <= 0) {
        if (countdownInterval.current !== null) {
          window.clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        const finaleTimer = window.setTimeout(() => {
          setFlash(true);
          sound(true);
          setState('finale');
          burst(window.innerWidth / 2, window.innerHeight * 0.43, 220);
          const flashTimer = window.setTimeout(() => setFlash(false), 460);
          timers.current.push(flashTimer);
        }, 520);
        timers.current.push(finaleTimer);
      }
    }, 800);
    const intervalStopTimer = window.setTimeout(() => {
      if (countdownInterval.current !== null) {
        window.clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }, 4200);
    timers.current.push(intervalStopTimer);
  }, [burst, sound, state]);

  useEffect(() => {
    document.title = 'Smartisa | Peluncuran Resmi — HUT RI ke-81';
    const description = 'Official Smartisa launch ceremony for HUT Kemerdekaan Republik Indonesia ke-81.';
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
    if (audioContext.current) void audioContext.current.close();
  }, [reset]);

  return (
    <main className={`ceremony ${state} ${flash ? 'flashed' : ''}`} aria-live="polite">
      <canvas ref={canvasRef} className="ceremony-canvas" aria-hidden="true" />
      <section className="ceremony-stage">
        <header className="ceremony-topline">
          <span className="ceremony-mark"><i aria-hidden="true" />SMARTISA / CEREMONY CONTROL</span>
          <button className="ceremony-replay" type="button" onClick={reset} aria-label="Replay Smartisa launch ceremony" data-testid="button-replay">
            R&nbsp; / &nbsp;Replay
          </button>
        </header>
        {state === 'standby' && (
          <>
            <div className="ceremony-eyebrow" data-testid="text-ceremony-agenda">Agenda 01 &nbsp;—&nbsp; Momen Peresmian</div>
            <h1 className="ceremony-title" data-testid="text-launch-title">PELUNCURAN RESMI APLIKASI SMARTISA</h1>
            <p className="ceremony-subtitle" data-testid="text-hut-title">HUT KEMERDEKAAN RI KE-81</p>
            <div className="ceremony-launch-wrap">
              <button
                className="ceremony-launch"
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  launch();
                }}
                onClick={launch}
                onKeyDown={(event) => {
                  if (event.code === 'Space' || event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
                aria-label="Touch to launch Smartisa"
                data-testid="button-launch"
              >
                <span>TOUCH<br />TO LAUNCH</span>
                <small>SENTUH UNTUK MERESMIKAN</small>
              </button>
            </div>
          </>
        )}
        {state === 'countdown' && (
          <>
            <div className="ceremony-eyebrow">Protokol Peluncuran Aktif</div>
            <div className="ceremony-count" aria-label={`Countdown ${count}`} data-testid="status-countdown">{count > 0 ? count : '—'}</div>
            <div className="ceremony-count-label">INDONESIA MAJU / SMARTISA</div>
          </>
        )}
        {state === 'finale' && (
          <>
            <div className="ceremony-seal" aria-label="HUT Republik Indonesia ke-81">81<br />RI</div>
            <div className="ceremony-eyebrow">Resmi Diluncurkan</div>
            <h1 className="ceremony-title" data-testid="text-finale-brand">SMARTISA</h1>
            <p className="ceremony-subtitle" data-testid="text-finale-tagline">Solusi Cerdas untuk Indonesia Maju</p>
            <div className="ceremony-final-line">DIRGAHAYU REPUBLIK INDONESIA &nbsp;·&nbsp; 17 AGUSTUS 2026</div>
          </>
        )}
      </section>
    </main>
  );
}

export default SmartisaCeremony;