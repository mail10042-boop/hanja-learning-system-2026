// Web Audio API tone and sound synthesis for classroom timer alarms & games

export type AlarmSoundType = 'bell' | 'bomb' | 'funny' | 'rooster';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * 1. 자명종 소리 (Classic Mechanical Alarm Clock - 3 bursts)
 */
export function playBellAlarm(ctx: AudioContext, enabled: boolean = true) {
  if (!enabled) return;
  for (let cycle = 0; cycle < 3; cycle++) {
    setTimeout(() => {
      try {
        const now = ctx.currentTime;
        const duration = 0.85;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.75, now);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        masterGain.connect(ctx.destination);

        const tremoloOsc = ctx.createOscillator();
        tremoloOsc.frequency.setValueAtTime(18, now);
        const tremoloGain = ctx.createGain();
        tremoloGain.gain.setValueAtTime(0.5, now);
        tremoloOsc.connect(tremoloGain.gain);

        const freqs = [1200, 1480, 1850];
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now);

          const bandpass = ctx.createBiquadFilter();
          bandpass.type = 'bandpass';
          bandpass.frequency.setValueAtTime(freq, now);
          bandpass.Q.setValueAtTime(3.0, now);

          osc.connect(bandpass);
          bandpass.connect(tremoloGain);
          osc.start(now);
          osc.stop(now + duration);
        });

        tremoloGain.connect(masterGain);
        tremoloOsc.start(now);
        tremoloOsc.stop(now + duration);

        const pingOsc = ctx.createOscillator();
        const pingGain = ctx.createGain();
        pingOsc.type = 'triangle';
        pingOsc.frequency.setValueAtTime(987.77, now);
        pingGain.gain.setValueAtTime(0.5, now);
        pingGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        pingOsc.connect(pingGain);
        pingGain.connect(ctx.destination);
        pingOsc.start(now);
        pingOsc.stop(now + duration);
      } catch (err) {
        console.warn('Bell alarm error', err);
      }
    }, cycle * 1000);
  }
}

/**
 * 2. 폭탄 소리 (Bomb / Dramatic Fuse whistle + Massive BOOM x 2)
 */
export function playBombAlarm(ctx: AudioContext, enabled: boolean = true) {
  if (!enabled) return;

  for (let burst = 0; burst < 2; burst++) {
    setTimeout(() => {
      try {
        const now = ctx.currentTime;

        // 1. Fuse whistle rising
        const whistle = ctx.createOscillator();
        const whistleGain = ctx.createGain();
        whistle.type = 'sawtooth';
        whistle.frequency.setValueAtTime(300, now);
        whistle.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
        whistleGain.gain.setValueAtTime(0.2, now);
        whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        whistle.connect(whistleGain);
        whistleGain.connect(ctx.destination);
        whistle.start(now);
        whistle.stop(now + 0.4);

        // 2. Huge Explosion Boom (Noise + Sub-bass drop) at now + 0.38s
        const boomTime = now + 0.38;
        const boomDuration = 1.2;

        // Sub bass
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(150, boomTime);
        bassOsc.frequency.exponentialRampToValueAtTime(30, boomTime + boomDuration);

        bassGain.gain.setValueAtTime(0.9, boomTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, boomTime + boomDuration);

        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(boomTime);
        bassOsc.stop(boomTime + boomDuration);

        // White Noise Buffer Explosion
        const bufferSize = ctx.sampleRate * boomDuration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, boomTime);
        filter.frequency.exponentialRampToValueAtTime(50, boomTime + boomDuration);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, boomTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, boomTime + boomDuration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noise.start(boomTime);
        noise.stop(boomTime + boomDuration);
      } catch (err) {
        console.warn('Bomb audio error', err);
      }
    }, burst * 1600);
  }
}

/**
 * 3. 끝! (웃긴 소리 - Funny Cartoon Boing/Horn + TTS "끝!")
 */
