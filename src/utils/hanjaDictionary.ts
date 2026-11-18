import { AppState } from '../types';
import { getOrderedBankRanges } from './sorter';

// Standard Hanja Hun-eum -> Hanja Character mapping covering 8급 ~ 2급 curriculum
export const HUNEUM_TO_HANJA: Record<string, string> = {
  // 8급
  '한 일': '一',
  '두 이': '二',
  '석 삼': '三',
  '넉 사': '四',
  '다섯 오': '五',
  '여섯 육': '六',
  '일곱 칠': '七',
  '여덟 팔': '八',
  '아홉 구': '九',
  '열 십': '十',
  '날 일': '日',
  '달 월': '月',
  '불 화': '火',
  '물 수': '水',
  '나무 목': '木',
  '쇠 금': '金',
  '흙 토': '土',
  '뫼 산': '山',
  '내 천': '川',
  '사람 인': '人',
  '큰 대': '大',
  '작을 소': '小',
  '아버지 부': '父',
  '어머니 모': '母',
  '맏 형': '兄',
  '아우 제': '弟',
  '아들 자': '子',
  '계집 녀': '女',
  '사내 남': '男',
  '문 문': '門',
  '가운데 중': '中',
  '동녘 동': '東',
  '서녘 서': '西',
  '남녘 남': '南',
  '북녘 북': '北',
  '백성 민': '民',
  '나라 국': '國',
  '임금 왕': '王',
  '한국 한': '韓',
  '배울 학': '學',
  '학교 교': '校',
  '먼저 선': '先',
  '날 생': '生',
  '글월 문': '文',
  '글자 자': '字',
  '만년 년': '年',
  '해 년': '年',
  '푸를 청': '靑',
  '흰 백': '白',
  '만 일': '萬',
  '일만 만': '萬',
  '마디 촌': '寸',
  '만약 약': '若',

  // 7급
  '강 강': '江',
  '입 구': '口',
  '안 내': '內',
  '눈 목': '目',
  '위 상': '上',
  '손 수': '手',
  '바깥 외': '外',
  '오른 우': '右',
  '들 입': '入',
  '발 족': '足',
  '왼 좌': '左',
  '날 출': '出',
  '아래 하': '下',
  '장인 공': '工',
  '힘 력': '力',
  '세력 세': '勢',
  '아닐 불': '不',
  '집 가': '家',
  '노래 가': '歌',
  '사이 간': '間',
  '장수 장': '將',
  '긴 장': '長',
  '길 장': '長',
  '어른 장': '長',
  '봄 춘': '春',
  '가을 추': '秋',
  '여름 하': '夏',
  '겨울 동': '冬',
  '풀 초': '草',
  '꽃 화': '花',
  '비 우': '雨',
  '바람 풍': '風',
  '구름 운': '雲',
  '소리 성': '聲',
  '소리 음': '音',
  '글 서': '書',
  '그림 화': '畫',
  '기쁠 희': '喜',
  '즐길 락': '樂',
  '모일 회': '會',
  '동녘 동녁': '東',

  // 준6급 & 6급
  '들 야': '野',
  '언덕 구': '丘',
  '돌 석': '石',
  '바다 해': '海',
  '수풀 림': '林',
  '나무 수': '樹',
  '새 조': '鳥',
  '물고기 어': '魚',
  '벌레 충': '蟲',
  '말 마': '馬',
  '소 우': '牛',
  '개 견': '犬',
  '양 양': '羊',
  '가르칠 교': '敎',
  '기를 육': '育',
  '몸 기': '己',
  '이름 명': '名',
  '일백 백': '百',
  '성씨 성': '姓',
  '마음 심': '心',
  '구슬 옥': '玉',
  '귀 이': '耳',
  '땅 지': '地',
  '일천 천': '千',
  '하늘 천': '天',
  '고기 육': '肉',
  '쌀 미': '米',
  '밭 전': '田',
  '마을 리': '里',
  '마을 촌': '村',
  '아침 조': '朝',
  '저녁 석': '夕',
  '낮 주': '晝',
  '밤 야': '夜',
  '어두울 암': '暗',
  '밝을 명': '明',
  '빛 광': '光',
  '색 색': '色',
  '빛 색': '色',

  // 준5급
  '수레 차': '車',
  '수건 건': '巾',
  '옛 고': '古',
  '이제 금': '今',
  '한가지 동': '同',
  '설 립': '立',
  '끝 말': '末',
  '모 방': '方',
  '근본 본': '本',
  '지아비 부': '夫',
  '선비 사': '士',
  '세상 세': '世',
  '적을 소': '少',
  '먹을 식': '食',
  '가운데 앙': '央',
  '자리 위': '位',
  '옷 의': '衣',
  '스스로 자': '自',
  '바를 정': '正',
  '주인 주': '主',
  '향할 향': '向',
  '쉴 휴': '休',

  // 5급
  '각각 각': '各',
  '강할 강': '强',
  '열 개': '開',
  '갈 거': '去',
  '볼 견': '見',
  '서울 경': '京',
  '셀 계': '計',
  '높을 고': '高',
  '공 공': '公',
  '빌 공': '空',
  '함께 공': '共',
  '과목 과': '科',
  '사귈 교': '交',
  '나눌 구': '區',
  '군사 군': '軍',
  '가까울 근': '近',
  '급할 급': '急',
  '기 기': '氣',
  '기록할 기': '記',
  '많을 다': '多',
  '짧을 단': '短',
  '대답 답': '答',
  '마땅할 당': '當',
  '대신할 대': '代',
  '대할 대': '對',
  '칼 도': '刀',
  '길 도': '道',
  '읽을 독': '讀',
  '마을 동': '洞',
  '머리 두': '頭',
  '오를 등': '登',
  '무리 등': '等',
  '올 래': '來',
  '늙을 로': '老',
  '이로울 리': '利',
  '다스릴 리': '理',
  '매양 매': '每',
  '낯 면': '面',
  '목숨 명': '命',
  '털 모': '毛',
  '없을 무': '無',
  '물을 문': '問',
  '들을 문': '聞',
  '물건 물': '物',
  '절반 반': '半',
  '나눌 반': '班',
  '놓을 방': '放',
  '차례 번': '番',
  '다를 별': '別',
  '걸음 보': '步',
  '거느릴 부': '部',
  '나눌 분': '分',
  '일 사': '事',
  '죽을 사': '死',
  '모일 사': '社',
  '줄 선': '線',
  '성품 성': '性',
  '이룰 성': '成',
  '바 소': '所',
  '머리 수': '首',
  '저자 시': '市',
  '때 시': '時',
  '보일 시': '示',
  '글 시': '詩',
  '심을 식': '植',
  '믿을 신': '信',
  '새로울 신': '新',
  '귀신 신': '神',
  '몸 신': '身',
  '집 실': '室',
  '편안할 안': '安',
  '약할 약': '弱',
  '말씀 어': '語',
  '말씀 언': '言',
  '길 영': '永',
  '꽃부리 영': '英',
  '낮 오': '午',
  '쓸 용': '用',
  '벗 우': '友',
  '으뜸 원': '元',
  '근본 원': '原',
  '멀 원': '遠',
  '있을 유': '有',
  '은 은': '銀',
  '고을 읍': '邑',
  '뜻 의': '意',
  '지을 작': '作',
  '마당 장': '場',
  '재주 재': '才',
  '온전할 전': '全',
  '앞 전': '前',
  '번개 전': '電',
  '할아비 조': '祖',
  '살 주': '住',
  '대 죽': '竹',
  '무거울 중': '重',
  '곧을 직': '直',
  '곁 측': '側',
  '둘 치': '置',
  '친할 친': '親',
  '다를 타': '他',
  '높을 탁': '卓',
  '숯 탄': '炭',
  '날 탄': '誕',
  '찾을 탐': '探',
  '탑 탑': '塔',
  '모양 태': '態',
  '특별할 특': '特',
  '판목 판': '板',
  '패할 패': '敗',
  '편할 편': '便',
  '평평할 평': '平',
  '베 포': '布',
  '풍년 풍': '豐',
  '찰 한': '寒',
  '해할 해': '害',
  '허락할 허': '許',
  '나타날 현': '現',
  '호수 호': '湖',
  '보호할 호': '護',
  '될 화': '化',
  '기쁠 환': '歡',
  '근심 환': '患',
  '살 활': '活',
  '누를 황': '黃',
  '가로 횡': '橫',
  '효도 효': '孝',
  '뒤 후': '後',
  '가르칠 훈': '訓',
  '흉할 흉': '凶',
  '검을 흑': '黑',
  '일 흥': '興',

  // 준4급 & 4급 & 준3급 & 3급 & 2급 주요 한자
  '더할 가': '加',
  '옳을 가': '可',
  '뿔 각': '角',
  '느낄 감': '感',
  '손님 객': '客',
  '격식 격': '格',
  '결단할 결': '決',
  '맺을 결': '結',
  '공경할 경': '敬',
  '가벼울 경': '輕',
  '지경 계': '界',
  '알릴 고': '告',
  '생각할 고': '考',
  '괴로울 고': '苦',
  '굽을 곡': '曲',
  '공평할 공': '공',
  '열매 과': '果',
  '지날 과': '過',
  '공 구': '球',
  '고을 군': '郡',
  '귀할 귀': '貴',
  '뿌리 근': '根',
  '등급 급': '級',
  '길할 길': '吉',
  '능할 능': '能',
  '집 당': '堂',
  '기다릴 대': '待',
  '덕 덕': '德',
  '그림 도': '圖',
  '법도 도': '度',
  '움직일 동': '動',
  '아이 동': '童',
  '떨어질 락': '落',
  '어질 량': '良',
  '지낼 력': '歷',
  '법식 례': '例',
  '예도 례': '禮',
  '일할 로': '勞',
  '길 로': '路',
  '푸를 록': '綠',
  '흐를 류': '流',
  '오얏 리': '李',
  '망할 망': '亡',
  '살 매': '買',
  '팔 매': '賣',
  '아름다울 미': '美',
  '법 법': '法',
  '복 복': '福',
  '역사 사': '史',
  '생각 사': '思',
  '셈 산': '算',
  '서로 상': '相',
  '눈 설': '雪',
  '손자 손': '孫',
  '익힐 습': '習',
  '사랑 애': '愛',
  '큰바다 양': '洋',
  '따뜻할 온': '溫',
  '도읍 도': '都',
  '법 률': '律',
  '명령할 령': '令',
  '조사할 사': '査',
  '스승 사': '師',
  '가릴 선': '選',
  '말씀 설': '說',
  '정성 성': '誠',
  '알 식': '識',
  '시험 시': '試',
  '옳을 시': '是',
  '거리 가': '街',
  '벼슬 관': '官',
  '권세 권': '權',
  '궁구할 구': '究',
  '기록할 록': '錄',
  '논할 론': '論',
  '경계할 경': '警',
  '깨끗할 결': '潔',
  '생각 상': '想',
  '통달할 달': '達',
  '닦을 수': '修',
  '밝을 혜': '慧',
  '전할 전': '傳',
  '드릴 헌': '獻',
  '엮을 편': '編',
  '책 책': '冊',
  '실을 재': '載',
  '비출 조': '照',
  '감계 감': '鑑',
  '살필 성': '省',
  '깊을 심': '深',
  '오묘할 묘': '妙',
  '넓을 박': '博',
  '꿰뚫을 통': '通',
  '정밀할 정': '精',
  '미세할 미': '微',
  '웅장할 웅': '雄',
  '높을 준': '峻',
  '엄숙할 엄': '嚴',
  '빛날 휘': '輝',
};

