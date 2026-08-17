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
const HOLD_DURATION_MS = 10_000;

function SmartisaCeremony() {
  const [state, setState] = useState<CeremonyState>('standby');
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const launched = useRef(false);
  const timers = useRef<number[]>([]);
  const countdownInterval = useRef<number | null>(null);
  const holdFrame = useRef<number | null>(null);
  const holdStartedAt = useRef<number | null>(null);
  const holdActive = useRef(false);
  const lastHoldSoundStep = useRef(0);

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

  const sound = useCallback((finale = false, pitchMultiplier = 1) => {
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
      const voices = finale
        ? [
            { frequency: 261.63, delay: 0, peak: 0.16 },
            { frequency: 329.63, delay: 0.12, peak: 0.14 },
            { frequency: 392, delay: 0.24, peak: 0.14 },
            { frequency: 523.25, delay: 0.38, peak: 0.13 },
            { frequency: 659.25, delay: 0.52, peak: 0.12 },
            { frequency: 783.99, delay: 0.68, peak: 0.1 },
          ]
        : [
            { frequency: 74, delay: 0, peak: 0.3 },
            { frequency: 148, delay: 0, peak: 0.12 },
            { frequency: 222, delay: 0.08, peak: 0.08 },
          ];
      voices.forEach(({ frequency, delay, peak }, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = now + delay;
        const duration = finale ? 1.45 : 0.55;
        oscillator.type = finale ? (index % 2 === 0 ? 'sine' : 'triangle') : index === 0 ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency * pitchMultiplier, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * pitchMultiplier * (finale ? 1.02 : 0.82), startAt + duration * 0.82);
        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
      });
      if (finale) {
        const bufferLength = Math.floor(context.sampleRate * 1.4);
        const noiseBuffer = context.createBuffer(1, bufferLength, context.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let index = 0; index < bufferLength; index += 1) {
          noiseData[index] = (Math.random() * 2 - 1) * (1 - index / bufferLength);
        }
        const noise = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const noiseGain = context.createGain();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(900, now);
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.13, now + 0.03);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        noise.buffer = noiseBuffer;
        noise.connect(filter).connect(noiseGain).connect(context.destination);
        noise.start(now);
        noise.stop(now + 1.4);
      }
    } catch {
      // Audio is optional; a restricted browser must not block the launch state.
    }
  }, []);

  const cancelHold = useCallback(() => {
    holdActive.current = false;
    holdStartedAt.current = null;
    if (holdFrame.current !== null) {
      window.cancelAnimationFrame(holdFrame.current);
      holdFrame.current = null;
    }
    setHoldProgress(0);
  }, []);

  const reset = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (countdownInterval.current !== null) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    launched.current = false;
    cancelHold();
    lastHoldSoundStep.current = 0;
    setState('standby');
    setCount(3);
    setFlash(false);
    particles.current = [];
  }, [cancelHold]);

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

  const beginHold = useCallback(() => {
    if (holdActive.current || launched.current || state !== 'standby') return;
    holdActive.current = true;
    holdStartedAt.current = performance.now();
    lastHoldSoundStep.current = 0;
    setHoldProgress(0);
    sound(false, 0.9);

    const tick = (now: number) => {
      if (!holdActive.current || holdStartedAt.current === null) return;
      const progress = Math.min(((now - holdStartedAt.current) / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(progress);
      const soundStep = Math.floor(progress / 10);
      if (soundStep > lastHoldSoundStep.current && soundStep < 10) {
        lastHoldSoundStep.current = soundStep;
        sound(false, 1 + soundStep * 0.08);
      }
      if (progress >= 100) {
        holdActive.current = false;
        holdStartedAt.current = null;
        holdFrame.current = null;
        launch();
        return;
      }
      holdFrame.current = window.requestAnimationFrame(tick);
    };

    holdFrame.current = window.requestAnimationFrame(tick);
  }, [launch, state]);

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
            <h1 className="ceremony-title" data-testid="text-launch-title">PELUNCURAN RESMI APLIKASI SMARTISA</h1>
            <div className="ceremony-launch-wrap">
              <div
                className="ceremony-progress-ring"
                role="progressbar"
                aria-label="Progress peluncuran"
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
                aria-label="Tahan untuk meluncurkan Smartisa selama 10 detik"
                data-testid="button-launch"
              >
                <span>LUNCURKAN</span>
              </button>
            </div>
            <div className="ceremony-hold-progress" aria-live="polite">
              <div className="ceremony-hold-track"><span style={{ width: `${holdProgress}%` }} /></div>
              <span>{holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'TAHAN 10 DETIK'}</span>
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