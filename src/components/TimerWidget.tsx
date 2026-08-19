import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Bell, Plus, Minus, Volume2, VolumeX } from 'lucide-react';
import { playTimerAlarm } from '../utils/audio';

interface TimerWidgetProps {
  idPrefix: string;
  defaultSeconds: number;
  alarmCount?: number;
  soundEnabled: boolean;
  onToggleSound?: () => void;
  title?: string;
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  idPrefix,
  defaultSeconds,
  alarmCount = 3,
  soundEnabled,
  onToggleSound,
  title = '수업 타이머',
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(defaultSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAlarming, setIsAlarming] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<number>(Math.floor(defaultSeconds / 60));
  const timerRef = useRef<number | null>(null);

  // Sync if defaultSeconds change significantly and not running
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft(defaultSeconds);
      setCustomMinutes(Math.floor(defaultSeconds / 60));
    }
  }, [defaultSeconds]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            setIsAlarming(true);
            playTimerAlarm(alarmCount, soundEnabled);
            setTimeout(() => setIsAlarming(false), alarmCount * 1000 + 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, alarmCount, soundEnabled]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStart = () => {
    if (secondsLeft === 0) {
      setSecondsLeft(defaultSeconds);
    }
    setIsRunning(true);
    setIsAlarming(false);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = (newSecs?: number) => {
    setIsRunning(false);
    setIsAlarming(false);
    setSecondsLeft(newSecs !== undefined ? newSecs : defaultSeconds);
  };

  const adjustSeconds = (delta: number) => {
    setSecondsLeft((prev) => Math.max(0, prev + delta));
  };

  return (
    <div
      id={`${idPrefix}-container`}
      className={`rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-md ${
        isAlarming
          ? 'bg-rose-950 text-rose-100 ring-4 ring-rose-500 animate-pulse'
          : 'bg-slate-900 text-amber-300 border border-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 text-amber-400">
            <Bell className={`w-4 h-4 ${isRunning ? 'animate-bounce' : ''}`} />
          </span>
          <span className="text-sm font-semibold tracking-wide text-slate-300">{title}</span>
          {isAlarming && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">
              시간 종료!
            </span>
          )}
        </div>

        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? '알림음 켜짐' : '알림음 음소거'}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-300 px-2 py-1 rounded bg-slate-800 transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
            <span>{soundEnabled ? '알림 켜짐' : '음소거'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center my-2">
        <div
          id={`${idPrefix}-display`}
          className="font-mono text-5xl sm:text-6xl font-black tracking-wider text-amber-300 drop-shadow-[0_2px_10px_rgba(252,211,77,0.3)] select-none"
        >
          {formatTime(secondsLeft)}
        </div>

        {/* Quick adjustments */}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => adjustSeconds(-30)}
            disabled={secondsLeft <= 0}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center transition disabled:opacity-30"
          >
            <Minus className="w-3 h-3 mr-0.5" /> 30초
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(30)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center transition"
          >
            <Plus className="w-3 h-3 mr-0.5" /> 30초
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center transition"
          >
            <Plus className="w-3 h-3 mr-0.5" /> 1분
          </button>
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-800">
        {!isRunning ? (
          <button
            type="button"
            id={`${idPrefix}-btn-start`}
            onClick={handleStart}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>시작</span>
          </button>
        ) : (
          <button
            type="button"
            id={`${idPrefix}-btn-pause`}
            onClick={handlePause}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Pause className="w-4 h-4 fill-white" />
            <span>일시 정지</span>
          </button>
        )}

        <button
          type="button"
          id={`${idPrefix}-btn-reset`}
          onClick={() => handleReset()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>초기화</span>
        </button>

        {/* Quick preset buttons */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
          {[
            { label: '10분', sec: 600 },
            { label: '5분', sec: 300 },
            { label: '3분', sec: 180 },
            { label: '1분', sec: 60 },
            { label: '30초', sec: 30 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleReset(preset.sec)}
              className="px-2 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