// Fix minor typo in '공평할 공'
HUNEUM_TO_HANJA['공평할 공'] = '公';

// Build compact key lookup without spaces (e.g. '한일' -> '一', '다섯오' -> '五')
const COMPACT_TO_ENTRY: Record<string, { char: string; meaning: string }> = {};
Object.entries(HUNEUM_TO_HANJA).forEach(([meaning, char]) => {
  const compact = meaning.replace(/\s+/g, '');
  if (!COMPACT_TO_ENTRY[compact]) {
    COMPACT_TO_ENTRY[compact] = { char, meaning };
  }
});

// Reverse map: Hanja char -> primary meaning
const HANJA_TO_HUNEUM: Record<string, string> = {};
Object.entries(HUNEUM_TO_HANJA).forEach(([meaning, char]) => {
  if (!HANJA_TO_HUNEUM[char]) {
    HANJA_TO_HUNEUM[char] = meaning;
  }
});

export interface HanjaCandidate {
  char: string;
  meaning: string;
  source: 'lesson' | 'pool';
}

export function lookupHanjaChar(meaning: string): string {
  const trimmed = (meaning || '').trim();
  if (!trimmed) return '';
  if (HUNEUM_TO_HANJA[trimmed]) return HUNEUM_TO_HANJA[trimmed];
  const compact = trimmed.replace(/\s+/g, '');
  if (COMPACT_TO_ENTRY[compact]) return COMPACT_TO_ENTRY[compact].char;
  return '';
}

