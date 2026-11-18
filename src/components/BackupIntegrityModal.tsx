import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  FileArchive,
  ShieldAlert,
  Download,
  Music,
  BookOpen,
  FileText,
  Youtube,
  Hash,
  Layers,
} from 'lucide-react';
import {
  BackupExportReport,
  BackupPreview,
  RestoreIntegrityReport,
} from '../utils/backupZip';

interface RestoreConfirmModalProps {
  preview: BackupPreview;
  isRestoring: boolean;
  onCancel: () => void;
  onBackupCurrentFirst: () => void;
  onConfirmRestore: () => void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  preview,
  isRestoring,
  onCancel,
  onBackupCurrentFirst,
  onConfirmRestore,
}) => {
  const { stats, fileName, fileType, audioEntries, warnings } = preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                백업 복구 전 확인 ({fileType === 'zip' ? '전체 ZIP 백업' : 'JSON 백업'})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 break-all">
                선택한 파일: <span className="font-semibold text-slate-700">{fileName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRestoring}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          복구를 진행하면 현재 화면과 서버에 저장된 기존 한자 진도·문제은행·노래·한자별 가사·1~10번 출제 설정이 선택한 백업 파일의 내용으로 교체됩니다.
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <div className="text-slate-500 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span>급수 / 문제은행</span>
            </div>
            <div className="font-bold text-slate-900 text-sm mt-1 tabular-nums">
              {stats.levelCount}급수 · {stats.bankRangeCount}과
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <div className="text-slate-500 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>한자별 가사</span>
            </div>
            <div className="font-bold text-slate-900 text-sm mt-1 tabular-nums">
              {stats.hanjaLyricRowCount}개 ({stats.lyricsCount}과)
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <div className="text-slate-500 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-indigo-600" />
              <span>1~10번 출제/영상</span>
            </div>
            <div className="font-bold text-slate-900 text-sm mt-1 tabular-nums">
              문제 {stats.configuredSlotCount} · 영상 {stats.youtubeCount}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <div className="text-slate-500 flex items-center gap-1">
              <Music className="w-3.5 h-3.5 text-emerald-600" />
              <span>포함 음원 파일</span>
            </div>
            <div className="font-bold text-slate-900 text-sm mt-1 tabular-nums">
              {audioEntries.length}개 (등록 {stats.audioCount}개)
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1 text-xs text-rose-800">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>주의 사항 확인</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onBackupCurrentFirst}
            disabled={isRestoring}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>현재 데이터 먼저 ZIP 백업</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isRestoring}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirmRestore}
              disabled={isRestoring}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isRestoring ? '음원 및 데이터 복구 중...' : '확인 및 전체 복구 실행'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface IntegrityReportModalProps {
  mode: 'export' | 'restore';
  exportReport?: BackupExportReport | null;
  restoreReport?: RestoreIntegrityReport | null;
  onClose: () => void;
}

export const IntegrityReportModal: React.FC<IntegrityReportModalProps> = ({
  mode,
  exportReport,
  restoreReport,
  onClose,
}) => {
  const report = mode === 'export' ? exportReport : restoreReport;
  if (!report) return null;

  const hasIssues =
    mode === 'export'
      ? (exportReport?.missingAudioFiles.length || 0) > 0
      : !restoreReport?.success || (restoreReport?.warnings.length || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {mode === 'export' ? (
                <FileArchive className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'export' ? '전체 ZIP 백업 및 무결성 확인 완료' : '전체 복구 및 데이터 무결성 검증 결과'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'export'
                  ? `${exportReport?.fileName} (${((exportReport?.totalSizeBytes || 0) / 1024).toFixed(1)} KB)`
                  : '기존 한자 학습 데이터와 노래·가사·문제 설정·음원 파일이 복구되었습니다.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Integrity Checklist */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-slate-600 flex items-center gap-2 font-medium">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>기존 급수 / 문제은행 범위</span>
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              {report.levelCount}개 급수 · {report.bankRangeCount}개 과
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-slate-600 flex items-center gap-2 font-medium">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>한자별 노래 가사</span>
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              {report.hanjaLyricRowCount}개 ({report.lyricsCount}개 과)
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-slate-600 flex items-center gap-2 font-medium">
              <Hash className="w-4 h-4 text-indigo-600" />
              <span>1~10번 문제 설정 (글자 크기 포함)</span>
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              {report.configuredSlotCount}개 지정됨 (한자 연결 {report.linkedHanjaCount}건)
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-slate-600 flex items-center gap-2 font-medium">
              <Youtube className="w-4 h-4 text-rose-600" />
              <span>등록된 유튜브 노래</span>
            </span>
            <span className="font-bold text-slate-900 tabular-nums">
              {report.youtubeCount}개
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-slate-600 flex items-center gap-2 font-medium">
              <Music className="w-4 h-4 text-emerald-600" />
              <span>업로드 음악 파일 원본 {mode === 'export' ? '포함' : '복구/재생 검증'}</span>
            </span>
            {mode === 'export' ? (
              <span className="font-bold text-emerald-700 tabular-nums">
                {exportReport?.audioBackedUpCount} / {report.audioCount}개 ZIP 포함 완료
              </span>
            ) : (
              <span
                className={`font-bold tabular-nums ${
                  restoreReport && restoreReport.failedAudioFiles.length > 0
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                {restoreReport?.audioVerifiedCount} / {report.audioCount}개 정상 검증
              </span>
            )}
          </div>
        </div>

        {mode === 'export' && exportReport && exportReport.missingAudioFiles.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <div className="font-bold">일부 음원 파일을 서버에서 찾을 수 없었습니다:</div>
            <ul className="list-disc pl-5">
              {exportReport.missingAudioFiles.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'restore' && restoreReport && (restoreReport.failedAudioFiles.length > 0 || restoreReport.warnings.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <div className="font-bold">복구 안내 및 누락 확인:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {restoreReport.failedAudioFiles.map((f, idx) => (
                <li key={`fail-${idx}`} className="text-rose-700 font-semibold">
                  음원 복구 실패/누락: {f}
                </li>
              ))}
              {restoreReport.warnings.map((w, idx) => (
                <li key={`warn-${idx}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
