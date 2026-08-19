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
  X,
} from 'lucide-react';
import { AlarmSoundType, playAlarm, playBeep, playMasterAlarm } from '../utils/audio';

interface FloatingTimerProps {
  soundEnabled: boolean;
}

const ALARM_STORAGE_KEY = 'hanja_timer_alarm_sound';

const ALARM_SOUND_OPTIONS: { id: AlarmSoundType; label: string; icon: string; desc: string }[] = [
  { id: 'bell', label: '자명종 소리', icon: '⏰', desc: '따르릉~ 따르릉~' },
  { id: 'bomb', label: '폭탄 소리', icon: '💣', desc: '휘익- 쾅! 쾅!' },
  { id: 'funny', label: '끝! (웃긴 소리)', icon: '🤪', desc: '끝! 시간 끝났습니다~' },
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

  // Save selected sound
  useEffect(() => {
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, alarmSound);
    } catch {}
  }, [alarmSound]);

  // Widget UI State: DEFAULT TO 'mini' (항상 기본적으로 작게 되어 있고, 누르면 펼쳐짐)
  const [sizeMode, setSizeMode] = useState<'mini' | 'normal'>('mini');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDirectInputOpen, setIsDirectInputOpen] = useState<boolean>(false);
  const [inputMin, setInputMin] = useState<number>(0);
  const [inputSec, setInputSec] = useState<number>(0);

  // Position & Dragging (fixed coordinate)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return { x: Math.max(16, window.innerWidth - 240), y: 76 };
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
            playAlarm(soundEnabled, 3, alarmSound); // Play the selected sound!
            setTimeout(() => setIsAlarmActive(false), 4200);
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

      const newX = Math.max(10, Math.min(window.innerWidth - 180, dragStartRef.current.initPosX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.initPosY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartRef.current.startX;
      const dy = e.touches[0].clientY - dragStartRef.current.startY;

      const newX = Math.max(10, Math.min(window.innerWidth - 180, dragStartRef.current.initPosX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.initPosY + dy));

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
    playBeep(soundEnabled, 520, 0.08);
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
    playBeep(soundEnabled, 480, 0.06);
    setIsRunning(false);
    setTotalSeconds(sec);
    setRemaining(sec);
    setInputMin(Math.floor(sec / 60));
    setInputSec(sec % 60);
  };

  const adjustSec = (delta: number) => {
    playBeep(soundEnabled, 440, 0.05);
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
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }}
      className={`select-none transition-all ${
        isAlarmActive
          ? 'animate-bounce ring-4 ring-rose-500 shadow-2xl rounded-full'
          : 'shadow-xl'
      }`}
    >
      {/* 1. ULTRA-COMPACT MINI MODE (기본 모드: 작게 표시, 누르면 전체 타이머로 확장) */}
      {sizeMode === 'mini' ? (
        <div
          onClick={() => {
            if (!isDragging) {
              setSizeMode('normal');
            }
          }}
          className="bg-slate-900/95 hover:bg-slate-900 backdrop-blur-md border border-slate-700 hover:border-blue-400 text-white rounded-full shadow-2xl px-3 py-1.5 flex items-center gap-2 cursor-pointer transition ring-2 ring-blue-500/20 hover:ring-blue-500/50 active:scale-98 group"
          title="클릭하면 큰 타이머 설정창이 나타납니다"
        >
          {/* Drag Grip Handle */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleTouchStart(e);
            }}
            className="flex items-center gap-1 cursor-move text-slate-400 group-hover:text-slate-200 py-0.5"
            title="마우스로 잡고 이동"
          >
            <GripHorizontal className="w-3.5 h-3.5" />
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>

          {/* Digital Time Counter */}
          <span className="font-mono text-sm sm:text-base font-black text-emerald-400 tracking-wider">
            {formatTime(remaining)}
          </span>

          {/* Alarm Icon */}
          <span className="text-xs" title={`알람 소리: ${currentOption.label}`}>
            {currentOption.icon}
          </span>

          {/* Quick Play/Pause Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRun(e);
            }}
            className={`p-1 rounded-full text-white font-bold transition cursor-pointer active:scale-90 ${
              isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={isRunning ? '일시정지' : '시작'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Reset Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleResetToZero(e);
            }}
            className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer active:scale-90"
            title="0초로 리셋"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Expand Prompt Badge */}
          <span className="text-[11px] font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/60 flex items-center gap-0.5 group-hover:bg-blue-900 transition">
            <Maximize2 className="w-2.5 h-2.5" />
            <span>설정</span>
          </span>
        </div>
      ) : (
        /* 2. FULL EXPANDED TIMER (누르면 나타나는 전체 타이머 창) */
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden w-64 sm:w-70 animate-in fade-in zoom-in-95 duration-150">
          {/* Draggable Header with Close/Minimize to Mini button */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="px-3 py-2 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between cursor-move hover:bg-slate-800 transition"
            title="마우스로 잡고 원하는 위치로 이동하세요"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <GripHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs">수업 타이머</span>
            </div>

            <div className="flex items-center gap-1">
              {isAlarmActive && (
                <span className="text-[10px] font-black text-rose-400 animate-pulse flex items-center gap-0.5 mr-1">
                  <Bell className="w-3 h-3" />
                  <span>종료!</span>
                </span>
              )}

              {/* Minimize to Mini Pill button */}
              <button
                type="button"
                onClick={() => setSizeMode('mini')}
                className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="기본 작은 모양으로 접기"
              >
                <Minimize2 className="w-3 h-3 text-blue-400" />
                <span>작게 접기</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                title={isExpanded ? '간단히 접기' : '더 많은 빠른시간 펼치기'}
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Main Display & Core Controls */}
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-1.5">
              {/* Big Digital Display */}
              <div
                onClick={() => setIsDirectInputOpen(!isDirectInputOpen)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-2xl font-black text-emerald-400 tracking-wider flex-1 text-center cursor-pointer hover:border-blue-400 transition shadow-inner"
                title="클릭하여 직접 분/초 설정"
              >
                {formatTime(remaining)}
              </div>

              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={toggleRun}
                className={`p-2.5 rounded-xl font-bold flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-xs ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                title={isRunning ? '일시정지' : '타이머 시작'}
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              {/* Reset to 0 Seconds Button */}
              <button
                type="button"
                onClick={handleResetToZero}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white transition cursor-pointer active:scale-95 shrink-0 flex items-center gap-0.5"
                title="0초로 리셋"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">0초</span>
              </button>
            </div>

            {/* Quick Step Buttons */}
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => adjustSec(-5)}
                className="py-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-900/80 text-slate-300 font-bold transition text-center cursor-pointer active:scale-95"
              >
                -5초
              </button>
              <button
                type="button"
                onClick={() => adjustSec(+5)}
                className="py-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-900/80 text-slate-300 font-bold transition text-center cursor-pointer active:scale-95"
              >
                +5초
              </button>
              <button
                type="button"
                onClick={() => adjustSec(+10)}
                className="py-1.5 rounded-lg bg-slate-800/90 hover:bg-blue-900/80 text-slate-300 font-bold transition text-center cursor-pointer active:scale-95"
              >
                +10초
              </button>
              <button
                type="button"
                onClick={() => adjustSec(+30)}
                className="py-1.5 rounded-lg bg-slate-800/90 hover:bg-blue-900/80 text-slate-300 font-bold transition text-center cursor-pointer active:scale-95"
              >
                +30초
              </button>
            </div>

            {/* 4 Alarm Sound Selector Bar */}
            <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1">
                  <span>종료 알람:</span>
                  <span className="text-amber-400 font-black">{currentOption.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => playMasterAlarm(alarmSound, true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer bg-slate-800 px-1.5 py-0.5 rounded transition"
                  title="현재 선택된 알람 소리 미리듣기"
                >
                  <Volume2 className="w-2.5 h-2.5" />
                  <span>시험</span>
                </button>
              </div>

              {/* 4 Sound Buttons Grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {ALARM_SOUND_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAlarmSound(opt.id);
                      playMasterAlarm(opt.id, soundEnabled);
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-between cursor-pointer active:scale-95 ${
                      alarmSound === opt.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                    }`}
                    title={`${opt.label} (${opt.desc})`}
                  >
                    <span className="flex items-center gap-1">
                      <span>{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Input Drawer */}
            {isDirectInputOpen && (
              <div className="bg-slate-950 p-2 rounded-xl border border-blue-500/50 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[10px]">
                  <span>시간 직접 입력:</span>
                  <button
                    type="button"
                    onClick={() => setIsDirectInputOpen(false)}
                    className="text-slate-500 hover:text-slate-300 text-[10px]"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputMin}
                    onChange={(e) => setInputMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-10 text-center py-0.5 bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono font-bold text-xs"
                  />
                  <span className="text-slate-400 font-bold text-[10px]">분</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={inputSec}
                    onChange={(e) => setInputSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-10 text-center py-0.5 bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono font-bold text-xs"
                  />
                  <span className="text-slate-400 font-bold text-[10px]">초</span>
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className="ml-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px]"
                  >
                    적용
                  </button>
                </div>
              </div>
            )}

            {/* Expanded Presets */}
            {isExpanded && (
              <div className="pt-1.5 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: '10초', sec: 10 },
                    { label: '30초', sec: 30 },
                    { label: '1분', sec: 60 },
                    { label: '3분', sec: 180 },
                    { label: '5분', sec: 300 },
                    { label: '10분', sec: 600 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setTimerExact(p.sec)}
                      className="py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 font-bold text-[10px] transition text-center cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Minimize to Small Action Bar */}
            <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => setSizeMode('mini')}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
              >
                <Minimize2 className="w-3 h-3 text-blue-400" />
                <span>항상 작게 표시하기 (접기)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDirectInputOpen(!isDirectInputOpen)}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                {isDirectInputOpen ? '직접입력 닫기' : '원하는 시간 직접입력'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