export function parseHanjaToken(raw: string): { char: string; meaning: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { char: '', meaning: '' };

  // Check if contains CJK Ideograph directly e.g. '一 (한 일)' or '一'
  const cjkMatch = trimmed.match(/([\u4E00-\u9FFF\u3400-\u4DBF])/);
  if (cjkMatch) {
    const char = cjkMatch[1];
    const rest = trimmed
      .replace(char, '')
      .replace(/[\(\)\[\]]/g, '')
      .trim();
    const meaning = rest || HANJA_TO_HUNEUM[char] || '';
    return { char, meaning };
  }

  // Otherwise treat as Korean reading e.g. '한 일' or '한일'
  const directChar = HUNEUM_TO_HANJA[trimmed];
  if (directChar) return { char: directChar, meaning: trimmed };

  const compact = trimmed.replace(/\s+/g, '');
  const compactEntry = COMPACT_TO_ENTRY[compact];
  if (compactEntry) return compactEntry;

  return { char: '', meaning: trimmed };
}

/**
 * Extracts all lessons available for a given level from the existing bank, sections, and songLessons.
 */
export function getLessonsForLevel(state: AppState, level: string): string[] {
  const ordered = getOrderedBankRanges(state.bank, state.bankRangeOrder, level);
  const set = new Set<string>(ordered);

  // Also include any lesson names used in sections for this level
  (state.sections || []).forEach((sec) => {
    (sec.items || []).forEach((item) => {
      if ((item.baseLevel === level || item.levelLabel === level) && item.rangeName?.trim()) {
        set.add(item.rangeName.trim());
      }
    });
  });

  // Also include any songLessons already saved for this level
  if (state.songLessons) {
    Object.values(state.songLessons).forEach((sl) => {
      if (sl.level === level && sl.lessonName?.trim()) {
        set.add(sl.lessonName.trim());
      }
    });
  }

  return Array.from(set);
}

