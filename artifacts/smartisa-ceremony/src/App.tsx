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
const HOLD_DURATION_MS = 5_000;

function SmartisaCeremony() {
  const [state, setState] = useState<CeremonyState>('standby');
  const [flash, setFlash] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const launched = useRef(false);
  const timers = useRef<number[]>([]);
  const holdFrame = useRef<number | null>(null);
  const holdStartedAt = useRef<number | null>(null);
  const holdActive = useRef(false);
  const countdownContext = useRef<AudioContext | null>(null);
  const lastCountdownSecond = useRef<number | null>(null);
  const mediaAudioSource = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaAudioGain = useRef<GainNode | null>(null);

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

  const cancelHold = useCallback(() => {
    holdActive.current = false;
    holdStartedAt.current = null;
    if (holdFrame.current !== null) {
      window.cancelAnimationFrame(holdFrame.current);
      holdFrame.current = null;
    }
    lastCountdownSecond.current = null;
    if (!launched.current) setHoldProgress(0);
  }, []);

  const getCountdownContext = useCallback(() => {
    if (!countdownContext.current && typeof window.AudioContext !== 'undefined') {
      countdownContext.current = new window.AudioContext();
    }
    return countdownContext.current;
  }, []);

  const playCountdownTick = useCallback((secondsRemaining: number) => {
    const context = getCountdownContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isFinalCount = secondsRemaining <= 3;
    const startAt = context.currentTime;
    const duration = isFinalCount ? 0.16 : 0.1;
    const frequency = (isFinalCount ? 720 : 460) + (5 - secondsRemaining) * 24;

    oscillator.type = isFinalCount ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, startAt + duration);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(isFinalCount ? 0.3 : 0.2, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }, [getCountdownContext]);

  const prepareAudio = useCallback(() => {
    const audio = audioRef.current;
    const context = getCountdownContext();
    if (context?.state === 'suspended') void context.resume();
    if (!audio) return;
    audio.volume = 1;
    if (context && !mediaAudioSource.current) {
      try {
        const source = context.createMediaElementSource(audio);
        const gain = context.createGain();
        gain.gain.value = 1.8;
        source.connect(gain);
        gain.connect(context.destination);
        mediaAudioSource.current = source;
        mediaAudioGain.current = gain;
      } catch {
        // The direct audio path remains available if the browser disallows routing.
      }
    }
    audio.muted = true;
    audio.currentTime = 0;
    const unlock = audio.play();
    if (unlock) {
      void unlock.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }).catch(() => {
        audio.muted = false;
      });
    }
  }, [getCountdownContext]);

  const reset = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    launched.current = false;
    cancelHold();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState('standby');
    setFlash(false);
    setHoldProgress(0);
    particles.current = [];
  }, [cancelHold]);

  const finishLaunch = useCallback(() => {
    if (launched.current) return;
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
  }, [burst]);

  const beginHold = useCallback(() => {
    if (holdActive.current || launched.current || state !== 'standby') return;
    holdActive.current = true;
    holdStartedAt.current = performance.now();
    setHoldProgress(0);
    prepareAudio();
    playCountdownTick(5);
    lastCountdownSecond.current = 5;

    const tick = (now: number) => {
      if (!holdActive.current || holdStartedAt.current === null) return;
      const elapsed = now - holdStartedAt.current;
      const progress = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        holdActive.current = false;
        holdStartedAt.current = null;
        holdFrame.current = null;
        finishLaunch();
        return;
      }
      const secondsRemaining = Math.max(1, Math.ceil((HOLD_DURATION_MS - elapsed) / 1000));
      if (secondsRemaining !== lastCountdownSecond.current) {
        playCountdownTick(secondsRemaining);
        lastCountdownSecond.current = secondsRemaining;
      }
      holdFrame.current = window.requestAnimationFrame(tick);
    };

    holdFrame.current = window.requestAnimationFrame(tick);
  }, [finishLaunch, playCountdownTick, prepareAudio, state]);

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
        beginHold();
      }
    };
    const keyUpHandler = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        cancelHold();
      }
    };
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('keyup', keyUpHandler);
    document.body.style.cursor = state === 'standby' ? 'default' : 'none';
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('keyup', keyUpHandler);
      document.body.style.cursor = 'default';
    };
  }, [beginHold, cancelHold, reset, state]);

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
            <div
              className="ceremony-progress-ring"
              role="progressbar"
              aria-label="Progress tahan untuk meluncurkan"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(holdProgress)}
              style={{ background: `conic-gradient(var(--ceremony-gold) ${holdProgress}%, rgba(230, 185, 90, .16) 0)` }}
            />
            <button
              className="ceremony-launch"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                beginHold();
              }}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onLostPointerCapture={cancelHold}
              onKeyDown={(event) => {
                if (event.code === 'Space' || event.key === 'Enter') {
                  event.preventDefault();
                  if (!event.repeat) beginHold();
                }
              }}
              onKeyUp={(event) => {
                if (event.code === 'Space' || event.key === 'Enter') {
                  event.preventDefault();
                  cancelHold();
                }
              }}
              aria-label="Tahan untuk meluncurkan Smartisa selama 5 detik"
              data-testid="button-launch"
            >
              <span>LUNCURKAN</span>
              <small>TAHAN 5 DETIK</small>
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