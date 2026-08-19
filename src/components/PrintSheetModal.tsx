import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface PrintQuestionItem {
  id: string;
  mean: string;
  hanja?: string;
}

interface PrintSheetModalProps {
  onClose: () => void;
  title: string;
  subTitle?: string;
  questions: PrintQuestionItem[];
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({
  onClose,
  title,
  subTitle,
  questions,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">
              한자 시험지 인쇄 / PDF 저장
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>지금 인쇄하기</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50 print:bg-white print:p-0 print:overflow-visible">
          <div
            ref={printRef}
            className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none max-w-3xl mx-auto space-y-6 text-slate-900"
          >
            {/* Sheet Title & Student Meta */}
            <div className="text-center border-b-2 border-slate-900 pb-4">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
                {title}
              </h1>
              <div className="flex justify-between items-center text-sm font-medium text-slate-700 pt-2">
                <div>{subTitle}</div>
                <div className="flex items-center gap-4">
                  <div className="border-b border-slate-400 px-3 py-0.5">
                    <span className="font-bold">이름:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  </div>
                  <div className="border-b border-slate-400 px-3 py-0.5">
                    <span className="font-bold">점수:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 100
                  </div>
                </div>
              </div>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-md print:bg-transparent print:p-0 print:text-slate-800">
              ※ 아래 뜻과 음에 알맞은 한자를 바르게 적으세요.
            </p>

            {/* Question Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="border border-slate-300 rounded-lg p-3.5 flex items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-300">
                      {idx + 1}
                    </span>
                    <div className="text-base font-bold text-slate-800">
                      {q.mean}
                    </div>
                  </div>

                  {/* Answer Box */}
                  <div className="w-24 h-14 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-xs text-slate-400">
                    한자 쓰기
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-200">
              한자 학습 보조 관리 시스템 • 바른 글씨로 정성껏 작성하세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