/**
 * Extracts Hanja candidates from existing system data for (level, lessonName):
 * 1. First from state.bank[level][lessonName] (prob1~prob4) -> source: 'lesson'
 * 2. Then from state.quizPool[level] -> source: 'pool'
 */
export function getLessonHanjaCandidates(
  state: AppState,
  level: string,
  lessonName: string
): HanjaCandidate[] {
  const candidates: HanjaCandidate[] = [];
  const seenKey = new Set<string>();

  const pushToken = (rawToken: string, source: 'lesson' | 'pool') => {
    const cleaned = rawToken.replace(/^\d+[\.\)]\s*/, '').trim();
    if (!cleaned) return;
    const parsed = parseHanjaToken(cleaned);
    const dedupeKey = parsed.char || parsed.meaning;
    if (!dedupeKey || seenKey.has(dedupeKey)) return;
    seenKey.add(dedupeKey);
    candidates.push({
      char: parsed.char,
      meaning: parsed.meaning,
      source,
    });
  };

  // 1. From Problem Bank for this exact lesson
  const lessonBankData = state.bank?.[level]?.[lessonName];
  if (lessonBankData) {
    (['prob1', 'prob2', 'prob3', 'prob4'] as const).forEach((k) => {
      const txt = lessonBankData[k];
      if (typeof txt === 'string' && txt.trim()) {
        txt
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((tok) => pushToken(tok, 'lesson'));
      }
    });
  }

  // 2. From Quiz Pool for this level
  const pool = state.quizPool?.[level] || [];
  pool.forEach((tok) => pushToken(tok, 'pool'));

  return candidates;
}

/**
 * Smart Hanja suggestion when teacher drags a word from lyrics.
 * Checks both the dragged word AND the surrounding phrase (e.g. '엑스자로 다섯오' -> 五 (다섯 오)).
 */
export function suggestHanjaForDraggedWord(
  draggedWord: string,
  lyrics: string,
  startOffset: number,
  endOffset: number,
  candidates: HanjaCandidate[]
): HanjaCandidate | null {
  const cleanWord = draggedWord.replace(/\s+/g, '');
  const contextAfter = lyrics.slice(startOffset, Math.min(lyrics.length, endOffset + 14)).replace(/\s+/g, '');
  const contextBefore = lyrics.slice(Math.max(0, startOffset - 8), endOffset).replace(/\s+/g, '');

  // Priority 1: Exact compact match inside dragged word
  for (const c of candidates) {
    const cCompact = c.meaning.replace(/\s+/g, '');
    if (cCompact && (cleanWord.includes(cCompact) || (c.char && cleanWord.includes(c.char)))) {
      return c;
    }
  }

  // Priority 2: Match in immediate following lyrics phrase (e.g. "한 개는 한일", "엑스자로 다섯오")
  for (const c of candidates) {
    const cCompact = c.meaning.replace(/\s+/g, '');
    if (cCompact && contextAfter.includes(cCompact)) {
      return c;
    }
  }

  // Priority 3: Match in preceding lyrics phrase
  for (const c of candidates) {
    const cCompact = c.meaning.replace(/\s+/g, '');
    if (cCompact && contextBefore.includes(cCompact)) {
      return c;
    }
  }

  // Priority 4: Global dictionary compact match in phrase
  for (const [compact, entry] of Object.entries(COMPACT_TO_ENTRY)) {
    if (cleanWord.includes(compact) || contextAfter.includes(compact)) {
      return { char: entry.char, meaning: entry.meaning, source: 'pool' };
    }
  }

  return null;
}
