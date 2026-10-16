import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Volume2,
  Bell,
  Minimize2,
  Maximize2,
  Tv,
  X,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Sliders,
} from 'lucide-react';
import { AlarmSoundType, playAlarm, playBeep, playMasterAlarm } from '../utils/audio';

interface FloatingTimerProps {
  soundEnabled: boolean;
  onClose?: () => void;
  initialSeconds?: number;
}

const ALARM_STORAGE_KEY = 'hanja_timer_alarm_sound';
const TIMER_SIZE_STORAGE_KEY = 'hanja_timer_size_mode';
const TIMER_SCALE_STORAGE_KEY = 'hanja_timer_scale_pct';

const ALARM_SOUND_OPTIONS: { id: AlarmSoundType; label: string; icon: string; desc: string }[] = [
  { id: 'bell', label: '자명종', icon: '⏰', desc: '따르릉~ 따르릉~ 따르릉~ (3회)' },
  { id: 'bomb', label: '폭탄 소리', icon: '💣', desc: '휘익- 쾅! 쾅! 쾅! (3회)' },
  { id: 'rooster', label: '닭 소리', icon: '🐓', desc: '꼬~끼~오~! (3회)' },
];

export const FloatingTimer: React.FC<FloatingTimerProps> = ({
  soundEnabled,
  onClose,
  initialSeconds = 60,
}) => {
  // Timer State (starts at initialSeconds, default 60s/1min)
  const [totalSeconds, setTotalSeconds] = useState<number>(initialSeconds);
  const [remaining, setRemaining] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);

  // Selected Alarm Sound
  const [alarmSound, setAlarmSound] = useState<AlarmSoundType>(() => {
    try {
      const saved = localStorage.getItem(ALARM_STORAGE_KEY) as AlarmSoundType;
      if (['bell', 'bomb', 'rooster'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'bell';
  });

  // Size Mode: 'large' (학생용 대형 시계), 'medium' (기본 표준), 'mini' (작은 칩)
  const [sizeMode, setSizeMode] = useState<'large' | 'medium' | 'mini'>(() => {
    try {
      const saved = localStorage.getItem(TIMER_SIZE_STORAGE_KEY);
      if (saved === 'large' || saved === 'medium' || saved === 'mini') {
        return saved;
      }
    } catch {}
    return 'medium'; // Default to medium/readable size for students
  });

  // Continuous Custom Scale Percent (70% ~ 220%)
  const [timerScale, setTimerScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TIMER_SCALE_STORAGE_KEY);
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num >= 70 && num <= 220) return num;
      }
    } catch {}
    return 100;
  });

  const handleUpdateScale = (newScale: number) => {
    const clamped = Math.max(70, Math.min(220, Math.round(newScale)));
    setTimerScale(clamped);
    try {
      localStorage.setItem(TIMER_SCALE_STORAGE_KEY, String(clamped));
    } catch {}
    setPosition((prev) => clampPos(prev.x, prev.y, clamped));
  };

  // Save selected sound & size
  useEffect(() => {
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, alarmSound);
    } catch {}
  }, [alarmSound]);

  useEffect(() => {
    try {
      localStorage.setItem(TIMER_SIZE_STORAGE_KEY, sizeMode);
    } catch {}
  }, [sizeMode]);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDirectInputOpen, setIsDirectInputOpen] = useState<boolean>(false);
  const [inputMin, setInputMin] = useState<number>(Math.floor(initialSeconds / 60));
  const [inputSec, setInputSec] = useState<number>(initialSeconds % 60);

  // Clamping helper
  const clampPos = (x: number, y: number, currentScale = timerScale) => {
    if (typeof window === 'undefined') return { x, y };
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = currentScale / 100;
    const rightMargin = (sizeMode === 'large' ? 400 : sizeMode === 'medium' ? 340 : 330) * ratio;
    const bottomMargin = (sizeMode === 'mini' ? 70 : 440) * ratio;
    const safeX = Math.max(10, Math.min(width - rightMargin - 10, x));
    const safeY = Math.max(10, Math.min(height - bottomMargin - 10, y));
    return { x: safeX, y: safeY };
  };

  // Position & Dragging (fixed coordinate)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const rightPadding = 360;
      const initX = Math.max(16, window.innerWidth - rightPadding);
      return clampPos(initX, 76, 100);
    }
    return { x: 100, y: 76 };
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  // Window resize handler: keeps timer strictly on-screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPos(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sizeMode, timerScale]);

  // Countdown Interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && remaining > 0) {
      interval = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsAlarmActive(true);
            playAlarm(soundEnabled, 3, alarmSound);
            setTimeout(() => setIsAlarmActive(false), 4500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (remaining === 0 && isRunning) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, remaining, soundEnabled, alarmSound]);

  // Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: position.x,
      initPosY: position.y,
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        initPosX: position.x,
        initPosY: position.y,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const targetX = dragStartRef.current.initPosX + dx;
      const targetY = dragStartRef.current.initPosY + dy;
      setPosition(clampPos(targetX, targetY));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartRef.current.startX;
      const dy = e.touches[0].clientY - dragStartRef.current.startY;
      const targetX = dragStartRef.current.initPosX + dx;
      const targetY = dragStartRef.current.initPosY + dy;
      setPosition(clampPos(targetX, targetY));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, sizeMode]);

  const toggleRun = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (remaining <= 0) {
      setTimerExact(60);
      setIsRunning(true);
      return;
    }
    playBeep(soundEnabled, 540, 0.08);
    setIsRunning((prev) => !prev);
  };

  // Reset to zero or re-arm
  const handleResetToZero = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playBeep(soundEnabled, 480, 0.06);
    setIsRunning(false);
    setRemaining(0);
    setTotalSeconds(0);
    setInputMin(0);
    setInputSec(0);
  };

  const setTimerExact = (sec: number) => {
    playBeep(soundEnabled, 520, 0.06);
    setIsRunning(false);
    setTotalSeconds(sec);
    setRemaining(sec);
    setInputMin(Math.floor(sec / 60));
    setInputSec(sec % 60);
  };

  const adjustSec = (delta: number) => {
    playBeep(soundEnabled, 460, 0.05);
    setRemaining((prev) => {
      const next = Math.max(0, prev + delta);
      setTotalSeconds(next);
      setInputMin(Math.floor(next / 60));
      setInputSec(next % 60);
      return next;
    });
  };

  const handleApplyCustomTime = () => {
    const total = inputMin * 60 + inputSec;
    setTimerExact(total);
    setIsDirectInputOpen(false);
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentOption = ALARM_SOUND_OPTIONS.find((opt) => opt.id === alarmSound) || ALARM_SOUND_OPTIONS[0];

  return (
    <div
      id="floating-classroom-timer"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        transform: `scale(${timerScale / 100})`,
        transformOrigin: 'top left',
      }}
      className={`select-none transition-transform duration-75 ${
        isAlarmActive
          ? 'animate-bounce ring-4 ring-rose-500 shadow-2xl rounded-2xl'
          : 'shadow-2xl'
      }`}
    >
      {/* 1. MINI COMPACT CHIP MODE (축소 모드: 시계 숫자를 훨씬 더 크고 뚜렷하게 표시 + 크기 조절 기능) */}
      {sizeMode === 'mini' ? (
        <div
          className="bg-slate-900/95 hover:bg-slate-900 backdrop-blur-md border border-slate-700/80 hover:border-blue-400 text-white rounded-2xl shadow-2xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 transition-all ring-2 ring-blue-500/20 hover:ring-blue-500/40"
          style={{ minWidth: '320px' }}
        >
          {/* Drag Handle with Clock icon */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="flex items-center gap-1 cursor-move text-slate-400 hover:text-slate-200 select-none px-1 py-1 rounded hover:bg-slate-800"
            title="드래그하여 원하는 위치로 이동"
          >
            <GripHorizontal className="w-4 h-4" />
            <Clock className="w-4 h-4 text-blue-400" />
          </div>

          {/* Big High-Visibility Digital Readout: 축소했을 때도 숫자가 훨씬 더 크고 시원하게 보이도록 */}
          <div
            onClick={toggleRun}
            className="font-mono text-3xl sm:text-4xl font-black text-emerald-400 tracking-wider leading-none drop-shadow-[0_0_12px_rgba(52,211,153,0.5)] cursor-pointer hover:text-emerald-300 transition px-1 py-0.5"
            title="클릭하여 시작 / 일시정지"
          >
            {formatTime(remaining)}
          </div>

          {/* Run/Pause Button */}
          <button
            type="button"
            onClick={toggleRun}
            className={`p-2 rounded-xl text-slate-950 font-black transition cursor-pointer active:scale-90 shadow-xs ${
              isRunning ? 'bg-amber-400 hover:bg-amber-300' : 'bg-emerald-400 hover:bg-emerald-300'
            }`}
            title={isRunning ? '일시정지' : '시작'}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetToZero}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer active:scale-90"
            title="0초 초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Direct Size Scale Adjustment on Mini Mode: [-] [+] and Percent */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => handleUpdateScale(timerScale - 10)}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="시계 10% 축소 (작게)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-200 px-1 min-w-[34px] text-center">
              {timerScale}%
            </span>
            <button
              type="button"
              onClick={() => handleUpdateScale(timerScale + 10)}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="시계 10% 확대 (크게)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand to Standard/Full view */}
          <button
            type="button"
            onClick={() => setSizeMode('medium')}
            className="px-2 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-700/60 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="상세 설정 및 프리셋 타이머 열기"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>펼치기</span>
          </button>

          {/* Close */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white transition cursor-pointer"
              title="타이머 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* 2. MEDIUM & LARGE STUDENT-VISIBLE CLASSROOM DISPLAY */
        <div
          className={`bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
            sizeMode === 'large' ? 'w-80 sm:w-96' : 'w-72 sm:w-80'
          }`}
        >
          {/* Header Bar */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="px-3.5 py-2 bg-slate-800/95 border-b border-slate-700/80 flex items-center justify-between cursor-move hover:bg-slate-800 transition"
            title="드래그하여 원하는 위치로 이동"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <GripHorizontal className="w-4 h-4 text-slate-400" />
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="font-extrabold tracking-tight">
                {sizeMode === 'large' ? '학생용 대형 시계' : '수업 타이머'}
              </span>
            </div>

            {/* Size & Setting & Close Buttons */}
            <div className="flex items-center gap-1">
              {isAlarmActive && (
                <span className="text-xs font-black text-rose-400 animate-pulse flex items-center gap-0.5 mr-1">
                  <Bell className="w-3.5 h-3.5" />
                  <span>종료!</span>
                </span>
              )}

              {/* Direct Size Zoom Scale [-] [+] */}
              <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => handleUpdateScale(timerScale - 10)}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                  title="크기 10% 축소"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-200 px-1 min-w-[32px] text-center">
                  {timerScale}%
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateScale(timerScale + 10)}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                  title="크기 10% 확대"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              {/* Toggle Large vs Medium */}
              <button
                type="button"
                onClick={() => setSizeMode(sizeMode === 'large' ? 'medium' : 'large')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                  sizeMode === 'large'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
                title={sizeMode === 'large' ? '기본 크기로 변경' : '학생들이 잘 보이게 초대형으로 변경'}
              >
                <Tv className="w-3 h-3" />
                <span>{sizeMode === 'large' ? '표준' : '대형'}</span>
              </button>

              {/* Minimize to mini chip */}
              <button
                type="button"
                onClick={() => setSizeMode('mini')}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white cursor-pointer text-[11px] font-bold flex items-center gap-1"
                title="시계만 보이게 작게 축소"
              >
                <Minimize2 className="w-3 h-3" />
                <span>축소</span>
              </button>

              {/* Settings Toggle */}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-1 rounded transition cursor-pointer ${
                  isSettingsOpen
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="설정 및 크기 세부 조절"
              >
                {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              {onClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-1 rounded bg-slate-700/80 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer ml-0.5"
                  title="타이머 닫기 (숨기기)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Core Visible Display Area */}
          <div className="p-3 sm:p-4 space-y-3">
            {/* BIG HIGH-VISIBILITY DIGITAL CLOCK (학생들이 멀리서도 뚜렷하게 확인 가능) */}
            <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-3 sm:p-4 shadow-inner flex flex-col items-center justify-center relative">
              <div
                onClick={() => setIsDirectInputOpen(!isDirectInputOpen)}
                className={`font-mono font-black text-emerald-400 tracking-widest leading-none drop-shadow-[0_0_12px_rgba(52,211,153,0.35)] cursor-pointer hover:text-emerald-300 transition ${
                  sizeMode === 'large'
                    ? 'text-4xl sm:text-5xl md:text-6xl py-1'
                    : 'text-3xl sm:text-4xl py-0.5'
                }`}
                title="클릭하여 원하는 시간 직접 입력"
              >
                {formatTime(remaining)}
              </div>

              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-bold">
                <span>{isRunning ? '⏱️ 카운트다운 진행 중' : remaining === 0 ? '대기 중 (00:00)' : '⏸️ 일시 정지됨'}</span>
                <span>•</span>
                <span>알람: {currentOption.icon} {currentOption.label}</span>
              </div>
            </div>

            {/* Primary Action Buttons: Big Start/Pause & Reset */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleRun}
                className={`py-2.5 px-3 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    <span>일시정지</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>{remaining === 0 ? '10초 시작' : '타이머 시작'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetToZero}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-900/70 text-slate-200 hover:text-white font-black text-sm sm:text-base flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 border border-slate-700/80"
                title="0초로 초기화"
              >
                <RotateCcw className="w-4 h-4" />
                <span>0초 리셋</span>
              </button>
            </div>

            {/* Quick Preset Buttons for Classroom Speed */}
            <div className="space-y-1.5">
              {/* Row 1: 10s, 30s, 1m, 1m 30s */}
              <div className="grid grid-cols-4 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTimerExact(10)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  10초
                </button>
                <button
                  type="button"
                  onClick={() => setTimerExact(30)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  30초
                </button>
                <button
                  type="button"
                  onClick={() => setTimerExact(60)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  1분
                </button>
                <button
                  type="button"
                  onClick={() => setTimerExact(90)}
                  className="py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white font-bold transition text-center cursor-pointer active:scale-95 border border-blue-700/50"
                  title="1분 30초 (90초) 설정"
                >
                  1분 30초
                </button>
              </div>

              {/* Row 2: 3m, 5m, 10m, Custom */}
              <div className="grid grid-cols-4 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTimerExact(180)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  3분
                </button>
                <button
                  type="button"
                  onClick={() => setTimerExact(300)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  5분
                </button>
                <button
                  type="button"
                  onClick={() => setTimerExact(600)}
                  className="py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white font-bold transition text-center cursor-pointer active:scale-95 border border-blue-700/50"
                  title="10분 (600초) 설정"
                >
                  10분
                </button>
                <button
                  type="button"
                  onClick={() => setIsDirectInputOpen(!isDirectInputOpen)}
                  className={`py-1.5 rounded-lg font-bold transition text-center cursor-pointer active:scale-95 border ${
                    isDirectInputOpen
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="시간 직접 입력"
                >
                  직접입력
                </button>
              </div>

              {/* Adjust +/- Seconds */}
              <div className="grid grid-cols-4 gap-1 text-[11px] pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustSec(-10)}
                  className="py-1 rounded bg-slate-800/80 hover:bg-rose-900/80 text-slate-300 font-bold transition text-center cursor-pointer"
                >
                  -10초
                </button>
                <button
                  type="button"
                  onClick={() => adjustSec(+10)}
                  className="py-1 rounded bg-slate-800/80 hover:bg-emerald-900/80 text-slate-300 font-bold transition text-center cursor-pointer"
                >
                  +10초
                </button>
                <button
                  type="button"
                  onClick={() => adjustSec(+30)}
                  className="py-1 rounded bg-slate-800/80 hover:bg-blue-900/80 text-slate-300 font-bold transition text-center cursor-pointer"
                >
                  +30초
                </button>
                <button
                  type="button"
                  onClick={() => adjustSec(+60)}
                  className="py-1 rounded bg-slate-800/80 hover:bg-blue-900/80 text-slate-300 font-bold transition text-center cursor-pointer"
                >
                  +1분
                </button>
              </div>
            </div>

            {/* Direct Custom Time Input */}
            {isDirectInputOpen && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-blue-500/60 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span>시간 직접 설정:</span>
                  <button
                    type="button"
                    onClick={() => setIsDirectInputOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕ 닫기
                  </button>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputMin}
                    onChange={(e) => setInputMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 text-center py-1 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-sm"
                  />
                  <span className="text-slate-300 font-bold">분</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={inputSec}
                    onChange={(e) => setInputSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-12 text-center py-1 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-sm"
                  />
                  <span className="text-slate-300 font-bold">초</span>
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className="ml-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                  >
                    설정
                  </button>
                </div>
              </div>
            )}

            {/* Expandable Settings: Size Adjustment & Alarm Sound */}
            {isSettingsOpen && (
              <div className="pt-2.5 border-t border-slate-800 space-y-3 text-xs">
                {/* 1. Size Scale Controller (크기 자유 조절) */}
                <div className="space-y-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between font-bold text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>시계 크기 세부 조절 ({timerScale}%)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateScale(100)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      기본(100%) 초기화
                    </button>
                  </div>

                  {/* Preset Scale Buttons */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[
                      { scale: 80, label: '80% 작게' },
                      { scale: 100, label: '100% 보통' },
                      { scale: 125, label: '125% 크게' },
                      { scale: 150, label: '150% 대형' },
                      { scale: 180, label: '180% 특대' },
                    ].map((item) => (
                      <button
                        key={item.scale}
                        type="button"
                        onClick={() => handleUpdateScale(item.scale)}
                        className={`py-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                          timerScale === item.scale
                            ? 'bg-blue-600 text-white border-blue-400 shadow-2xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Smooth Slider */}
                  <div className="flex items-center gap-2 pt-1">
                    <ZoomOut className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="range"
                      min={70}
                      max={220}
                      step={5}
                      value={timerScale}
                      onChange={(e) => handleUpdateScale(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      title={`원하는 시계 크기 슬라이더 (${timerScale}%)`}
                    />
                    <ZoomIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* 2. Alarm Sound Options */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-300 text-[11px]">
                    <span>종료 알람 소리 선택 (3회 울리고 멈춤)</span>
                    <button
                      type="button"
                      onClick={() => playMasterAlarm(alarmSound, true)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                      title="선택한 소리 3회 재생 테스트"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>소리 테스트</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {ALARM_SOUND_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAlarmSound(opt.id);
                          playMasterAlarm(opt.id, soundEnabled);
                        }}
                        className={`py-2 px-1.5 rounded-lg font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 text-[11px] border ${
                          alarmSound === opt.id
                            ? 'bg-blue-600 text-white border-blue-400 shadow-2xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="font-extrabold truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
