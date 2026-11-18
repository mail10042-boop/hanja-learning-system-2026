import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  Gauge,
  AlertCircle,
  Youtube,
  Music,
} from 'lucide-react';
import { SongLessonData, SongMediaItem } from '../types';

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

export function formatSecondsMMSS(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve();
    };
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    } else {
      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
    }
  });
  return ytApiPromise;
}

interface SongAudioPlayerProps {
  media?: SongMediaItem | null;
  lesson?: SongLessonData | null;
  startTimeOverride?: number;
  endTimeOverride?: number | null;
  variant?: 'editor' | 'student';
}

export const SongAudioPlayer: React.FC<SongAudioPlayerProps> = ({
  media,
  lesson,
  startTimeOverride,
  endTimeOverride,
  variant = 'editor',
}) => {
  const [speed, setSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(90);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [speedNotice, setSpeedNotice] = useState<string>('');
  const [ytReady, setYtReady] = useState<boolean>(false);
  const [ytError, setYtError] = useState<string>('');
  const [audioError, setAudioError] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  // Derive source either from explicit `media` item or legacy `lesson`
  const resolvedAudioMeta =
    media?.type === 'audio' ? media.audioFile : !media ? lesson?.audioFile : null;
  const resolvedYoutubeUrl =
    media?.type === 'youtube' ? media.youtubeUrl || '' : !media ? lesson?.youtubeUrl || '' : '';

  const hasAudio = Boolean(resolvedAudioMeta?.audioId);
  const youtubeId = extractYouTubeVideoId(resolvedYoutubeUrl);
  const hasYoutube = Boolean(youtubeId);

  const activeSource: 'audio' | 'youtube' | null = media
    ? media.type === 'audio' && hasAudio
      ? 'audio'
      : media.type === 'youtube' && hasYoutube
      ? 'youtube'
      : null
    : lesson?.activeMediaSource === 'audio' && hasAudio
    ? 'audio'
    : lesson?.activeMediaSource === 'youtube' && hasYoutube
    ? 'youtube'
    : hasAudio
    ? 'audio'
    : hasYoutube
    ? 'youtube'
    : null;

  const baseStart = media ? Number(media.startTime) || 0 : Number(lesson?.startTime) || 0;
  const baseEnd = media ? media.endTime : lesson?.endTime;

  const startTime =
    startTimeOverride !== undefined ? Math.max(0, Number(startTimeOverride) || 0) : Math.max(0, baseStart);
  const rawEnd = endTimeOverride !== undefined ? endTimeOverride : baseEnd;
  const endTime =
    rawEnd !== null && rawEnd !== undefined && Number(rawEnd) > startTime ? Number(rawEnd) : null;

  const audioSrc =
    hasAudio && resolvedAudioMeta?.audioId
      ? `/api/song-audio/${encodeURIComponent(resolvedAudioMeta.audioId)}`
      : '';

  const displayTitle =
    media?.title?.trim() ||
    (activeSource === 'youtube'
      ? '유튜브 노래 재생'
      : resolvedAudioMeta?.fileName || '업로드 음원');

  // Reset playback state when source identity changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(startTime);
    setSpeedNotice('');
    setYtError('');
    setAudioError('');
  }, [activeSource, audioSrc, youtubeId, media?.id, startTime]);

  // Apply volume & speed to HTML5 audio without resetting currentTime
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
    el.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume / 100));
  }, [speed, volume, isMuted, activeSource, audioSrc]);

  // Initialize / update YouTube IFrame Player API when activeSource === 'youtube'
  useEffect(() => {
    if (activeSource !== 'youtube' || !youtubeId) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      setYtReady(false);
      return;
    }

    let cancelled = false;
    setYtReady(false);
    setYtError('');

    loadYouTubeIframeAPI().then(() => {
      if (cancelled || !ytContainerRef.current || !window.YT?.Player) return;

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }

      const mountEl = document.createElement('div');
      ytContainerRef.current.innerHTML = '';
      ytContainerRef.current.appendChild(mountEl);

      ytPlayerRef.current = new window.YT.Player(mountEl, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(startTime),
        },
        events: {
          onReady: (ev: any) => {
            if (cancelled) return;
            setYtReady(true);
            try {
              ev.target.setVolume(isMuted ? 0 : volume);
              ev.target.setPlaybackRate(speedRef.current);
              const dur = ev.target.getDuration();
              if (dur) setDuration(dur);
              if (startTime > 0) ev.target.seekTo(startTime, true);
            } catch {}
          },
          onStateChange: (ev: any) => {
            if (cancelled) return;
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;
            if (ev.data === YTState.PLAYING) {
              setIsPlaying(true);
              try {
                const dur = ev.target.getDuration();
                if (dur) setDuration(dur);
                ev.target.setPlaybackRate?.(speedRef.current);
              } catch {}
            } else if (ev.data === YTState.PAUSED || ev.data === YTState.ENDED) {
              setIsPlaying(false);
            }
          },
          onPlaybackRateChange: (ev: any) => {
            if (cancelled) return;
            const actualRate = ev.data;
            if (typeof actualRate === 'number' && Math.abs(actualRate - speedRef.current) > 0.01) {
              setSpeedNotice(
                `이 유튜브 영상에서는 ${speedRef.current}배속이 지원되지 않아 ${actualRate}배속으로 자동 조정되었습니다.`
              );
            }
          },
          onError: () => {
            if (cancelled) return;
            setYtError('유튜브 영상을 불러오지 못했습니다. 주소를 확인하거나 음원 파일을 업로드해 주세요.');
            setIsPlaying(false);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
    };
  }, [activeSource, youtubeId, media?.id]);

  // Poll YouTube time + enforce start/end boundary
  useEffect(() => {
    if (activeSource !== 'youtube' || !ytReady) return;
    const timer = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      try {
        const cur = p.getCurrentTime();
        if (typeof cur === 'number') {
          setCurrentTime(cur);
          if (endTime !== null && cur >= endTime && isPlaying) {
            p.pauseVideo();
            setIsPlaying(false);
          }
        }
      } catch {}
    }, 250);
    return () => clearInterval(timer);
  }, [activeSource, ytReady, endTime, isPlaying]);

  // Update YouTube volume without interrupting playback
  useEffect(() => {
    if (activeSource !== 'youtube' || !ytReady || !ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.setVolume(isMuted ? 0 : volume);
    } catch {}
  }, [volume, isMuted, activeSource, ytReady]);

  const handleTogglePlay = () => {
    if (!activeSource) return;
    if (activeSource === 'audio') {
      const el = audioRef.current;
      if (!el) return;
      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        if (el.currentTime < startTime || (endTime !== null && el.currentTime >= endTime)) {
          el.currentTime = startTime;
        }
        el.playbackRate = speed;
        el.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setAudioError('음원 파일을 재생할 수 없습니다.');
          });
      }
    } else if (activeSource === 'youtube' && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          const cur = ytPlayerRef.current.getCurrentTime?.() || 0;
          if (cur < startTime || (endTime !== null && cur >= endTime)) {
            ytPlayerRef.current.seekTo(startTime, true);
          }
          ytPlayerRef.current.setPlaybackRate?.(speed);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch {}
    }
  };

  const handleStop = () => {
    if (activeSource === 'audio' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      setIsPlaying(false);
    } else if (activeSource === 'youtube' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
        ytPlayerRef.current.seekTo(startTime, true);
        setCurrentTime(startTime);
        setIsPlaying(false);
      } catch {}
    }
  };

  const handleReplay = () => {
    if (activeSource === 'audio' && audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.playbackRate = speed;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setAudioError('음원 파일을 재생할 수 없습니다.');
        });
    } else if (activeSource === 'youtube' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(startTime, true);
        ytPlayerRef.current.setPlaybackRate?.(speed);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch {}
    }
  };

  // Preserves current playback position when changing speed (max 2x)
  const handleSpeedChange = (nextSpeed: number) => {
    const capped = Math.min(2, Math.max(0.5, nextSpeed));
    setSpeed(capped);
    setSpeedNotice('');

    if (activeSource === 'audio' && audioRef.current) {
      audioRef.current.playbackRate = capped;
    } else if (activeSource === 'youtube' && ytPlayerRef.current && ytReady) {
      try {
        const available: number[] | undefined = ytPlayerRef.current.getAvailablePlaybackRates?.();
        if (Array.isArray(available) && available.length > 0 && !available.includes(capped)) {
          setSpeedNotice(
            `이 유튜브 영상은 ${available.map((r) => `${r}배속`).join(', ')}만 지원합니다.`
          );
        }
        ytPlayerRef.current.setPlaybackRate(capped);
      } catch {
        setSpeedNotice('유튜브 플레이어가 해당 배속 변경을 지원하지 않습니다.');
      }
    }
  };

  const handleSeek = (nextTime: number) => {
    setCurrentTime(nextTime);
    if (activeSource === 'audio' && audioRef.current) {
      audioRef.current.currentTime = nextTime;
    } else if (activeSource === 'youtube' && ytPlayerRef.current && ytReady) {
      try {
        ytPlayerRef.current.seekTo(nextTime, true);
      } catch {}
    }
  };

  if (!activeSource) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        이 문제에 연결된 유튜브 영상이나 업로드된 음원 파일이 없습니다.
      </div>
    );
  }

  const maxTimeline = endTime !== null ? endTime : duration > 0 ? duration : 100;
  const minTimeline = startTime;
  const isStudent = variant === 'student';

  return (
    <div
      className={`rounded-2xl border ${
        isStudent
          ? 'bg-slate-900 text-white border-slate-700 p-4 sm:p-5 space-y-4 shadow-md'
          : 'bg-slate-50 text-slate-800 border-slate-200 p-3.5 space-y-3'
      }`}
    >
      {activeSource === 'audio' && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            setDuration(el.duration || 0);
            if (startTime > 0 && el.currentTime < startTime) {
              el.currentTime = startTime;
            }
            el.playbackRate = speed;
            el.volume = isMuted ? 0 : volume / 100;
          }}
          onTimeUpdate={(e) => {
            const cur = e.currentTarget.currentTime;
            setCurrentTime(cur);
            if (endTime !== null && cur >= endTime && !e.currentTarget.paused) {
              e.currentTarget.pause();
              setIsPlaying(false);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setAudioError('업로드된 음원 파일을 불러오지 못했습니다.');
            setIsPlaying(false);
          }}
          className="hidden"
        />
      )}

      {activeSource === 'youtube' ? (
        <div
          className={`w-full overflow-hidden rounded-xl bg-black border ${
            isStudent ? 'border-slate-700 aspect-video' : 'border-slate-300 aspect-video max-h-56'
          }`}
        >
          <div ref={ytContainerRef} className="w-full h-full" />
        </div>
      ) : (
        isStudent && (
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-semibold">업로드 노래 재생</div>
              <div className="text-base font-bold text-white truncate">{displayTitle}</div>
            </div>
          </div>
        )
      )}

      {/* Title & Time info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold min-w-0">
          {activeSource === 'youtube' ? (
            <Youtube className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <Music className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span className="truncate">{displayTitle}</span>
          {(startTime > 0 || endTime !== null) && (
            <span className={isStudent ? 'text-slate-400 font-normal shrink-0' : 'text-slate-500 font-normal shrink-0'}>
              ({formatSecondsMMSS(startTime)} ~ {endTime !== null ? formatSecondsMMSS(endTime) : '끝'})
            </span>
          )}
        </div>
        <div className="font-mono tabular-nums font-bold shrink-0">
          {formatSecondsMMSS(currentTime)} / {formatSecondsMMSS(duration || maxTimeline)}
        </div>
      </div>

      {/* Seekable Timeline */}
      <input
        type="range"
        min={minTimeline}
        max={Math.max(minTimeline + 1, maxTimeline)}
        step={0.5}
        value={Math.min(Math.max(currentTime, minTimeline), Math.max(minTimeline + 1, maxTimeline))}
        onChange={(e) => handleSeek(Number(e.target.value))}
        aria-label="재생 위치 조절"
        className={`w-full h-1.5 rounded-lg cursor-pointer ${
          isStudent ? 'accent-emerald-400 bg-slate-700' : 'accent-slate-800 bg-slate-200'
        }`}
      />

      {/* Transport & Volume */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer active:scale-95 whitespace-nowrap ${
              isStudent
                ? isPlaying
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-sm'
                : isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-white text-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-white text-xs'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? '일시정지' : '재생'}</span>
          </button>

          <button
            type="button"
            onClick={handleReplay}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              isStudent
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs sm:text-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs'
            }`}
            title="구간 처음부터 다시 듣기"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>다시 듣기</span>
          </button>

          <button
            type="button"
            onClick={handleStop}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              isStudent
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs sm:text-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs'
            }`}
            title="정지 및 처음 위치로"
          >
            <Square className="w-3.5 h-3.5" />
            <span>정지</span>
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isStudent ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
            }`}
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (v > 0 && isMuted) setIsMuted(false);
            }}
            aria-label="음량 조절"
            className={`w-20 sm:w-24 h-1.5 rounded-lg cursor-pointer ${
              isStudent ? 'accent-emerald-400 bg-slate-700' : 'accent-slate-800 bg-slate-200'
            }`}
          />
          <span className="text-[11px] font-mono tabular-nums w-8 text-right">
            {isMuted ? 0 : volume}%
          </span>
        </div>
      </div>

      {/* Playback Speed Selector (0.5x ~ 2x, max 2x) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-700/30">
        <span
          className={`text-xs font-bold flex items-center gap-1 mr-1 ${
            isStudent ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>재생 속도</span>
        </span>
        {PLAYBACK_SPEEDS.map((spd) => {
          const active = speed === spd;
          return (
            <button
              key={spd}
              type="button"
              onClick={() => handleSpeedChange(spd)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer whitespace-nowrap ${
                active
                  ? isStudent
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'bg-slate-800 text-white shadow-xs'
                  : isStudent
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {spd}배속
            </button>
          );
        })}
      </div>

      {(speedNotice || ytError || audioError) && (
        <div
          className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${
            isStudent
              ? 'bg-amber-950/70 text-amber-200 border border-amber-700/60'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{ytError || audioError || speedNotice}</span>
        </div>
      )}
    </div>
  );
};