export function playFunnyAlarm(ctx: AudioContext, enabled: boolean = true) {
  if (!enabled) return;

  // Speak "끝! 끝! 시간 끝!" using Korean Web Speech API if supported
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance('끝! 시간 끝났습니다!');
      utter.lang = 'ko-KR';
      utter.pitch = 1.6; // High funny pitch
      utter.rate = 1.3;  // Energetic speed
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech error
    }
  }

  // Play comical cartoon slide + spring sound + party fanfare
  for (let round = 0; round < 3; round++) {
    setTimeout(() => {
      try {
        const now = ctx.currentTime;

        // Comical slide whistle down
        const slide = ctx.createOscillator();
        const slideGain = ctx.createGain();
        slide.type = 'triangle';
        slide.frequency.setValueAtTime(900, now);
        slide.frequency.exponentialRampToValueAtTime(200, now + 0.4);

        slideGain.gain.setValueAtTime(0.4, now);
        slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        slide.connect(slideGain);
        slideGain.connect(ctx.destination);
        slide.start(now);
        slide.stop(now + 0.45);

        // Boing spring effect (at now + 0.4s)
        const boingTime = now + 0.4;
        const boing = ctx.createOscillator();
        const boingGain = ctx.createGain();
        boing.type = 'sine';
        boing.frequency.setValueAtTime(180, boingTime);
        boing.frequency.exponentialRampToValueAtTime(540, boingTime + 0.15);
        boing.frequency.exponentialRampToValueAtTime(220, boingTime + 0.35);

        boingGain.gain.setValueAtTime(0.5, boingTime);
        boingGain.gain.exponentialRampToValueAtTime(0.001, boingTime + 0.4);

        boing.connect(boingGain);
        boingGain.connect(ctx.destination);
        boing.start(boingTime);
        boing.stop(boingTime + 0.4);
      } catch (err) {
        console.warn('Funny alarm error', err);
      }
    }, round * 900);
  }
}

/**
 * 4. 닭 소리 (Rooster Crow / 꼬끼오~! x 3)
 */
export function playRoosterAlarm(ctx: AudioContext, enabled: boolean = true) {
  if (!enabled) return;

  for (let crow = 0; crow < 3; crow++) {
    setTimeout(() => {
      try {
        const now = ctx.currentTime;

        // Rooster crowing: "꼬~ (low-mid) - 끼~ (high piercing) - 오~! (vibrato drop)"
        // Note 1: 꼬 (0.0 ~ 0.2s: ~450Hz -> 650Hz)
        // Note 2: 끼 (0.2 ~ 0.5s: 900Hz -> 1100Hz piercing)
        // Note 3: 오~ (0.5 ~ 1.1s: 800Hz -> 400Hz with vibrato)

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';

        // Frequency envelope of rooster crow
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.linearRampToValueAtTime(650, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1150, now + 0.45);
        osc.frequency.linearRampToValueAtTime(950, now + 0.7);
        osc.frequency.exponentialRampToValueAtTime(450, now + 1.1);

        // Vocal tract formant filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.setValueAtTime(4.0, now);

        // Tremolo vibrato on tail
        const vibrato = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibrato.frequency.setValueAtTime(12, now); // 12Hz wobble
        vibratoGain.gain.setValueAtTime(25, now);
        vibrato.connect(osc.frequency);
        vibrato.start(now + 0.5);
        vibrato.stop(now + 1.1);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.setValueAtTime(0.8, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.15);
      } catch (err) {
        console.warn('Rooster audio error', err);
      }
    }, crow * 1300);
  }
}

/**
 * Main Master Alarm Dispatcher
 */
export function playMasterAlarm(soundType: AlarmSoundType = 'bell', enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (soundType) {
    case 'bomb':
      playBombAlarm(ctx, enabled);
      break;
    case 'funny':
      playFunnyAlarm(ctx, enabled);
      break;
    case 'rooster':
      playRoosterAlarm(ctx, enabled);
      break;
    case 'bell':
    default:
      playBellAlarm(ctx, enabled);
      break;
  }
}

export const playAlarm = (enabled: boolean = true, count: number = 3, soundType: AlarmSoundType = 'bell') => {
  playMasterAlarm(soundType, enabled);
};

export const playTimerAlarm = (count: number = 3, enabled: boolean = true, soundType: AlarmSoundType = 'bell') => {
  playMasterAlarm(soundType, enabled);
};

export function playBeep(enabled: boolean = true, freq: number = 520, duration: number = 0.08) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  } catch {
    // Ignore audio error
  }
}

export function playSuccessChime(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.3, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.4);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  } catch (err) {
    console.warn('Audio play error', err);
  }
}
