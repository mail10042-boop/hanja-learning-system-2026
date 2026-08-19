import React from 'react';
import {
  BookOpen,
  HelpCircle,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  fontSize: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  onResetFont: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isAdminAuthenticated: boolean;
  showFloatingTimer: boolean;
  onToggleFloatingTimer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  fontSize,
  onIncreaseFont,
  onDecreaseFont,
  onResetFont,
  soundEnabled,
  onToggleSound,
  isAdminAuthenticated,
  showFloatingTimer,
  onToggleFloatingTimer,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo / Title */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-xl">
              漢
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                한자 학습 보조 관리 시스템
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                초·중등 한자 급수별 수업 진행 및 실시간 문제 출제
              </p>
            </div>
          </div>

          {/* Mobile Sound & Timer quick controls */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              type="button"
              onClick={onToggleFloatingTimer}
              className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 ${
                showFloatingTimer ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 text-slate-600'
              }`}
              title="이동식 시계 켜기/끄기"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="소리 설정"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-sm font-medium w-full md:w-auto justify-center">
          <button
            type="button"
            id="nav-btn-lesson"
            onClick={() => setActiveTab('lesson')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'lesson'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>수업 화면</span>
          </button>

          <button
            type="button"
            id="nav-btn-quiz"
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>실시간 문제 출제</span>
          </button>

          <button
            type="button"
            id="nav-btn-admin"
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${isAdminAuthenticated ? 'text-emerald-400' : ''}`} />
            <span>관리자 모드</span>
            {isAdminAuthenticated && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="로그인 됨" />
            )}
          </button>
        </nav>

        {/* Global Controls: Timer Toggle, Font Scaling & Audio */}
        <div className="hidden md:flex items-center gap-2">
          {/* Floating Timer Toggle */}
          <button
            type="button"
            onClick={onToggleFloatingTimer}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              showFloatingTimer
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="이동식 시계 켜기/끄기"
          >
            <Clock className="w-4 h-4" />
            <span>이동식 시계 {showFloatingTimer ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold px-1.5">글자 크기</span>
            <button
              type="button"
              id="btn-font-plus"
              onClick={onIncreaseFont}
              className="p-1.5 rounded-lg bg-white shadow-2xs hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold transition flex items-center gap-0.5"
              title="글자 크기 키우기 (A+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>A+</span>
            </button>
            <button
              type="button"
              id="btn-font-minus"
              onClick={onDecreaseFont}
              className="p-1.5 rounded-lg bg-white shadow-2xs hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold transition flex items-center gap-0.5"
              title="글자 크기 줄이기 (A-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>A-</span>
            </button>
            <button
              type="button"
              onClick={onResetFont}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition"
              title="기본 크기로 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition ${
              soundEnabled
                ? 'border-blue-200 bg-blue-50 text-blue-700 font-medium'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
            title={soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span className="hidden lg:inline">{soundEnabled ? '소리 ON' : '소리 OFF'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
