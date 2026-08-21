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
} from 'lucide-react';
import { AlarmSoundType, playAlarm, playBeep, playMasterAlarm } from '../utils/audio';

interface FloatingTimerProps {
  soundEnabled: boolean;
}

const ALARM_STORAGE_KEY = 'hanja_timer_alarm_sound';
const TIMER_SIZE_STORAGE_KEY = 'hanja_timer_size_mode';

const ALARM_SOUND_OPTIONS: { id: AlarmSoundType; label: string; icon: string; desc: string }[] = [
  { id: 'bell', label: '자명종', icon: '⏰', desc: '따르릉~ 따르릉~' },
  { id: 'bomb', label: '폭탄 소리', icon: '💣', desc: '휘익- 쾅!' },
  { id: 'funny', label: '웃긴 소리', icon: '🤪', desc: '끝! 시간 끝났습니다~' },
  { id: 'rooster', label: '닭 소리', icon: '🐓', desc: '꼬~끼~오~!' },
];

export const FloatingTimer: React.FC<FloatingTimerProps> = ({ soundEnabled }) => {
  // Timer State (starts at 0)
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);

  // Selected Alarm Sound
  const [alarmSound, setAlarmSound] = useState<AlarmSoundType>(() => {
    try {
      const saved = localStorage.getItem(ALARM_STORAGE_KEY) as AlarmSoundType;
      if (['bell', 'bomb', 'funny', 'rooster'].includes(saved)) {
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
  const [inputMin, setInputMin] = useState<number>(0);
  const [inputSec, setInputSec] = useState<number>(0);

  // Position & Dragging (fixed coordinate)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const rightPadding = 290;
      return { x: Math.max(16, window.innerWidth - rightPadding), y: 76 };
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

      const newX = Math.max(10, Math.min(window.innerWidth - 200, dragStartRef.current.initPosX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.initPosY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartRef.current.startX;
      const dy = e.touches[0].clientY - dragStartRef.current.startY;

      const newX = Math.max(10, Math.min(window.innerWidth - 200, dragStartRef.current.initPosX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.initPosY + dy));

      setPosition({ x: newX, y: newY });
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
  }, [isDragging]);

  const toggleRun = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (remaining <= 0) {
      setTimerExact(10);
      setIsRunning(true);
      return;
    }
    playBeep(soundEnabled, 540, 0.08);
    setIsRunning((prev) => !prev);
  };

  // Reset strictly to 0 seconds
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
      }}
      className={`select-none transition-all ${
        isAlarmActive
          ? 'animate-bounce ring-4 ring-rose-500 shadow-2xl rounded-2xl'
          : 'shadow-2xl'
      }`}
    >
      {/* 1. MINI COMPACT CHIP MODE */}
      {sizeMode === 'mini' ? (
        <div
          onClick={() => {
            if (!isDragging) {
              setSizeMode('medium');
            }
          }}
          className="bg-slate-900/95 hover:bg-slate-900 backdrop-blur-md border border-slate-700 hover:border-blue-400 text-white rounded-full shadow-2xl px-3.5 py-2 flex items-center gap-2.5 cursor-pointer transition ring-2 ring-blue-500/20 hover:ring-blue-500/50 group"
          title="클릭하면 큰 타이머로 확대됩니다"
        >
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleTouchStart(e);
            }}
            className="flex items-center gap-1 cursor-move text-slate-400 group-hover:text-slate-200"
          >
            <GripHorizontal className="w-3.5 h-3.5" />
            <Clock className="w-4 h-4 text-blue-400" />
          </div>

          <span className="font-mono text-lg font-black text-emerald-400 tracking-wider">
            {formatTime(remaining)}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRun(e);
            }}
            className={`p-1.5 rounded-full text-white font-bold transition cursor-pointer active:scale-90 ${
              isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={isRunning ? '일시정지' : '시작'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleResetToZero(e);
            }}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer active:scale-90"
            title="0초 리셋"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/60 flex items-center gap-0.5">
            <Maximize2 className="w-3 h-3" />
            <span>확대</span>
          </span>
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

            {/* Size & Setting Buttons */}
            <div className="flex items-center gap-1">
              {isAlarmActive && (
                <span className="text-xs font-black text-rose-400 animate-pulse flex items-center gap-0.5 mr-1">
                  <Bell className="w-3.5 h-3.5" />
                  <span>종료!</span>
                </span>
              )}

              {/* Toggle Large vs Medium */}
              <button
                type="button"
                onClick={() => setSizeMode(sizeMode === 'large' ? 'medium' : 'large')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                  sizeMode === 'large'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
                title={sizeMode === 'large' ? '기본 크기로 축소' : '학생들이 잘 보이게 초대형으로 확대'}
              >
                <Tv className="w-3 h-3" />
                <span>{sizeMode === 'large' ? '표준' : '대형'}</span>
              </button>

              {/* Minimize to mini chip */}
              <button
                type="button"
                onClick={() => setSizeMode('mini')}
                className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white cursor-pointer"
                title="작게 접기"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              {/* Settings Toggle */}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                title="설정 및 알람 소리 선택"
              >
                {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
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
                  onClick={() => setTimerExact(180)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold transition text-center cursor-pointer active:scale-95"
                >
                  3분
                </button>
              </div>

              {/* Adjust +/- Seconds */}
              <div className="grid grid-cols-4 gap-1 text-[11px]">
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
                    className="text-slate-400 hover:text-white"
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

            {/* Expandable Settings: Alarm Sounds and 5min/10min */}
            {isSettingsOpen && (
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-300 text-[11px]">
                  <span>종료 알람 소리 선택</span>
                  <button
                    type="button"
                    onClick={() => playMasterAlarm(alarmSound, true)}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>소리 테스트</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {ALARM_SOUND_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAlarmSound(opt.id);
                        playMasterAlarm(opt.id, soundEnabled);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-between cursor-pointer active:scale-95 text-[11px] ${
                        alarmSound === opt.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setTimerExact(300)}
                    className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px]"
                  >
                    5분 타이머
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerExact(600)}
                    className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px]"
                  >
                    10분 타이머
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
