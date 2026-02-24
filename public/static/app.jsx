const { useState, useEffect } = React;

// ✅ LocalStorage 기반 영구 저장소
const storage = {
  get: (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
};

function PsychologicalTestSystem() {
  const [view, setView] = useState("login");
  const [activeLinkId, setActiveLinkId] = useState(null);
  const [activeLinkData, setActiveLinkData] = useState(null);
  const [userInfo, setUserInfo] = useState({ phone: "", password: "" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCounselor, setIsCounselor] = useState(false);
  const [counselorPhone, setCounselorPhone] = useState("");
  const [loginMsg, setLoginMsg] = useState({ type: "", text: "" });
  const [counselorForm, setCounselorForm] = useState({
    name: "", phone: "", password: "", certification: "", education: "", experience: ""
  });
  const [linkForm, setLinkForm] = useState({ clientName: "", clientPhone: "", testType: "SCT", counselingType: "psychological" });
  const [generatedLinks, setGeneratedLinks] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [showLinkId, setShowLinkId] = useState(null);
  const [sctResponses, setSctResponses] = useState({});
  const [sctSummaries, setSctSummaries] = useState({});
  const [loadingSummary, setLoadingSummary] = useState({});
  const [dsiResponses, setDsiResponses] = useState({});
  const [dsiRec, setDsiRec] = useState("");
  const [loadingRec, setLoadingRec] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [sessionId, setSessionId] = useState(() => genId("session"));
  const [submitted, setSubmitted] = useState([]);
  const [pendingCounselors, setPendingCounselors] = useState([]);
  const [approvedCounselors, setApprovedCounselors] = useState([]);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });
  const [linkInput, setLinkInput] = useState("");

  // ✅ 로그인 상태 저장
  function saveLoginState(loginData) {
    storage.set("current_login", JSON.stringify(loginData));
    console.log('💾 로그인 상태 저장:', loginData.type);
  }

  // ✅ 로그인 상태 복원
  function restoreLoginState() {
    const loginData = storage.get("current_login");
    if (!loginData) return false;
    
    try {
      const data = JSON.parse(loginData.value);
      console.log('🔄 로그인 상태 복원:', data.type);
      
      if (data.type === "admin") {
        setIsAdmin(true);
        setView("admin");
        loadAllSubmitted();
        const r = storage.get("counselor_requests");
        const pendingList = r ? JSON.parse(r.value).filter(c => c.status === "pending") : [];
        setPendingCounselors(pendingList);
        const a = storage.get("approved_counselors");
        const approvedList = a ? JSON.parse(a.value) : [];
        setApprovedCounselors(approvedList);
        return true;
      } else if (data.type === "counselor") {
        setIsCounselor(true);
        setCounselorPhone(data.phone);
        const lr = storage.get("counselor_links_" + data.phone);
        const links = lr ? JSON.parse(lr.value) : [];
        setGeneratedLinks(links);
        loadAllSubmitted();
        setView("counselorDashboard");
        return true;
      }
    } catch (error) {
      console.error('❌ 로그인 복원 실패:', error);
      storage.remove("current_login");
    }
    return false;
  }

  // ✅ 로그아웃 시 상태 제거
  function clearLoginState() {
    storage.remove("current_login");
    console.log('🚪 로그인 상태 제거');
  }

  function genId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  const counselingKw = [
    "상담심리", "상담학", "심리상담", "임상심리", "상담복지", "상담교육", "상담치료", "심리치료", "정신건강", "심리학",
    "청소년상담", "가족상담", "아동상담", "부부상담", "집단상담", "진로상담", "다문화상담", "중독상담", "재활상담",
    "기독교상담", "목회상담", "코칭상담", "긍정심리", "치유상담", "사회복지", "특수교육", "아동학", "아동복지",
    "교육심리", "청소년학", "교육상담", "정신보건", "미술치료", "음악치료", "놀이치료", "모래놀이", "심리재활",
    "정신건강사회복지", "중독재활", "상담코칭", "심리코칭",
  ];
  
  function checkEdu(edu) {
    if (!edu) return { ok: false, kws: [] };
    const kws = counselingKw.filter(k => edu.toLowerCase().includes(k));
    return { ok: kws.length > 0, kws };
  }

  const sctCategories = {
    "① 어머니에 대한 태도": [13, 26, 39, 49], "② 아버지에 대한 태도": [2, 19, 29, 50],
    "③ 가족에 대한 태도": [12, 24, 35, 48], "④ 여성에 대한 태도": [9, 25],
    "⑤ 남성에 대한 태도": [8, 20, 36], "⑥ 이성에 대한 태도": [10, 23],
    "⑦ 친구나 친지에 대한 태도": [6, 22, 32, 44], "⑧ 권위자에 대한 태도": [3, 31],
    "⑨ 두려움에 대한 태도": [5, 21, 40, 43], "⑩ 죄책감에 대한 태도": [14, 17, 27, 46],
    "⑪ 자신의 능력에 대한 태도": [1, 15, 34, 38], "⑫ 과거에 대한 태도": [7, 33, 45],
    "⑬ 미래에 대한 태도": [4, 11, 16, 18, 28], "⑭ 목표에 대한 태도": [30, 41, 42],
  };
  
  const sctQ = {
    1: "나에게 이상한 일이 생겼을 때", 2: "내 생각에 가끔 아버지는", 3: "우리 윗사람들은",
    4: "나의 장래는", 5: "어리석게도 내가 두려워하는 것은", 6: "내 생각에 참다운 친구는",
    7: "내가 어렸을 때는", 8: "남자에 대해서 무엇보다 좋지 않게 생각하는 것은", 9: "내가 바라는 여인상은",
    10: "남녀가 같이 있는 것을 볼 때", 11: "내가 늘 원하기는", 12: "다른 가정과 비교해서 우리 집안은",
    13: "나의 어머니는", 14: "무슨 일을 해서라도 잊고 싶은 것은", 15: "내가 믿고 있는 내 능력은",
    16: "내가 정말 행복할 수 있으려면", 17: "어렸을 때 잘못했다고 느끼는 것은", 18: "내가 보는 나의 앞날은",
    19: "대개 아버지들이란", 20: "내 생각에 남자들이란", 21: "다른 친구들이 모르는 나만의 두려움은",
    22: "내가 싫어하는 사람은", 23: "결혼 생활에 대한 나의 생각은", 24: "우리 가족이 나에 대해서",
    25: "내 생각에 여자들이란", 26: "어머니와 나는", 27: "내가 저지른 가장 큰 잘못은",
    28: "언젠가 나는", 29: "내가 바라기에 아버지는", 30: "나의 야망은",
    31: "윗사람이 오는 것을 보면 나는", 32: "내가 제일 좋아하는 사람은", 33: "내가 다시 젊어진다면",
    34: "나의 가장 큰 결점은", 35: "내가 아는 대부분의 집안은", 36: "완전한 남성상(男性像)은",
    37: "내가 성관계를 했다면", 38: "행운이 나를 외면했을 때", 39: "대개 어머니들이란",
    40: "내가 잊고 싶은 두려움은", 41: "내가 평생 가장 하고 싶은 일은", 42: "내가 늙으면",
    43: "때때로 두려운 생각이 나를 휩쌀 때", 44: "내가 없을 때 친구들은", 45: "생생한 어린 시절의 기억은",
    46: "무엇보다도 좋지 않게 여기는 것은", 47: "나의 성생활은", 48: "내가 어렸을 때 우리 가족은",
    49: "나는 어머니를 좋아했지만", 50: "아버지와 나는",
  };

  const dsiQ = [
    { num: 1, content: "중요한 결정을 내릴 때 마음 내키는 대로 결정하는 일이 많다.", rev: true, area: "인지적 기능" },
    { num: 2, content: "말부터 해 놓고 나중에 후회하는 일이 많다.", rev: true, area: "인지적 기능" },
    { num: 3, content: "비교적 내 감정을 잘 통제해 나가는 편이다.", rev: false, area: "인지적 기능" },
    { num: 4, content: "다른 사람의 기대에 맞추려고 노력한다.", rev: true, area: "인지적 기능" },
    { num: 5, content: "가족의 의견에 쉽게 동요된다.", rev: true, area: "인지적 기능" },
    { num: 6, content: "스트레스 받을 때 충동적으로 행동한다.", rev: true, area: "인지적 기능" },
    { num: 7, content: "문제를 논리적으로 분석해 해결한다.", rev: false, area: "인지적 기능" },
    { num: 8, content: "자신의 가치관을 일관되게 유지한다.", rev: false, area: "자아통합" },
    { num: 9, content: "중요한 결정은 스스로 내린다.", rev: false, area: "자아통합" },
    { num: 10, content: "타인의 압력에도 원칙을 지킨다.", rev: false, area: "자아통합" },
    { num: 11, content: "가족 문제에 과도하게 개입한다.", rev: true, area: "자아통합" },
    { num: 12, content: "가족 기대 때문에 자신의 길을 바꾼다.", rev: true, area: "자아통합" },
    { num: 13, content: "자기 목표를 명확히 추구한다.", rev: false, area: "자아통합" },
    { num: 14, content: "어릴 적 부모의 갈등이 나에게 영향을 줬다.", rev: true, area: "가족투사" },
    { num: 15, content: "부모 중 한 명에게 더 의존했다.", rev: true, area: "가족투사" },
    { num: 16, content: "형제 중 특정 한 명이 문제 자녀였다.", rev: true, area: "가족투사" },
    { num: 17, content: "가족 문제가 나의 선택에 영향을 줬다.", rev: true, area: "가족투사" },
    { num: 18, content: "가족의 기대를 저버린 적이 거의 없다.", rev: true, area: "가족투사" },
    { num: 19, content: "부모의 불화가 내 삶에 남아있다.", rev: true, area: "가족투사" },
    { num: 20, content: "가족과 적절한 거리를 유지한다.", rev: false, area: "정서적 단절" },
    { num: 21, content: "가족 갈등 시 멀리 도망간다.", rev: true, area: "정서적 단절" },
    { num: 22, content: "가족과 연락을 최소화한다.", rev: true, area: "정서적 단절" },
    { num: 23, content: "가족 모임에 불편함을 느낀다.", rev: true, area: "정서적 단절" },
    { num: 24, content: "가족 문제에 무관심하다.", rev: true, area: "정서적 단절" },
    { num: 25, content: "가족 전체가 스트레스 시 퇴행한다.", rev: true, area: "가족퇴행" },
    { num: 26, content: "가족 모임에서 합리적으로 행동한다.", rev: false, area: "가족퇴행" },
    { num: 27, content: "가족이 나의 독립을 존중한다.", rev: false, area: "가족퇴행" },
    { num: 28, content: "가족 갈등을 논리적으로 해결한다.", rev: false, area: "가족퇴행" },
    { num: 29, content: "가족 내 역할이 명확하다.", rev: false, area: "가족퇴행" },
    { num: 30, content: "가족이 서로 자율성을 가진다.", rev: false, area: "가족퇴행" },
    { num: 31, content: "가족 스트레스 시 침착하다.", rev: false, area: "가족퇴행" },
    { num: 32, content: "가족 관계가 안정적이다.", rev: false, area: "가족퇴행" },
    { num: 33, content: "우리 가족은 서로 과잉보호적이다.", rev: true, area: "가족퇴행" },
    { num: 34, content: "가족이 감정적으로 의지한다.", rev: true, area: "가족퇴행" },
    { num: 35, content: "가족 모임이 피곤하다.", rev: true, area: "가족퇴행" },
    { num: 36, content: "우리 가족들은 서로에 대해 별 관심이 없었다.", rev: true, area: "가족퇴행" },
  ];

  function calcDsi() {
    let total = 0;
    const areas = { "인지적 기능": 0, "자아통합": 0, "가족투사": 0, "정서적 단절": 0, "가족퇴행": 0 };
    dsiQ.forEach(q => {
      const r = dsiResponses[q.num];
      if (r) {
        const s = q.rev ? 6 - r : r;
        total += s;
        areas[q.area] += s;
      }
    });
    return { total, areas };
  }

  function storeLink(d) {
    storage.set("link_" + d.linkId, JSON.stringify(d));
  }
  
  function loadLink(id) {
    const r = storage.get("link_" + id);
    return r ? JSON.parse(r.value) : null;
  }
  
  function storeSession(data) {
    storage.set("session_" + data.sessionId, JSON.stringify(data));
    console.log('💾 세션 저장:', data.sessionId, '| 검사:', data.testType);
    
    const listRaw = storage.get("submitted_list");
    const list = listRaw ? JSON.parse(listRaw.value) : [];
    const sessionInfo = {
      sessionId: data.sessionId,
      testType: data.testType,
      userPhone: data.userPhone,
      createdAt: data.createdAt,
      linkId: data.linkId
    };
    list.unshift(sessionInfo);
    storage.set("submitted_list", JSON.stringify(list));
    console.log('📊 제출 목록 업데이트:', list.length + '건');
    
    setSubmitted(list);
  }
  
  function loadAllSubmitted() {
    const r = storage.get("submitted_list");
    const list = r ? JSON.parse(r.value) : [];
    setSubmitted(list);
    console.log('📊 제출 목록 로드:', list.length + '건');
  }

  // 🕐 24시간 만료 체크 및 자동 삭제 함수
  function checkAndCleanExpiredSessions() {
    console.log('🕐 만료된 검사 결과 확인 시작...');
    const listRaw = storage.get("submitted_list");
    if (!listRaw) return;
    
    const list = JSON.parse(listRaw.value);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
    
    const validSessions = [];
    let deletedCount = 0;
    
    list.forEach(session => {
      const createdTime = new Date(session.createdAt).getTime();
      const age = now - createdTime;
      
      if (age >= TWENTY_FOUR_HOURS) {
        // 24시간 경과 - 삭제
        storage.remove("session_" + session.sessionId);
        deletedCount++;
        console.log(`🗑️ 만료된 검사 삭제: ${session.sessionId} (생성: ${session.createdAt})`);
      } else {
        validSessions.push(session);
      }
    });
    
    if (deletedCount > 0) {
      storage.set("submitted_list", JSON.stringify(validSessions));
      setSubmitted(validSessions);
      console.log(`✅ 만료된 검사 ${deletedCount}건 삭제 완료`);
    } else {
      console.log('✅ 만료된 검사 없음');
    }
  }

  // ⏱️ 남은 시간 계산 (밀리초 → 시:분:초)
  function getTimeRemaining(createdAt) {
    const now = Date.now();
    const createdTime = new Date(createdAt).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const elapsed = now - createdTime;
    const remaining = TWENTY_FOUR_HOURS - elapsed;
    
    if (remaining <= 0) {
      return { expired: true, text: "만료됨", color: "text-red-600" };
    }
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    
    let color = "text-green-600";
    if (hours < 3) color = "text-red-600";
    else if (hours < 6) color = "text-orange-600";
    
    return {
      expired: false,
      text: `${hours}시간 ${minutes}분 ${seconds}초`,
      color: color,
      hours: hours
    };
  }

  // 💾 JSON 파일로 검사 결과 다운로드
  function downloadSessionJson(sessionId) {
    const r = storage.get("session_" + sessionId);
    if (!r) {
      alert('❌ 검사 결과를 찾을 수 없습니다.');
      return;
    }
    
    const sessionData = JSON.parse(r.value);
    const jsonStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `검사결과_${sessionData.testType}_${sessionId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('💾 JSON 다운로드:', sessionId);
    alert('✅ 검사 결과가 JSON 파일로 다운로드되었습니다!');
  }

  // 📂 JSON 파일에서 검사 결과 불러오기
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessionData = JSON.parse(e.target.result);
        console.log('📂 JSON 파일 로드:', sessionData.sessionId);
        
        // 세션 데이터 복원
        if (sessionData.testType === "SCT") {
          setSctResponses(sessionData.responses || {});
          setSctSummaries(sessionData.summaries || {});
        } else if (sessionData.testType === "DSI") {
          setDsiResponses(sessionData.responses || {});
          setDsiRec(sessionData.recommendation || "");
        }
        
        setSessionId(sessionData.sessionId);
        setUserInfo({ phone: sessionData.userPhone || "", password: "" });
        setView(sessionData.testType === "SCT" ? "sctResult" : "dsiResult");
        
        alert(`✅ ${sessionData.testType} 검사 결과를 불러왔습니다!\n세션 ID: ${sessionData.sessionId}`);
      } catch (error) {
        console.error('❌ JSON 파싱 오류:', error);
        alert('❌ 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  }

  function copyLink(linkId) {
    const text = linkId;
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(linkId);
        setTimeout(() => setCopiedId(null), 2500);
      }).catch(() => fallbackCopy(linkId, text));
    } catch {
      fallbackCopy(linkId, text);
    }
  }
  
  function fallbackCopy(linkId, text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // 📄 PDF 생성 함수들
  async function generateSctPdf(sessionData) {
    try {
      console.log('📄 SCT PDF 생성 시작...');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 한글 폰트 설정 (기본 폰트 사용)
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // 헤더
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('문장완성검사 (SCT) 결과 리포트', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Sentence Completion Test Report', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // 기본 정보
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 1. Basic Information ]', margin, yPos);
      yPos += 8;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(`Session ID: ${sessionData.sessionId}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Test Date: ${new Date(sessionData.createdAt).toLocaleString('ko-KR')}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`User Phone: ${sessionData.userPhone || 'N/A'}`, margin + 5, yPos);
      yPos += 10;

      // 카테고리별 응답 및 AI 분석
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 2. Category Analysis ]', margin, yPos);
      yPos += 8;

      for (const cat of sctCategories) {
        // 페이지 넘김 체크
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`${cat.emoji} ${cat.name}`, margin + 5, yPos);
        yPos += 7;

        const catQs = sctQ.filter(q => q.cat === cat.name);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);

        for (const q of catQs) {
          const answer = sessionData.responses[q.num] || '(No answer)';
          
          // 질문
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }
          
          const questionText = `Q${q.num}. ${q.txt}`;
          const questionLines = doc.splitTextToSize(questionText, pageWidth - margin * 2 - 10);
          doc.text(questionLines, margin + 10, yPos);
          yPos += questionLines.length * 5;
          
          // 답변
          const answerText = `A: ${answer}`;
          const answerLines = doc.splitTextToSize(answerText, pageWidth - margin * 2 - 10);
          doc.setTextColor(0, 102, 204);
          doc.text(answerLines, margin + 10, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += answerLines.length * 5 + 3;
        }

        // AI 분석 추가
        if (sessionData.summaries && sessionData.summaries[cat.name]) {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

          doc.setFont(undefined, 'bold');
          doc.setFontSize(9);
          doc.text('AI Analysis:', margin + 10, yPos);
          yPos += 6;

          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
          const summaryLines = doc.splitTextToSize(sessionData.summaries[cat.name], pageWidth - margin * 2 - 15);
          doc.setFillColor(240, 240, 240);
          doc.rect(margin + 10, yPos - 4, pageWidth - margin * 2 - 10, summaryLines.length * 4 + 4, 'F');
          doc.text(summaryLines, margin + 12, yPos);
          yPos += summaryLines.length * 4 + 8;
        }

        yPos += 5;
      }

      // 푸터
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${totalPages} | Generated: ${new Date().toLocaleDateString('ko-KR')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // 다운로드
      const fileName = `SCT_Report_${sessionData.sessionId}_${new Date().getTime()}.pdf`;
      doc.save(fileName);
      console.log('✅ SCT PDF 생성 완료:', fileName);
      alert('✅ SCT 검사 결과 PDF가 다운로드되었습니다!');
    } catch (error) {
      console.error('❌ PDF 생성 실패:', error);
      alert('❌ PDF 생성 중 오류가 발생했습니다: ' + error.message);
    }
  }

  async function generateDsiPdf(sessionData) {
    try {
      console.log('📄 DSI PDF 생성 시작...');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // 임시로 응답 복원
      const tempDsiResponses = sessionData.responses;
      
      // 점수 계산
      let total = 0;
      const areas = { "가족불화": 0, "부모관계": 0, "형제관계": 0, "가족퇴행": 0, "투사": 0 };
      dsiQ.forEach(q => {
        const r = tempDsiResponses[q.num];
        if (r) {
          const s = q.rev ? 6 - r : r;
          total += s;
          areas[q.area] += s;
        }
      });

      // 헤더
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('가족관계검사 (DSI) 결과 리포트', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Differentiation of Self Inventory Report', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // 기본 정보
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 1. Basic Information ]', margin, yPos);
      yPos += 8;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(`Session ID: ${sessionData.sessionId}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Test Date: ${new Date(sessionData.createdAt).toLocaleString('ko-KR')}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`User Phone: ${sessionData.userPhone || 'N/A'}`, margin + 5, yPos);
      yPos += 12;

      // 종합 점수
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 2. Overall Score ]', margin, yPos);
      yPos += 8;

      const level = total >= 109 ? 'High' : total >= 73 ? 'Medium' : 'Low';
      const levelKr = total >= 109 ? '높음' : total >= 73 ? '중간' : '낮음';
      const levelColor = total >= 109 ? [255, 87, 87] : total >= 73 ? [255, 193, 7] : [76, 175, 80];

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Score: ${total} / 180`, margin + 5, yPos);
      yPos += 6;
      
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...levelColor);
      doc.text(`Level: ${levelKr} (${level})`, margin + 5, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 12;

      // 영역별 점수
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 3. Area Scores ]', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      const areaNames = Object.keys(areas);
      for (const areaName of areaNames) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }

        const score = areas[areaName];
        const areaQs = dsiQ.filter(q => q.area === areaName);
        const maxScore = areaQs.length * 5;
        const avgScore = (score / areaQs.length).toFixed(1);

        doc.text(`${areaName}: ${score} / ${maxScore} (Avg: ${avgScore})`, margin + 5, yPos);
        
        // 진행 바
        const barWidth = 100;
        const barHeight = 4;
        const fillWidth = (score / maxScore) * barWidth;
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(margin + 60, yPos - 3, barWidth, barHeight);
        
        doc.setFillColor(...levelColor);
        doc.rect(margin + 60, yPos - 3, fillWidth, barHeight, 'F');
        
        yPos += 8;
      }

      yPos += 5;

      // 상세 응답
      doc.addPage();
      yPos = margin;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('[ 4. Detailed Responses ]', margin, yPos);
      yPos += 8;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');

      for (const q of dsiQ) {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        const answer = tempDsiResponses[q.num] || 'N/A';
        const scoreText = q.rev ? `(Reversed, Score: ${6 - parseInt(answer)})` : `(Score: ${answer})`;
        
        const questionText = `Q${q.num}. ${q.txt}`;
        const questionLines = doc.splitTextToSize(questionText, pageWidth - margin * 2 - 10);
        doc.text(questionLines, margin + 5, yPos);
        yPos += questionLines.length * 4;
        
        doc.setTextColor(0, 102, 204);
        doc.text(`Answer: ${answer} ${scoreText} | Area: ${q.area}`, margin + 5, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 6;
      }

      // AI 권장사항 (있는 경우)
      if (sessionData.recommendation) {
        doc.addPage();
        yPos = margin;

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('[ 5. AI Recommendations ]', margin, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        const recLines = doc.splitTextToSize(sessionData.recommendation, pageWidth - margin * 2 - 5);
        doc.text(recLines, margin + 5, yPos);
      }

      // 푸터
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${totalPages} | Generated: ${new Date().toLocaleDateString('ko-KR')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // 다운로드
      const fileName = `DSI_Report_${sessionData.sessionId}_${new Date().getTime()}.pdf`;
      doc.save(fileName);
      console.log('✅ DSI PDF 생성 완료:', fileName);
      alert('✅ DSI 검사 결과 PDF가 다운로드되었습니다!');
    } catch (error) {
      console.error('❌ PDF 생성 실패:', error);
      alert('❌ PDF 생성 중 오류가 발생했습니다: ' + error.message);
    }
  }

  function copyLink(linkId) {
    const text = linkId;
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(linkId);
        setTimeout(() => setCopiedId(null), 2500);
      }).catch(() => fallbackCopy(linkId, text));
    } catch {
      fallbackCopy(linkId, text);
    }
  }
  
  function fallbackCopy(linkId, text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function generateLink() {
    if (!linkForm.clientName || !linkForm.clientPhone) {
      setFormMsg({ type: "error", text: "내담자 이름과 전화번호를 입력해주세요." });
      return;
    }
    const linkId = genId("link");
    const data = {
      linkId,
      counselorPhone,
      clientName: linkForm.clientName,
      clientPhone: linkForm.clientPhone,
      testType: linkForm.testType,
      counselingType: linkForm.counselingType, // 상담 유형 추가
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    storeLink(data);
    console.log('🔗 링크 생성:', linkId, '| 내담자:', data.clientName, '| 검사:', data.testType, '| 상담 유형:', data.counselingType);
    
    setGeneratedLinks(prev => [data, ...prev]);
    setLinkForm({ clientName: "", clientPhone: "", testType: "SCT", counselingType: "psychological" });
    setFormMsg({ type: "success", text: "링크가 생성되었습니다! 📋 링크 ID 복사 버튼으로 내담자에게 전달하세요." });
    setTimeout(() => setFormMsg({ type: "", text: "" }), 4000);
  }

  function enterByLinkId() {
    const id = linkInput.trim();
    if (!id) {
      setLoginMsg({ type: "error", text: "링크 ID를 입력해주세요." });
      return;
    }
    const data = loadLink(id);
    if (!data) {
      setLoginMsg({ type: "error", text: "유효하지 않은 링크 ID입니다. 상담사에게 다시 확인하세요." });
      return;
    }
    setActiveLinkId(id);
    setActiveLinkData(data);
    setLoginMsg({ type: "", text: "" });
    setView("clientLogin");
  }

  function clientLogin() {
    if (!userInfo.phone || !userInfo.password) {
      setLoginMsg({ type: "error", text: "전화번호와 비밀번호를 모두 입력해주세요." });
      return;
    }
    if (!activeLinkData) {
      setLoginMsg({ type: "error", text: "링크 정보가 없습니다." });
      return;
    }
    const inp = userInfo.phone.replace(/-/g, "");
    const reg = activeLinkData.clientPhone.replace(/-/g, "");
    if (inp !== reg) {
      setLoginMsg({ type: "error", text: "등록된 전화번호와 일치하지 않습니다." });
      return;
    }
    setLoginMsg({ type: "", text: "" });
    setSctResponses({});
    setSctSummaries({});
    setDsiResponses({});
    setSessionId(genId("session"));
    setView(activeLinkData.testType === "SCT" ? "sctTest" : "dsiTest");
  }

  function adminLogin() {
    if (userInfo.phone === "limyj007" && userInfo.password === "SKplimyj007") {
      console.log('🔐 관리자 로그인 성공');
      setIsAdmin(true);
      setView("admin");
      
      // ✅ 로그인 상태 저장
      saveLoginState({ type: "admin" });
      
      // 데이터 로드
      loadAllSubmitted();
      const r = storage.get("counselor_requests");
      const pendingList = r ? JSON.parse(r.value).filter(c => c.status === "pending") : [];
      setPendingCounselors(pendingList);
      console.log('⏳ 대기 중인 상담사:', pendingList.length + '명');
      
      const a = storage.get("approved_counselors");
      const approvedList = a ? JSON.parse(a.value) : [];
      setApprovedCounselors(approvedList);
      console.log('✅ 승인된 상담사:', approvedList.length + '명');
      
      setLoginMsg({ type: "", text: "" });
    } else {
      setLoginMsg({ type: "error", text: "관리자 계정 정보가 올바르지 않습니다." });
    }
  }

  function counselorLogin() {
    if (!userInfo.phone || !userInfo.password) {
      setLoginMsg({ type: "error", text: "정보를 입력해주세요." });
      return;
    }
    const r = storage.get("approved_counselors");
    const list = r ? JSON.parse(r.value) : [];
    console.log('🔍 로그인 시도:', userInfo.phone, '| 승인된 상담사:', list.length + '명');
    
    const found = list.find(c => c.phone === userInfo.phone && c.password === userInfo.password);
    if (found) {
      console.log('✅ 상담사 로그인 성공:', found.phone);
      setIsCounselor(true);
      setCounselorPhone(found.phone);
      
      // ✅ 로그인 상태 저장
      saveLoginState({ type: "counselor", phone: found.phone });
      
      // 상담사의 링크 목록 로드
      const lr = storage.get("counselor_links_" + found.phone);
      const links = lr ? JSON.parse(lr.value) : [];
      setGeneratedLinks(links);
      console.log('🔗 생성된 링크:', links.length + '건');
      
      loadAllSubmitted();
      setView("counselorDashboard");
      setLoginMsg({ type: "", text: "" });
      setLoginMsg({ type: "", text: "" });
    } else {
      setLoginMsg({ type: "error", text: "승인된 상담사가 아니거나 정보가 올바르지 않습니다." });
    }
  }

  // ✅ 컴포넌트 마운트 시 데이터 로드 및 로그인 상태 복원
  useEffect(() => {
    console.log('🔄 앱 초기화 - LocalStorage 데이터 로드 시작');
    
    // 🕐 만료된 검사 결과 자동 삭제 (최우선)
    checkAndCleanExpiredSessions();
    
    // ✅ 로그인 상태 복원
    const restored = restoreLoginState();
    if (restored) {
      console.log('✅ 로그인 상태 자동 복원 완료');
    } else {
      console.log('ℹ️ 복원할 로그인 정보 없음 - 로그인 화면 표시');
    }
    
    // 디버깅: LocalStorage 키 확인
    const keys = Object.keys(localStorage);
    console.log('📦 저장된 키 목록:', keys.filter(k => 
      k.includes('counselor') || k.includes('submitted') || k.includes('link_') || k.includes('session_') || k.includes('login')
    ));
    
    // 승인된 상담사 수 확인
    const approvedData = storage.get("approved_counselors");
    if (approvedData) {
      const approved = JSON.parse(approvedData.value);
      console.log('✅ 승인된 상담사:', approved.length + '명');
    }
    
    // 대기 중인 상담사 수 확인
    const pendingData = storage.get("counselor_requests");
    if (pendingData) {
      const pending = JSON.parse(pendingData.value).filter(c => c.status === "pending");
      console.log('⏳ 대기 중인 상담사:', pending.length + '명');
    }
    
    // 제출된 검사 수 확인
    const submittedData = storage.get("submitted_list");
    if (submittedData) {
      const submitted = JSON.parse(submittedData.value);
      console.log('📊 제출된 검사:', submitted.length + '건');
    }
    
    console.log('✅ 데이터 로드 완료');
    
    // 🔄 1분마다 만료 체크 (백그라운드)
    const intervalId = setInterval(() => {
      checkAndCleanExpiredSessions();
    }, 60000); // 1분
    
    return () => clearInterval(intervalId);
  }, []); // 한 번만 실행

  useEffect(() => {
    if (isCounselor && counselorPhone) {
      storage.set("counselor_links_" + counselorPhone, JSON.stringify(generatedLinks));
      console.log('💾 상담사 링크 저장:', counselorPhone, generatedLinks.length + '건');
    }
  }, [generatedLinks, isCounselor, counselorPhone]);

  function counselorSignup() {
    if (!counselorForm.phone || !counselorForm.password || !counselorForm.education) {
      setFormMsg({ type: "error", text: "전화번호, 비밀번호, 학력은 필수입니다." });
      return;
    }
    const r = storage.get("counselor_requests");
    const list = r ? JSON.parse(r.value) : [];
    if (list.find(c => c.phone === counselorForm.phone)) {
      setFormMsg({ type: "error", text: "이미 신청된 전화번호입니다." });
      return;
    }
    const { ok, kws } = checkEdu(counselorForm.education);
    const newCounselor = {
      ...counselorForm,
      eduOk: ok,
      eduKws: kws,
      requestDate: new Date().toISOString(),
      status: "pending"
    };
    list.push(newCounselor);
    storage.set("counselor_requests", JSON.stringify(list));
    console.log('✅ 상담사 가입 신청:', counselorForm.phone, '| 총', list.length + '건');
    setFormMsg({ type: "success", text: "가입 신청 완료! 관리자 승인 후 로그인 가능합니다." });
    setCounselorForm({ name: "", phone: "", password: "", certification: "", education: "", experience: "" });
    setTimeout(() => {
      setView("counselorLogin");
      setFormMsg({ type: "", text: "" });
    }, 2500);
  }

  function approveCounselor(phone) {
    console.log('🔄 상담사 승인 시작:', phone);
    
    const r = storage.get("counselor_requests");
    let list = r ? JSON.parse(r.value) : [];
    const target = list.find(c => c.phone === phone);
    
    if (!target) {
      console.error('❌ 승인 대상을 찾을 수 없음:', phone);
      return;
    }
    
    // 대기 목록에서 제거
    list = list.filter(c => c.phone !== phone);
    storage.set("counselor_requests", JSON.stringify(list));
    console.log('📝 대기 목록 업데이트:', list.length + '건 남음');
    
    // 승인 목록에 추가
    const a = storage.get("approved_counselors");
    const approved = a ? JSON.parse(a.value) : [];
    const approvedCounselor = { ...target, status: "approved", approvedDate: new Date().toISOString() };
    approved.push(approvedCounselor);
    storage.set("approved_counselors", JSON.stringify(approved));
    console.log('✅ 승인 완료:', phone, '| 총', approved.length + '명');
    
    // 화면 업데이트
    setPendingCounselors(list.filter(c => c.status === "pending"));
    setApprovedCounselors(approved);
    
    // 확인 메시지
    alert(`✅ ${target.name || phone} 상담사가 승인되었습니다!`);
  }
  
  function rejectCounselor(phone) {
    console.log('🔄 상담사 거부:', phone);
    const r = storage.get("counselor_requests");
    let list = r ? JSON.parse(r.value) : [];
    list = list.filter(c => c.phone !== phone);
    storage.set("counselor_requests", JSON.stringify(list));
    console.log('📝 대기 목록 업데이트:', list.length + '건 남음');
    setPendingCounselors(list.filter(c => c.status === "pending"));
  }

  function submitSct() {
    const missing = Object.keys(sctQ).filter(n => !sctResponses[n]?.trim());
    if (missing.length > 0) {
      setSaveStatus("⚠️ " + missing.length + "개 문항이 비어 있습니다.");
      return;
    }
    
    const data = {
      sessionId,
      testType: "SCT",
      responses: sctResponses,
      summaries: sctSummaries,
      createdAt: new Date().toISOString(),
      userPhone: userInfo.phone || "미확인",
      linkId: activeLinkId || null
    };
    
    console.log('📝 SCT 검사 제출:', sessionId, '| 링크:', activeLinkId);
    storeSession(data);
    
    // 링크 상태 업데이트
    if (activeLinkId) {
      const ld = loadLink(activeLinkId);
      if (ld) {
        ld.status = "completed";
        storeLink(ld);
        console.log('✅ 링크 상태 업데이트:', activeLinkId, '→ completed');
        setGeneratedLinks(prev => prev.map(l => l.linkId === activeLinkId ? { ...l, status: "completed" } : l));
      }
    }
    
    setView("complete");
  }
  
  function submitDsi() {
    if (Object.keys(dsiResponses).length < 36) {
      setSaveStatus("⚠️ " + (36 - Object.keys(dsiResponses).length) + "개 문항이 남아있습니다.");
      return;
    }
    
    const data = {
      sessionId,
      testType: "DSI",
      responses: dsiResponses,
      createdAt: new Date().toISOString(),
      userPhone: userInfo.phone || "미확인",
      linkId: activeLinkId || null
    };
    
    console.log('📝 DSI 검사 제출:', sessionId, '| 링크:', activeLinkId);
    storeSession(data);
    
    // 링크 상태 업데이트
    if (activeLinkId) {
      const ld = loadLink(activeLinkId);
      if (ld) {
        ld.status = "completed";
        storeLink(ld);
        console.log('✅ 링크 상태 업데이트:', activeLinkId, '→ completed');
        setGeneratedLinks(prev => prev.map(l => l.linkId === activeLinkId ? { ...l, status: "completed" } : l));
      }
    }
    setView("complete");
  }

  function viewSession(sid, returnDataOnly = false) {
    console.log('🔍 viewSession 호출:', sid, 'returnDataOnly:', returnDataOnly);
    
    const r = storage.get("session_" + sid);
    if (!r) {
      console.log('❌ 세션을 찾을 수 없습니다:', sid);
      return null;
    }
    
    const data = JSON.parse(r.value);
    console.log('✅ 세션 데이터 로드:', data.testType, data.userPhone);
    
    // PDF 생성을 위해 데이터만 반환하는 경우
    if (returnDataOnly) {
      console.log('📄 PDF 생성용 데이터 반환');
      return data;
    }
    
    // linkId가 있으면 링크 데이터 복원 (상담 유형 정보 포함)
    if (data.linkId) {
      const linkData = loadLink(data.linkId);
      if (linkData) {
        console.log('🔗 링크 데이터 복원:', linkData.counselingType);
        setActiveLinkData(linkData);
      }
    }
    
    // 일반 뷰어 모드
    if (data.testType === "SCT") {
      setSctResponses(data.responses || {});
      setSctSummaries(data.summaries || {});
      console.log('📝 SCT 응답 설정 완료');
    } else {
      setDsiResponses(data.responses || {});
      setDsiRec(data.recommendation || "");
      console.log('🔍 DSI 응답 설정 완료');
    }
    
    setSessionId(sid);
    setUserInfo({ phone: data.userPhone || "", password: "" });
    const targetView = data.testType === "SCT" ? "sctResult" : "dsiResult";
    console.log('🎯 뷰 전환:', targetView);
    setView(targetView);
    
    return data;
  }

  // ✅ SCT AI 권장사항 생성 (룰 기반 - 상담 유형별)
  function generateSctRecommendation(cat, nums) {
    setLoadingSummary(p => ({ ...p, [cat]: true }));
    
    // 상담 유형 확인 (기본값: 심리상담)
    const counselingType = activeLinkData?.counselingType || "psychological";
    
    // 응답 수집
    const responses = nums.map(n => ({
      question: sctQ[n],
      answer: sctResponses[n] || "(미응답)"
    }));
    
    // 키워드 분석
    const allText = responses.map(r => r.answer).join(" ").toLowerCase();
    
    // 상담 유형에 따라 분석 분기
    let analysis = "";
    let recommendations = [];
    
    if (counselingType === "biblical") {
      // 🕊️ 성경적 상담 분석
      analysis = generateBiblicalSctAnalysis(cat, allText);
      recommendations = generateBiblicalSctRecommendations(cat, allText);
    } else {
      // 🧠 심리상담 분석 (기존 로직)
      analysis = generatePsychologicalSctAnalysis(cat, allText);
      recommendations = generatePsychologicalSctRecommendations(allText);
    }
    
    const finalSummary = analysis + (recommendations.length > 0 ? "\n\n[권장사항]\n" + recommendations.join("\n") : "");
    
    setTimeout(() => {
      setSctSummaries(p => ({ ...p, [cat]: finalSummary }));
      setLoadingSummary(p => ({ ...p, [cat]: false }));
    }, 800);
  }

  // 🧠 심리상담 SCT 분석
  function generatePsychologicalSctAnalysis(cat, allText) {
    let analysis = "";
    
    if (cat.includes("어머니")) {
      if (allText.includes("좋") || allText.includes("사랑") || allText.includes("따뜻")) {
        analysis = "어머니와의 관계가 긍정적으로 형성되어 있습니다. 애착 관계가 안정적이며, 이는 대인관계 형성의 긍정적 기반이 됩니다.";
      } else if (allText.includes("힘들") || allText.includes("어렵") || allText.includes("갈등")) {
        analysis = "어머니와의 관계에서 일부 어려움이 관찰됩니다. 이는 정서적 지지 체계 강화가 필요함을 시사합니다. 상담을 통한 관계 개선이 도움이 될 수 있습니다.";
      } else {
        analysis = "어머니와의 관계에 대한 복합적인 감정이 나타납니다. 애착 패턴을 탐색하고 긍정적 측면을 강화하는 것이 도움이 될 수 있습니다.";
      }
    } else if (cat.includes("아버지")) {
      if (allText.includes("존경") || allText.includes("좋") || allText.includes("따뜻")) {
        analysis = "아버지와의 관계가 긍정적입니다. 권위 인물에 대한 건강한 태도가 형성되어 있으며, 이는 사회적응에 긍정적 영향을 줍니다.";
      } else if (allText.includes("무섭") || allText.includes("엄격") || allText.includes("거리")) {
        analysis = "아버지와의 관계에서 심리적 거리감이 느껴집니다. 권위에 대한 양가감정이 있을 수 있으며, 이는 상담을 통해 탐색할 필요가 있습니다.";
      } else {
        analysis = "아버지 상에 대한 다층적인 인식이 나타납니다. 권위 관계에 대한 이해를 심화하는 것이 성장에 도움이 될 수 있습니다.";
      }
    } else if (cat.includes("가족")) {
      if (allText.includes("화목") || allText.includes("행복") || allText.includes("사랑")) {
        analysis = "가족 관계가 전반적으로 긍정적입니다. 안정적인 가족 기반은 심리적 안녕감의 중요한 자원입니다.";
      } else if (allText.includes("갈등") || allText.includes("힘들") || allText.includes("불화")) {
        analysis = "가족 내 역동에 어려움이 있는 것으로 보입니다. 가족 상담이나 의사소통 개선이 도움이 될 수 있습니다.";
      } else {
        analysis = "가족 관계에 대한 복합적 인식이 나타납니다. 가족 내 자신의 역할과 위치를 재정립하는 것이 도움이 될 수 있습니다.";
      }
    } else if (cat.includes("두려움")) {
      if (allText.includes("없") || allText.includes("괜찮")) {
        analysis = "불안 수준이 낮고 심리적 안정감이 양호합니다. 현재의 대처 방식을 유지하는 것이 좋습니다.";
      } else if (allText.includes("실패") || allText.includes("거절") || allText.includes("혼자")) {
        analysis = "특정 영역에 대한 불안감이 관찰됩니다. 이는 자존감과 연결될 수 있으며, 인지행동치료적 접근이 도움이 될 수 있습니다.";
      } else {
        analysis = "다양한 두려움 요인이 나타납니다. 불안 관리 기법을 학습하고 대처 자원을 강화하는 것이 권장됩니다.";
      }
    } else if (cat.includes("죄책감")) {
      if (allText.includes("없") || allText.includes("후회")) {
        analysis = "죄책감이 적절한 수준으로 관리되고 있습니다. 자기 성찰 능력이 있으나 과도하지 않습니다.";
      } else if (allText.includes("많") || allText.includes("미안") || allText.includes("잘못")) {
        analysis = "죄책감 수준이 다소 높게 나타납니다. 자기 비난 패턴을 탐색하고 자기 용서를 연습하는 것이 도움이 될 수 있습니다.";
      } else {
        analysis = "죄책감에 대한 복합적 인식이 나타납니다. 과거 경험을 재해석하고 수용하는 과정이 필요할 수 있습니다.";
      }
    } else if (cat.includes("능력")) {
      if (allText.includes("잘") || allText.includes("자신") || allText.includes("능력")) {
        analysis = "자기 효능감이 양호합니다. 자신의 능력에 대한 긍정적 인식은 목표 달성의 중요한 자원입니다.";
      } else if (allText.includes("부족") || allText.includes("못") || allText.includes("없")) {
        analysis = "자기 효능감이 다소 낮게 나타납니다. 작은 성공 경험을 축적하고 강점을 재발견하는 것이 도움이 될 수 있습니다.";
      } else {
        analysis = "자기 능력에 대한 현실적 평가가 나타납니다. 강점을 더욱 발전시키고 약점을 보완하는 균형적 접근이 권장됩니다.";
      }
    } else if (cat.includes("미래")) {
      if (allText.includes("밝") || allText.includes("희망") || allText.includes("기대")) {
        analysis = "미래에 대한 낙관적 태도가 나타납니다. 긍정적 미래 전망은 현재의 동기와 에너지를 높입니다.";
      } else if (allText.includes("불안") || allText.includes("걱정") || allText.includes("어두")) {
        analysis = "미래에 대한 불안감이 관찰됩니다. 구체적 목표 설정과 단계적 계획이 불안을 감소시킬 수 있습니다.";
      } else {
        analysis = "미래에 대한 현실적 태도가 나타납니다. 희망과 준비를 균형있게 유지하는 것이 중요합니다.";
      }
    } else if (cat.includes("목표")) {
      if (allText.includes("명확") || allText.includes("계획") || allText.includes("꿈")) {
        analysis = "목표가 명확하고 동기 수준이 양호합니다. 구체적 실행 계획을 수립하면 목표 달성 가능성이 높습니다.";
      } else if (allText.includes("모르") || allText.includes("없") || allText.includes("막연")) {
        analysis = "목표가 불명확한 상태입니다. 자기 탐색을 통해 가치관과 방향성을 명료화하는 것이 필요합니다.";
      } else {
        analysis = "목표에 대한 탐색 과정에 있습니다. 다양한 가능성을 열어두고 점진적으로 방향을 설정하는 것이 도움이 됩니다.";
      }
    } else {
      analysis = "이 영역에 대한 응답을 종합적으로 분석한 결과, 개인의 고유한 경험과 인식이 반영되어 있습니다. 상담을 통해 더 깊이 탐색할 수 있습니다.";
    }
    
    return analysis;
  }
  
  // 🧠 심리상담 SCT 권장사항
  function generatePsychologicalSctRecommendations(allText) {
    const recommendations = [];
    if (allText.includes("힘들") || allText.includes("어렵") || allText.includes("갈등")) {
      recommendations.push("• 정기적인 심리 상담을 통한 감정 표현 및 해소");
      recommendations.push("• 인지행동치료(CBT) 기법을 통한 사고 패턴 개선");
    }
    if (allText.includes("불안") || allText.includes("걱정") || allText.includes("두렵")) {
      recommendations.push("• 이완 훈련 및 마음챙김 명상 실천");
      recommendations.push("• 불안 관리 기법 학습 (복식호흡, 점진적 근육 이완)");
    }
    if (allText.includes("없") || allText.includes("모르")) {
      recommendations.push("• 자기 탐색 활동 및 가치관 명료화 작업");
      recommendations.push("• 진로 상담 및 심리검사를 통한 자기 이해");
    }
    if (allText.includes("우울") || allText.includes("슬프") || allText.includes("의욕")) {
      recommendations.push("• 우울감 관리를 위한 행동 활성화 전략");
      recommendations.push("• 규칙적인 운동과 충분한 수면");
    }
    return recommendations;
  }
  
  // 🕊️ 성경적 상담 SCT 분석
  function generateBiblicalSctAnalysis(cat, allText) {
    let analysis = "";
    
    if (cat.includes("어머니")) {
      if (allText.includes("좋") || allText.includes("사랑") || allText.includes("따뜻")) {
        analysis = "어머니와의 관계에서 하나님의 사랑과 돌보심이 반영되어 있습니다. '어머니가 자식을 위로함같이 내가 너희를 위로하리니'(이사야 66:13)라는 말씀처럼, 건강한 어머니상은 하나님의 사랑을 경험하는 통로가 됩니다.";
      } else if (allText.includes("힘들") || allText.includes("어렵") || allText.includes("갈등")) {
        analysis = "어머니와의 관계에서 어려움이 있지만, 하나님께서는 '고아의 아버지'(시편 68:5)이시며 모든 관계의 상처를 치유하실 수 있습니다. 용서와 화해의 과정을 통해 하나님의 회복을 경험할 수 있습니다.";
      } else {
        analysis = "어머니와의 관계에 대한 복합적인 감정이 나타납니다. 이는 모든 인간 관계의 불완전함을 보여주며, 완전한 사랑은 오직 하나님 안에서만 발견됩니다(요한일서 4:19).";
      }
    } else if (cat.includes("아버지")) {
      if (allText.includes("존경") || allText.includes("좋") || allText.includes("따뜻")) {
        analysis = "아버지와의 긍정적 관계는 하늘 아버지를 이해하는 데 도움이 됩니다. '아버지께서 자식을 긍휼히 여기심같이 여호와께서는 자기를 경외하는 자를 긍휼히 여기시나니'(시편 103:13).";
      } else if (allText.includes("무섭") || allText.includes("엄격") || allText.includes("거리")) {
        analysis = "아버지와의 관계에서 두려움이나 거리감이 느껴지지만, 하나님 아버지는 '사랑의 아버지시오 모든 위로의 하나님이시며'(고린도후서 1:3) 우리를 완전히 받아주십니다. 땅의 아버지의 불완전함이 하늘 아버지의 완전한 사랑을 가리지 않도록 기도가 필요합니다.";
      } else {
        analysis = "아버지 상에 대한 다층적인 인식이 나타납니다. 하나님은 완전한 아버지이시며, 땅의 아버지와의 관계를 통해 하나님의 아버지 되심을 더 깊이 이해할 수 있습니다.";
      }
    } else if (cat.includes("가족")) {
      if (allText.includes("화목") || allText.includes("행복") || allText.includes("사랑")) {
        analysis = "가족 관계가 전반적으로 긍정적입니다. '보라 형제가 연합하여 동거함이 어찌 그리 선하고 아름다운고'(시편 133:1). 감사함으로 이 축복을 지키고 더욱 발전시켜 나가세요.";
      } else if (allText.includes("갈등") || allText.includes("힘들") || allText.includes("불화")) {
        analysis = "가족 내 어려움이 있지만, '그리스도의 평강이 너희 마음을 주장하게 하라'(골로새서 3:15). 용서와 화해는 성경적 가족 회복의 핵심입니다. 먼저 자신의 죄를 인정하고 용서를 구하는 것부터 시작하세요.";
      } else {
        analysis = "가족 관계에 대한 복합적 인식이 나타납니다. 가족은 하나님이 세우신 첫 번째 공동체이며, '서로 사랑하라'(요한복음 13:34)는 명령이 가장 먼저 실천되어야 할 곳입니다.";
      }
    } else if (cat.includes("두려움")) {
      if (allText.includes("없") || allText.includes("괜찮")) {
        analysis = "두려움이 적은 것은 하나님을 신뢰하는 믿음의 표현일 수 있습니다. '두려워하지 말라 내가 너와 함께함이라'(이사야 41:10)는 약속을 계속 붙들으세요.";
      } else if (allText.includes("실패") || allText.includes("거절") || allText.includes("혼자")) {
        analysis = "두려움이 관찰되지만, 성경은 '두려워 말라'를 365번 말씀합니다. 하나님은 '너를 버리지 아니하고 너를 떠나지 아니하시리라'(히브리서 13:5)고 약속하십니다. 두려움은 하나님께 맡기고 말씀 안에서 평안을 찾으세요.";
      } else {
        analysis = "다양한 두려움이 나타납니다. '완전한 사랑이 두려움을 내쫓나니'(요한일서 4:18). 하나님의 사랑을 더 깊이 경험할수록 두려움은 줄어듭니다.";
      }
    } else if (cat.includes("죄책감")) {
      if (allText.includes("없") || allText.includes("후회")) {
        analysis = "적절한 죄책감은 회개로 이끄는 건강한 양심의 표현입니다. '우리가 우리 죄를 자백하면 그는 미쁘시고 의로우사 우리 죄를 사하시며'(요한일서 1:9).";
      } else if (allText.includes("많") || allText.includes("미안") || allText.includes("잘못")) {
        analysis = "과도한 죄책감이 나타납니다. 그리스도 안에서 '정죄함이 없나니'(로마서 8:1). 이미 용서받았다면 계속 죄책감에 매여 있는 것은 사탄의 전략입니다. 하나님의 완전한 용서를 믿고 받아들이세요.";
      } else {
        analysis = "죄책감에 대한 복합적 인식이 나타납니다. 성경적으로 죄는 인정하되, 그리스도의 십자가를 통해 이미 용서받았음을 기억하세요(에베소서 1:7).";
      }
    } else if (cat.includes("능력")) {
      if (allText.includes("잘") || allText.includes("자신") || allText.includes("능력")) {
        analysis = "자신의 능력을 긍정적으로 인식하고 있습니다. 이는 하나님이 주신 은사를 잘 활용하는 것입니다. '내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라'(빌립보서 4:13).";
      } else if (allText.includes("부족") || allText.includes("못") || allText.includes("없")) {
        analysis = "자신의 부족함을 인식하는 것은 겸손의 시작입니다. '내 은혜가 네게 족하도다 이는 내 능력이 약한 데서 온전하여짐이라'(고린도후서 12:9). 하나님은 약한 자를 통해 일하십니다.";
      } else {
        analysis = "자기 능력에 대한 현실적 평가가 나타납니다. 성경은 '자기를 낮추는 자는 높아지고'(마태복음 23:12)라고 말씀합니다. 겸손과 자신감의 균형을 유지하세요.";
      }
    } else if (cat.includes("미래")) {
      if (allText.includes("밝") || allText.includes("희망") || allText.includes("기대")) {
        analysis = "미래에 대한 희망적 태도가 나타납니다. '너희를 향한 나의 생각을 아나니 평안이요 재앙이 아니니라 너희에게 미래와 희망을 주는 것이니라'(예레미야 29:11).";
      } else if (allText.includes("불안") || allText.includes("걱정") || allText.includes("어두")) {
        analysis = "미래에 대한 불안이 관찰됩니다. '내일 일을 위하여 염려하지 말라... 한 날의 괴로움은 그 날로 족하니라'(마태복음 6:34). 하나님이 인도하시는 미래를 신뢰하세요.";
      } else {
        analysis = "미래에 대한 현실적 태도가 나타납니다. '사람이 마음으로 자기의 길을 계획할지라도 그의 걸음을 인도하시는 이는 여호와시니라'(잠언 16:9).";
      }
    } else if (cat.includes("목표")) {
      if (allText.includes("명확") || allText.includes("계획") || allText.includes("꿈")) {
        analysis = "목표가 명확한 것은 좋은 청지기의 모습입니다. '네가 하는 일을 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라'(잠언 16:3). 하나님의 뜻 안에서 목표를 추구하세요.";
      } else if (allText.includes("모르") || allText.includes("없") || allText.includes("막연")) {
        analysis = "목표가 불명확한 상태입니다. '너희는 먼저 그의 나라와 그의 의를 구하라 그리하면 이 모든 것을 너희에게 더하시리라'(마태복음 6:33). 하나님의 뜻을 구하는 기도부터 시작하세요.";
      } else {
        analysis = "목표에 대한 탐색 과정에 있습니다. '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라'(잠언 3:5-6).";
      }
    } else {
      analysis = "이 영역에 대한 응답을 종합적으로 분석한 결과, 하나님의 형상으로 지음 받은 개인의 고유한 경험과 인식이 반영되어 있습니다. 성경적 상담을 통해 더 깊이 탐색하고 하나님의 뜻을 발견할 수 있습니다.";
    }
    
    return analysis;
  }
  
  // 🕊️ 성경적 상담 SCT 권장사항
  function generateBiblicalSctRecommendations(cat, allText) {
    const recommendations = [];
    
    if (allText.includes("힘들") || allText.includes("어렵") || allText.includes("갈등")) {
      recommendations.push("• 매일 성경 읽기와 기도로 하나님과의 관계 깊이하기");
      recommendations.push("• 성경적 상담을 통해 관계 회복과 용서의 과정 경험하기");
      recommendations.push("• 소그룹이나 셀 모임에서 영적 지지 받기");
    }
    
    if (allText.includes("불안") || allText.includes("걱정") || allText.includes("두렵")) {
      recommendations.push("• 시편 말씀 묵상과 암송 (시편 23, 27, 46편 등)");
      recommendations.push("• 염려를 기도로 전환하기 (빌립보서 4:6-7)");
      recommendations.push("• 찬양과 경배를 통한 영적 평안 경험");
    }
    
    if (allText.includes("없") || allText.includes("모르")) {
      recommendations.push("• 하나님의 뜻을 구하는 기도 생활 (야고보서 1:5)");
      recommendations.push("• 성경적 비전 발견을 위한 금식기도");
      recommendations.push("• 영적 멘토나 목회자와의 정기적 만남");
    }
    
    if (allText.includes("죄책") || allText.includes("잘못") || allText.includes("미안")) {
      recommendations.push("• 십자가 복음 묵상과 용서의 확신 갖기");
      recommendations.push("• 필요시 화해와 용서를 구하는 실천");
      recommendations.push("• '그리스도 안에서의 새로운 피조물' 정체성 확립 (고린도후서 5:17)");
    }
    
    if (allText.includes("우울") || allText.includes("슬프") || allText.includes("의욕")) {
      recommendations.push("• 시편 기도로 하나님께 감정 토로하기");
      recommendations.push("• 성도들과의 교제를 통한 영적 회복");
      recommendations.push("• 감사 일기 쓰기 (데살로니가전서 5:18)");
    }
    
    // 모든 경우에 공통 권장사항
    recommendations.push("• 정기적인 교회 출석과 말씀 사역 참여");
    recommendations.push("• 성경 통독 및 QT(Quiet Time) 습관화");
    
    return recommendations;
  }

  // ✅ DSI AI 권장사항 생성 (상담 유형별 분기)
  function generateDsiRecommendation() {
    setLoadingRec(true);
    setDsiRec("");
    
    // 상담 유형 확인 (기본값: 심리상담)
    const counselingType = activeLinkData?.counselingType || "psychological";
    
    const { total, areas } = calcDsi();
    
    let finalRec = "";
    if (counselingType === "biblical") {
      // 🕊️ 성경적 상담 분석
      finalRec = generateBiblicalDsiAnalysis(total, areas);
    } else {
      // 🧠 심리상담 분석
      finalRec = generatePsychologicalDsiAnalysis(total, areas);
    }
    
    setTimeout(() => {
      setDsiRec(finalRec);
      setLoadingRec(false);
    }, 1000);
  }
  
  // 🧠 심리상담 DSI 분석
  function generatePsychologicalDsiAnalysis(total, areas) {
    const level = total >= 120 ? "높음(양호)" : total >= 80 ? "중간(보통)" : "낮음(취약)";
    
    // 영역별 분석
    const areaAnalysis = [];
    const weakAreas = [];
    const strongAreas = [];
    
    Object.entries(areas).forEach(([area, score]) => {
      const maxScore = 36;
      const percentage = (score / maxScore) * 100;
      
      if (percentage >= 70) {
        strongAreas.push(area);
      } else if (percentage < 50) {
        weakAreas.push(area);
      }
      
      let areaComment = "";
      if (area === "인지적 기능") {
        if (percentage >= 70) {
          areaComment = "감정 조절과 의사결정 능력이 우수합니다. 충동성이 낮고 논리적 사고가 가능합니다.";
        } else if (percentage < 50) {
          areaComment = "충동성 조절에 어려움이 있을 수 있습니다. 감정과 사고를 분리하는 연습이 필요합니다.";
        } else {
          areaComment = "감정 조절 능력이 보통 수준입니다. 스트레스 관리 기법을 익히면 도움이 됩니다.";
        }
      } else if (area === "자아통합") {
        if (percentage >= 70) {
          areaComment = "자기 정체성이 명확하고 가치관이 일관됩니다. 자율성이 높습니다.";
        } else if (percentage < 50) {
          areaComment = "타인의 영향을 많이 받는 편입니다. 자기 가치관을 명료화하는 작업이 필요합니다.";
        } else {
          areaComment = "자아 정체성 형성 과정에 있습니다. 자기 탐색을 통해 더 강화할 수 있습니다.";
        }
      } else if (area === "가족투사") {
        if (percentage >= 70) {
          areaComment = "가족 문제로부터 건강하게 분리되어 있습니다. 객관적 시각을 유지합니다.";
        } else if (percentage < 50) {
          areaComment = "가족 문제가 현재 삶에 영향을 주고 있습니다. 가족 상담이 도움이 될 수 있습니다.";
        } else {
          areaComment = "가족 영향을 인식하고 있습니다. 건강한 경계 설정이 필요합니다.";
        }
      } else if (area === "정서적 단절") {
        if (percentage >= 70) {
          areaComment = "가족과 적절한 거리를 유지합니다. 독립성과 친밀감의 균형이 좋습니다.";
        } else if (percentage < 50) {
          areaComment = "가족으로부터 과도하게 단절되어 있을 수 있습니다. 연결감 회복이 필요합니다.";
        } else {
          areaComment = "가족과의 거리감이 적절합니다. 현재 수준을 유지하는 것이 좋습니다.";
        }
      } else if (area === "가족퇴행") {
        if (percentage >= 70) {
          areaComment = "가족 스트레스 상황에서도 성숙하게 대응합니다. 퇴행 경향이 낮습니다.";
        } else if (percentage < 50) {
          areaComment = "가족 상황에서 스트레스를 많이 받습니다. 감정 조절 기법이 필요합니다.";
        } else {
          areaComment = "가족 상황 대처가 보통입니다. 스트레스 관리를 강화하면 좋습니다.";
        }
      }
      
      areaAnalysis.push(`${area} (${score}/${maxScore}점, ${percentage.toFixed(0)}%):\n${areaComment}`);
    });
    
    // 종합 분석
    let overallAnalysis = `전반적인 자아분화 수준이 ${level}입니다. `;
    if (total >= 120) {
      overallAnalysis += "자기 자신에 대한 이해가 깊고, 타인과의 관계에서 건강한 경계를 유지할 수 있습니다. 정서적으로 안정적이며 독립적인 의사결정이 가능합니다.";
    } else if (total >= 80) {
      overallAnalysis += "기본적인 자아분화가 이루어져 있으나, 일부 영역에서 개선의 여지가 있습니다. 지속적인 자기 성찰과 성장이 도움이 됩니다.";
    } else {
      overallAnalysis += "자아분화 수준이 다소 낮은 편입니다. 가족이나 타인의 영향을 많이 받을 수 있으며, 전문적인 상담을 통한 지원이 권장됩니다.";
    }
    
    // 권장사항
    const recommendations = [];
    
    if (weakAreas.length > 0) {
      recommendations.push(`[취약 영역 개선]\n취약한 영역: ${weakAreas.join(", ")}\n• 해당 영역에 초점을 맞춘 상담 진행\n• 자기 인식 강화 활동 (일기 쓰기, 자기 성찰)\n• 가족과의 건강한 경계 설정 연습`);
    }
    
    if (total < 120) {
      recommendations.push("[상담 접근법]\n• Bowen 가족치료 기법 활용\n• 자아분화 향상 프로그램 참여\n• 정서 조절 기술 훈련\n• 가족 관계 재구조화 작업");
    }
    
    if (strongAreas.length > 0) {
      recommendations.push(`[강점 활용]\n강점 영역: ${strongAreas.join(", ")}\n• 강점을 활용한 대처 전략 강화\n• 긍정적 경험 확대 적용`);
    }
    
    recommendations.push("[단기 목표 (1-3개월)]\n• 주 1회 정기 상담 참여\n• 감정 일지 작성 (일일)\n• 이완 훈련 실천 (주 3회)");
    
    recommendations.push("[장기 목표 (6-12개월)]\n• 자아분화 수준 20% 향상\n• 가족과의 건강한 관계 재정립\n• 스트레스 상황에서의 대처 능력 강화");
    
    return `${overallAnalysis}\n\n[영역별 상세 분석]\n${areaAnalysis.join("\n\n")}\n\n${recommendations.join("\n\n")}\n\n[주의사항]\n본 권장사항은 자동 분석 결과이며, 전문 상담사의 해석과 병행되어야 합니다. 개인의 고유한 맥락을 고려한 맞춤형 상담이 중요합니다.`;
  }
  
  // 🕊️ 성경적 상담 DSI 분석
  function generateBiblicalDsiAnalysis(total, areas) {
    const level = total >= 120 ? "높음(양호)" : total >= 80 ? "중간(보통)" : "낮음(취약)";
    
    // 영역별 분석
    const areaAnalysis = [];
    const weakAreas = [];
    const strongAreas = [];
    
    Object.entries(areas).forEach(([area, score]) => {
      const maxScore = 36;
      const percentage = (score / maxScore) * 100;
      
      if (percentage >= 70) {
        strongAreas.push(area);
      } else if (percentage < 50) {
        weakAreas.push(area);
      }
      
      let areaComment = "";
      if (area === "인지적 기능") {
        if (percentage >= 70) {
          areaComment = "감정을 잘 조절하고 논리적으로 사고합니다. '너희는 이 세대를 본받지 말고 오직 마음을 새롭게 함으로 변화를 받아 하나님의 선하시고 기뻐하시고 온전하신 뜻이 무엇인지 분별하도록 하라'(로마서 12:2). 하나님이 주신 이성의 선물을 잘 사용하고 있습니다.";
        } else if (percentage < 50) {
          areaComment = "충동적인 반응이 나타날 수 있습니다. '사람의 성내는 것이 하나님의 의를 이루지 못함이라'(야고보서 1:20). 감정에 휘둘리기 전에 기도하며 하나님의 지혜를 구하세요.";
        } else {
          areaComment = "감정 조절 능력이 보통입니다. '너희 안에 이 마음을 품으라 곧 그리스도 예수의 마음이니'(빌립보서 2:5). 그리스도의 마음을 품고 성령의 열매를 구하세요.";
        }
      } else if (area === "자아통합") {
        if (percentage >= 70) {
          areaComment = "자기 정체성이 명확합니다. '그리스도 안에서 새로운 피조물'(고린도후서 5:17)로서의 정체성을 잘 확립하고 있습니다. 하나님의 자녀로서 확신 있게 살아가고 있습니다.";
        } else if (percentage < 50) {
          areaComment = "타인의 영향을 많이 받습니다. '사람을 기쁘게 하는 자가 되려 하였더라면 그리스도의 종이 아니니라'(갈라디아서 1:10). 하나님 안에서 자신의 정체성을 찾고, 하나님만을 기쁘시게 하는 삶을 추구하세요.";
        } else {
          areaComment = "자아 정체성 형성 중입니다. '너희 믿음을 시험하여 너희가 믿음 안에 있는가 너희 자신을 확증하라'(고린도후서 13:5). 그리스도 안에서 자신이 누구인지 확인하는 시간을 가지세요.";
        }
      } else if (area === "가족투사") {
        if (percentage >= 70) {
          areaComment = "가족 문제로부터 건강하게 분리되어 있습니다. '그러므로 사람이 부모를 떠나 그의 아내와 합하여 둘이 한 몸을 이룰지로다'(창세기 2:24). 성경적 독립과 분리를 이루었습니다.";
        } else if (percentage < 50) {
          areaComment = "가족 문제가 현재 삶에 영향을 줍니다. '또 다른 사람들도 건지고자 하여 두려움으로 붙들어 끌어내며'(유다서 1:23). 가족을 사랑하되, 가족의 문제가 당신의 정체성을 정의하지 않도록 기도하세요. 용서와 경계 설정이 필요합니다.";
        } else {
          areaComment = "가족 영향을 인식하고 있습니다. '내 멍에는 쉽고 내 짐은 가벼우니라'(마태복음 11:30). 가족의 짐을 주님께 맡기고 건강한 경계를 세우세요.";
        }
      } else if (area === "정서적 단절") {
        if (percentage >= 70) {
          areaComment = "가족과 적절한 거리를 유지합니다. '각 사람은 자기 자신의 행위를 살피라 그리하면 자랑할 것이 자기에게만 있고 남에게는 있지 아니하리니'(갈라디아서 6:4). 독립성과 친밀감의 균형이 좋습니다.";
        } else if (percentage < 50) {
          areaComment = "가족으로부터 과도하게 단절되어 있을 수 있습니다. '네 부모를 공경하라'(출애굽기 20:12)는 명령을 기억하세요. 상처가 있더라도 용서하고 화해를 추구하세요.";
        } else {
          areaComment = "가족과의 거리가 적절합니다. '모든 사람과 더불어 화평함과 거룩함을 따르라'(히브리서 12:14). 관계를 유지하며 성장하세요.";
        }
      } else if (area === "가족퇴행") {
        if (percentage >= 70) {
          areaComment = "가족 스트레스에도 성숙하게 대응합니다. '내가 어렸을 때에는 말하는 것이 어린 아이와 같고... 장성한 사람이 되어서는 어린 아이의 일을 버렸노라'(고린도전서 13:11). 영적 성숙함이 나타납니다.";
        } else if (percentage < 50) {
          areaComment = "가족 상황에서 스트레스를 많이 받습니다. '너희 염려를 다 주께 맡기라 이는 그가 너희를 돌보심이라'(베드로전서 5:7). 가족 문제를 하나님께 맡기고 평안을 찾으세요.";
        } else {
          areaComment = "가족 상황 대처가 보통입니다. '주 안에서 항상 기뻐하라'(빌립보서 4:4). 어려운 상황에서도 주님을 바라보세요.";
        }
      }
      
      areaAnalysis.push(`${area} (${score}/${maxScore}점, ${percentage.toFixed(0)}%):\n${areaComment}`);
    });
    
    // 종합 분석
    let overallAnalysis = `전반적인 자아분화 수준이 ${level}입니다. `;
    if (total >= 120) {
      overallAnalysis += "하나님께서 주신 건강한 자아가 잘 형성되어 있습니다. '그리스도 안에서 자유롭게 하는 것'(갈라디아서 5:1)을 경험하고 있으며, 타인과의 관계에서도 그리스도의 사랑으로 균형을 유지합니다. 이 은혜를 감사히 여기며 다른 이들을 세우는 데 사용하세요.";
    } else if (total >= 80) {
      overallAnalysis += "기본적인 자아분화가 이루어져 있습니다. '선을 행하되 낙심하지 말지니 포기하지 아니하면 때가 이르매 거두리라'(갈라디아서 6:9). 더 깊은 영적 성숙을 향해 나아가세요.";
    } else {
      overallAnalysis += "자아분화 수준이 낮은 편입니다. 그러나 하나님은 '연약한 자들을 강하게 하시는'(고린도후서 12:9) 분이십니다. 주님의 능력이 약한 데서 온전하여집니다. 겸손히 도움을 구하고 성경적 상담을 받으세요.";
    }
    
    // 성경적 권장사항
    const recommendations = [];
    
    if (weakAreas.length > 0) {
      recommendations.push(`[취약 영역의 영적 치유]\n취약한 영역: ${weakAreas.join(", ")}\n• 해당 영역에 대한 성경 말씀 묵상과 암송\n• 성경적 상담을 통한 하나님의 관점 회복\n• 기도와 금식으로 영적 돌파 경험\n• 소그룹에서 중보기도 받기`);
    }
    
    if (total < 120) {
      recommendations.push("[영적 성장 전략]\n• 매일 성경 읽기와 QT로 하나님과의 관계 깊이하기\n• 십자가 복음 묵상 - 정체성의 근원 확인\n• 용서와 화해의 실천 (가족 관계 회복)\n• 성령 충만과 성령의 열매 구하기");
    }
    
    if (strongAreas.length > 0) {
      recommendations.push(`[강점을 통한 섬김]\n강점 영역: ${strongAreas.join(", ")}\n• 이 은사를 교회와 이웃 섬김에 사용하기\n• 약한 자들을 돌보고 격려하기\n• 하나님께 감사와 찬양 드리기`);
    }
    
    recommendations.push("[단기 영적 목표 (1-3개월)]\n• 주 1회 성경적 상담 참여\n• 매일 성경 묵상과 기도 일기 작성\n• 주일 예배 및 소그룹 모임 참석\n• 가족을 위한 중보기도");
    
    recommendations.push("[장기 영적 목표 (6-12개월)]\n• 그리스도 안에서의 정체성 확립\n• 가족과의 성경적 관계 회복\n• 영적 성숙을 통한 자아분화 향상\n• 섬김과 사역을 통한 은사 개발");
    
    recommendations.push("[추천 성경 구절 묵상]\n• 정체성: 고린도후서 5:17, 갈라디아서 2:20\n• 가족 관계: 에베소서 6:1-4, 골로새서 3:18-21\n• 감정 조절: 잠언 16:32, 야고보서 1:19-20\n• 자유와 성숙: 갈라디아서 5:1, 고린도전서 13:11");
    
    return `${overallAnalysis}\n\n[영역별 상세 분석]\n${areaAnalysis.join("\n\n")}\n\n${recommendations.join("\n\n")}\n\n[성경적 상담의 원칙]\n본 권장사항은 성경 말씀에 기초한 분석이며, 숙련된 성경적 상담사와 함께 더 깊이 탐색하시기를 권장합니다. '모든 성경은 하나님의 감동으로 된 것으로 교훈과 책망과 바르게 함과 의로 교육하기에 유익하니'(디모데후서 3:16). 하나님의 말씀이 당신을 인도하고 치유하시기를 기도합니다.`;
  }

  function logout() {
    // ✅ 로그인 상태 제거
    clearLoginState();
    
    setIsAdmin(false);
    setIsCounselor(false);
    setCounselorPhone("");
    setUserInfo({ phone: "", password: "" });
    setLoginMsg({ type: "", text: "" });
    setSctResponses({});
    setSctSummaries({});
    setDsiResponses({});
    setDsiRec("");
    setActiveLinkId(null);
    setActiveLinkData(null);
    setGeneratedLinks([]);
    setSubmitted([]);
    setLinkInput("");
    setView("login");
    
    console.log('👋 로그아웃 완료');
  }

  const Msg = ({ msg }) => !msg.text ? null : (
    <div className={`mb-4 p-3 rounded-lg border-2 text-sm font-semibold ${msg.type === "success" ? "bg-green-50 border-green-400 text-green-800" : msg.type === "error" ? "bg-red-50 border-red-400 text-red-800" : "bg-blue-50 border-blue-400 text-blue-800"}`}>
      {msg.text}
    </div>
  );

  function getCounselorSessions() {
    return submitted.filter(s => {
      if (!s.linkId) return false;
      const linkData = loadLink(s.linkId);
      return linkData && linkData.counselorPhone === counselorPhone;
    });
  }

  // ========== VIEWS ==========

  if (view === "login") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🧠</div>
          <h1 className="text-3xl font-bold text-gray-800">심리검사 시스템</h1>
          <p className="text-gray-400 text-sm mt-1">상담사에게 받은 링크 ID로 검사를 시작하세요</p>
        </div>
        <Msg msg={loginMsg} />
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-5 mb-5">
          <p className="text-sm font-bold text-indigo-700 mb-3">📋 검사 응시 (내담자)</p>
          <input
            className="w-full px-4 py-3 border-2 border-indigo-300 rounded-lg outline-none focus:border-indigo-500 text-sm mb-3 font-mono"
            placeholder="상담사에게 받은 링크 ID를 여기에 붙여넣으세요"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && enterByLinkId()}
          />
          <button onClick={enterByLinkId} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition text-base">
            검사 시작하기 →
          </button>
        </div>
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center"><span className="px-3 bg-white text-gray-400 text-xs">전문가 전용</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setLoginMsg({ type: "", text: "" }); setUserInfo({ phone: "", password: "" }); setView("adminLogin"); }} className="bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition text-sm">
            🔐 관리자
          </button>
          <button onClick={() => { setLoginMsg({ type: "", text: "" }); setUserInfo({ phone: "", password: "" }); setView("counselorLogin"); }} className="bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition text-sm">
            👨‍⚕️ 상담사
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "clientLogin") return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <button onClick={() => { setView("login"); setLoginMsg({ type: "", text: "" }); }} className="text-gray-400 hover:text-gray-600 text-sm mb-5 flex items-center gap-1">
          ← 뒤로
        </button>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{activeLinkData?.testType === "SCT" ? "📝" : "🔍"}</div>
          <h1 className="text-2xl font-bold text-gray-800">
            {activeLinkData?.testType === "SCT" ? "문장완성검사 (SCT)" : "자아분화검사 (DSI)"}
          </h1>
          <div className="mt-2 inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-semibold">
            내담자: {activeLinkData?.clientName}
          </div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-sm text-teal-700">
          ✅ 링크 확인 완료. 전화번호와 비밀번호를 입력해 검사를 시작하세요.
        </div>
        <Msg msg={loginMsg} />
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">전화번호</label>
            <input type="tel" value={userInfo.phone} onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={userInfo.password} onChange={e => setUserInfo({ ...userInfo, password: e.target.value })} placeholder="사용하실 비밀번호를 입력하세요" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 outline-none" onKeyDown={e => e.key === "Enter" && clientLogin()} />
            <p className="text-xs text-gray-400 mt-1">* 본인이 직접 설정하는 비밀번호입니다</p>
          </div>
          <button onClick={clientLogin} className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition text-lg">
            검사 시작 →
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "adminLogin") return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <button onClick={() => { setView("login"); setLoginMsg({ type: "", text: "" }); }} className="text-gray-400 hover:text-gray-600 text-sm mb-5 flex items-center gap-1">
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">🔐 관리자 로그인</h1>
        <Msg msg={loginMsg} />
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">아이디</label>
            <input type="text" value={userInfo.phone} onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })} placeholder="관리자 아이디" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={userInfo.password} onChange={e => setUserInfo({ ...userInfo, password: e.target.value })} placeholder="관리자 비밀번호" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg outline-none" onKeyDown={e => e.key === "Enter" && adminLogin()} />
          </div>
          <button onClick={adminLogin} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900">
            로그인
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "counselorLogin") return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <button onClick={() => { setView("login"); setLoginMsg({ type: "", text: "" }); }} className="text-gray-400 hover:text-gray-600 text-sm mb-5 flex items-center gap-1">
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">👨‍⚕️ 상담사 로그인</h1>
        <Msg msg={loginMsg} />
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">전화번호</label>
            <input type="tel" value={userInfo.phone} onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })} placeholder="010-1234-5678" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={userInfo.password} onChange={e => setUserInfo({ ...userInfo, password: e.target.value })} placeholder="비밀번호" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none" onKeyDown={e => e.key === "Enter" && counselorLogin()} />
          </div>
          <button onClick={counselorLogin} className="w-full bg-purple-700 text-white py-3 rounded-lg font-bold hover:bg-purple-800">
            로그인
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="px-3 bg-white text-gray-400 text-xs">또는</span></div>
          </div>
          <button onClick={() => { setFormMsg({ type: "", text: "" }); setView("counselorSignup"); }} className="w-full bg-purple-100 text-purple-800 py-3 rounded-lg font-semibold hover:bg-purple-200">
            상담사 가입 신청
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "counselorSignup") {
    const { ok: eduOk, kws: eduKws } = checkEdu(counselorForm.education);
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
          <button onClick={() => setView("counselorLogin")} className="text-gray-400 hover:text-gray-600 text-sm mb-5 flex items-center gap-1">
            ← 뒤로
          </button>
          <h1 className="text-2xl font-bold mb-1 text-center">상담사 가입 신청</h1>
          <p className="text-gray-400 text-sm text-center mb-5">관리자 승인 후 로그인 가능합니다</p>
          <Msg msg={formMsg} />
          <div className="space-y-4">
            {[["이름", "name", "text", "홍길동"], ["전화번호 *", "phone", "tel", "010-1234-5678"], ["비밀번호 *", "password", "password", "4자리 이상"], ["자격증", "certification", "text", "청소년상담사 2급 등"]].map(([l, k, t, p]) => (
              <div key={k}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{l}</label>
                <input type={t} value={counselorForm[k]} onChange={e => setCounselorForm({ ...counselorForm, [k]: e.target.value })} placeholder={p} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">최종학력 *</label>
              <input type="text" value={counselorForm.education} onChange={e => setCounselorForm({ ...counselorForm, education: e.target.value })} placeholder="OO대학교 상담심리학과 졸업" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none" />
              {counselorForm.education && (
                <div className={`mt-1 text-xs px-3 py-2 rounded border ${eduOk ? "bg-green-50 border-green-300 text-green-800" : "bg-yellow-50 border-yellow-300 text-yellow-800"}`}>
                  {eduOk ? `✅ 관련 학과: ${eduKws.join(", ")}` : "⚠️ 상담 관련 학과 미확인"}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">경력</label>
              <textarea value={counselorForm.experience} onChange={e => setCounselorForm({ ...counselorForm, experience: e.target.value })} placeholder="상담 경력, 근무 경험 등" rows={3} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={counselorSignup} className="flex-1 bg-purple-700 text-white py-3 rounded-lg font-bold hover:bg-purple-800">
                가입 신청
              </button>
              <button onClick={() => setView("counselorLogin")} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300">
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "counselorDashboard") {
    const counselorSessions = getCounselorSessions();
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">👨‍⚕️ 상담사 대시보드</h1>
              <p className="text-sm text-gray-400">{counselorPhone}</p>
            </div>
            <div className="flex gap-2">
              <label className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 cursor-pointer flex items-center gap-2">
                📂 불러오기
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleFileUpload} 
                  className="hidden"
                />
              </label>
              <button onClick={() => { loadAllSubmitted(); setView("counselorResults"); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 relative">
                📊 제출된 검사
                {counselorSessions.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {counselorSessions.length}
                  </span>
                )}
              </button>
              <button onClick={logout} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500">
                로그아웃
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">🔗 검사 링크 생성</h2>
            <Msg msg={formMsg} />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">내담자 이름</label>
                <input value={linkForm.clientName} onChange={e => setLinkForm({ ...linkForm, clientName: e.target.value })} placeholder="홍길동" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">내담자 전화번호</label>
                <input type="tel" value={linkForm.clientPhone} onChange={e => setLinkForm({ ...linkForm, clientPhone: e.target.value })} placeholder="010-1234-5678" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mb-4">
              {[["SCT", "📝 문장완성검사"], ["DSI", "🔍 자아분화검사"]].map(([v, l]) => (
                <button key={v} onClick={() => setLinkForm({ ...linkForm, testType: v })} className={`flex-1 py-3 rounded-xl font-semibold border-2 transition ${linkForm.testType === v ? "border-purple-500 bg-purple-50 text-purple-800" : "border-gray-200 text-gray-500 hover:border-purple-300"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">상담 유형</label>
              <div className="flex gap-3">
                {[["psychological", "🧠 심리상담"], ["biblical", "🕊️ 성경적 상담"]].map(([v, l]) => (
                  <button key={v} onClick={() => setLinkForm({ ...linkForm, counselingType: v })} className={`flex-1 py-3 rounded-xl font-semibold border-2 transition ${linkForm.counselingType === v ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {linkForm.counselingType === "biblical" 
                  ? "성경적 상담: 성경 말씀과 기독교 신앙을 기반으로 한 해석과 권장사항을 제공합니다." 
                  : "심리상담: 심리학 이론과 과학적 접근을 기반으로 한 해석과 권장사항을 제공합니다."}
              </p>
            </div>
            <button onClick={generateLink} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 transition">
              ✨ 검사 링크 생성
            </button>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">생성된 링크 ({generatedLinks.length}건)</h2>
            {generatedLinks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">🔗</div>
                <p>생성된 링크가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedLinks.map((link, i) => (
                  <div key={i} className={`border-2 rounded-xl p-4 transition ${link.status === "completed" ? "border-green-200 bg-green-50" : "border-gray-100 hover:border-purple-200"}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-gray-800 text-base">{link.clientName}</span>
                          <span className="text-gray-500 text-sm">{link.clientPhone}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${link.testType === "SCT" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                            {link.testType}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${link.status === "completed" ? "bg-green-200 text-green-800" : "bg-yellow-100 text-yellow-700"}`}>
                            {link.status === "completed" ? "✅ 완료" : "⏳ 대기중"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">생성: {new Date(link.createdAt).toLocaleString("ko-KR")}</p>
                        {showLinkId === link.linkId && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                            <p className="text-xs text-indigo-600 font-bold mb-2">📋 내담자에게 아래 ID를 전달하세요:</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white border border-indigo-300 rounded px-3 py-2 text-indigo-800 font-mono break-all select-all cursor-text">
                                {link.linkId}
                              </code>
                            </div>
                            <p className="text-xs text-indigo-400 mt-2">내담자는 메인 화면에서 이 ID를 입력 → 전화번호 확인 → 검사 시작</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => copyLink(link.linkId)} className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${copiedId === link.linkId ? "bg-green-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                          {copiedId === link.linkId ? "✅ 복사됨!" : "📋 링크 ID 복사"}
                        </button>
                        <button onClick={() => setShowLinkId(showLinkId === link.linkId ? null : link.linkId)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                          {showLinkId === link.linkId ? "🔼 닫기" : "🔍 ID 보기"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {counselorSessions.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">📊 최근 제출된 검사 ({counselorSessions.length}건)</h2>
                <button onClick={() => setView("counselorResults")} className="text-sm text-purple-600 font-semibold hover:text-purple-800">
                  전체 보기 →
                </button>
              </div>
              <div className="space-y-2">
                {counselorSessions.slice(0, 3).map((s, idx) => (
                  <div key={s.sessionId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm font-semibold">{idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.testType === "SCT" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                        {s.testType}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{s.userPhone}</p>
                        <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleString("ko-KR")}</p>
                      </div>
                    </div>
                    <button onClick={() => viewSession(s.sessionId)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">
                      결과 보기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
            <p className="font-bold mb-2">📌 내담자 검사 진행 방법</p>
            <ol className="space-y-1 list-decimal list-inside text-indigo-700 text-sm">
              <li>링크 생성 후 <strong>📋 링크 ID 복사</strong> 클릭</li>
              <li>복사된 ID를 문자/카카오톡으로 내담자에게 전달</li>
              <li>내담자가 메인 화면에서 ID 입력 → 전화번호 + 비밀번호 입력 → 검사 시작</li>
              <li>검사 완료 후 상태가 <strong>✅ 완료</strong>로 변경되며, 위에 제출된 검사로 표시됨</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (view === "counselorResults") {
    const counselorSessions = getCounselorSessions();
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">📊 제출된 검사 목록 ({counselorSessions.length}건)</h1>
            <div className="flex gap-2">
              <button onClick={() => loadAllSubmitted()} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600">
                🔄 새로고침
              </button>
              <button onClick={() => setView("counselorDashboard")} className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg text-sm font-semibold">
                ← 대시보드
              </button>
              <button onClick={logout} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm">
                로그아웃
              </button>
            </div>
          </div>
          <SessionList sessions={counselorSessions} onView={viewSession} />
        </div>
      </div>
    );
  }

  if (view === "sctTest") return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold text-center text-blue-800 mb-1">📝 문장완성검사 (SCT)</h1>
        <p className="text-center text-gray-400 text-sm mb-2">아래 문장을 자유롭게 완성해 주세요 (50문항)</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 mb-6 text-center">
          진행: <strong>{Object.values(sctResponses).filter(v => v?.trim()).length}</strong> / 50 문항
        </div>
        {saveStatus && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800 text-center">{saveStatus}</div>}
        <div className="space-y-4">
          {Object.keys(sctQ).map(n => (
            <div key={n} className="border-b border-gray-100 pb-4">
              <label className="block mb-1.5 font-semibold text-gray-700 text-sm">{n}. {sctQ[n]}</label>
              <input type="text" value={sctResponses[n] || ""} onChange={e => setSctResponses(p => ({ ...p, [n]: e.target.value }))} placeholder="답변을 입력하세요..." className={`w-full px-4 py-2.5 border-2 rounded-lg outline-none text-sm transition ${sctResponses[n]?.trim() ? "border-green-300 bg-green-50 focus:border-green-500" : "border-gray-200 focus:border-blue-400"}`} />
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button onClick={submitSct} className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold text-lg hover:bg-blue-700 transition">
            검사 제출 ({Object.values(sctResponses).filter(v => v?.trim()).length}/50)
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "dsiTest") return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold text-center text-green-800 mb-1">🔍 자아분화검사 (DSI)</h1>
        <p className="text-center text-gray-400 text-sm mb-2">각 문항에 해당하는 번호를 선택하세요 (36문항)</p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800">
          <div className="flex flex-wrap gap-3">
            {["1: 전혀 아니다", "2: 거의 아니다", "3: 어쩌다 그렇다", "4: 자주 그렇다", "5: 항상 그렇다"].map(t => <span key={t} className="font-semibold">{t}</span>)}
          </div>
        </div>
        {saveStatus && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800 text-center">{saveStatus}</div>}
        <div className="space-y-3">
          {dsiQ.map(q => (
            <div key={q.num} className={`border-2 rounded-xl p-4 transition ${dsiResponses[q.num] ? "border-green-300 bg-green-50" : "border-gray-100"}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded shrink-0 mt-0.5">{q.area}</span>
                <p className="text-sm font-semibold text-gray-700">{q.num}. {q.content}</p>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setDsiResponses(p => ({ ...p, [q.num]: s }))} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition ${dsiResponses[q.num] === s ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-300 text-gray-500 hover:border-green-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button onClick={submitDsi} disabled={Object.keys(dsiResponses).length < 36} className="bg-green-600 text-white px-10 py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition">
            검사 제출 ({Object.keys(dsiResponses).length}/36)
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "complete") return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">검사 완료!</h1>
        <p className="text-gray-500 mb-6">
          검사가 성공적으로 제출되었습니다.
          <br />
          상담사가 결과를 확인할 예정입니다.
        </p>
        <button onClick={logout} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition">
          처음으로 돌아가기
        </button>
      </div>
    </div>
  );

  if (view === "sctResult") {
    const counselingType = activeLinkData?.counselingType || "psychological";
    const counselingTypeLabel = counselingType === "biblical" ? "🕊️ 성경적 상담" : "🧠 심리상담";
    const counselingTypeColor = counselingType === "biblical" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-blue-50 border-blue-200 text-blue-700";
    
    return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-blue-800">📝 SCT 검사 결과</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const sessionData = viewSession(sessionId, true);
                if (sessionData) {
                  generateSctPdf(sessionData);
                }
              }} 
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 font-bold transition flex items-center gap-2"
            >
              📄 PDF 다운로드
            </button>
            <button onClick={() => { setView(isCounselor ? "counselorResults" : isAdmin ? "admin" : "login"); }} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500">
              ← 목록
            </button>
          </div>
        </div>
        <div className={`border rounded-lg p-4 mb-6 ${counselingTypeColor}`}>
          <p className="text-sm"><strong>상담 유형:</strong> {counselingTypeLabel}</p>
          <p className="text-sm"><strong>세션 ID:</strong> {sessionId}</p>
          <p className="text-sm"><strong>전화번호:</strong> {userInfo.phone || "N/A"}</p>
        </div>
        <div className="space-y-6">
          {Object.entries(sctCategories).map(([cat, nums]) => (
            <div key={cat} className="border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg text-gray-800">{cat}</h3>
                {!sctSummaries[cat] && !loadingSummary[cat] && (
                  <button 
                    onClick={() => generateSctRecommendation(cat, nums)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    🤖 AI 분석 생성
                  </button>
                )}
              </div>
              <div className="space-y-2 mb-4">
                {nums.map(n => (
                  <div key={n} className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">{n}. {sctQ[n]}</p>
                    <p className="text-sm font-semibold text-gray-800">{sctResponses[n] || "(미응답)"}</p>
                  </div>
                ))}
              </div>
              {loadingSummary[cat] && (
                <div className="bg-indigo-50 border border-indigo-200 rounded p-3 text-center">
                  <p className="text-sm text-indigo-600">🔄 AI 분석 중...</p>
                </div>
              )}
              {sctSummaries[cat] && (
                <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                  <p className="text-xs text-indigo-600 font-bold mb-1">💡 AI 심리 분석</p>
                  <p className="text-sm text-indigo-800 whitespace-pre-wrap">{sctSummaries[cat]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-green-700 font-semibold">✅ AI 분석 기능이 활성화되었습니다!</p>
          <p className="text-xs text-green-600 mt-1">각 카테고리의 "🤖 AI 분석 생성" 버튼을 클릭하여 심리학적 해석을 확인하세요.</p>
        </div>
      </div>
    </div>
    );
  }

  if (view === "dsiResult") {
    const { total, areas } = calcDsi();
    const level = total >= 120 ? "높음(양호)" : total >= 80 ? "중간(보통)" : "낮음(취약)";
    
    const counselingType = activeLinkData?.counselingType || "psychological";
    const counselingTypeLabel = counselingType === "biblical" ? "🕊️ 성경적 상담" : "🧠 심리상담";
    const counselingTypeColor = counselingType === "biblical" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-green-50 border-green-200 text-green-700";
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-green-800">🔍 DSI 검사 결과</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const sessionData = viewSession(sessionId, true);
                  if (sessionData) {
                    generateDsiPdf(sessionData);
                  }
                }} 
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 font-bold transition flex items-center gap-2"
              >
                📄 PDF 다운로드
              </button>
              <button onClick={() => { setView(isCounselor ? "counselorResults" : isAdmin ? "admin" : "login"); }} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500">
                ← 목록
              </button>
            </div>
          </div>
          <div className={`border rounded-lg p-4 mb-6 ${counselingTypeColor}`}>
            <p className="text-sm"><strong>상담 유형:</strong> {counselingTypeLabel}</p>
            <p className="text-sm"><strong>세션 ID:</strong> {sessionId}</p>
            <p className="text-sm"><strong>전화번호:</strong> {userInfo.phone || "N/A"}</p>
            <p className="text-lg font-bold mt-2">총점: {total}/180 ({level})</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {Object.entries(areas).map(([area, score]) => (
              <div key={area} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2">{area}</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{ width: `${(score / 36) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">{score}/36</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* ✅ AI 권장사항 생성 버튼 */}
          {!dsiRec && !loadingRec && (
            <div className="mb-6 text-center">
              <button 
                onClick={generateDsiRecommendation}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:bg-indigo-700 transition shadow-lg"
              >
                🤖 AI 심리 분석 및 권장사항 생성
              </button>
              <p className="text-xs text-gray-500 mt-2">검사 결과를 기반으로 심리학적 해석과 상담 권장사항을 제공합니다</p>
            </div>
          )}
          
          {loadingRec && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-sm text-indigo-600 font-semibold">🔄 AI가 검사 결과를 분석 중입니다...</p>
              <p className="text-xs text-indigo-500 mt-1">잠시만 기다려주세요</p>
            </div>
          )}
          
          {dsiRec && (
            <div className="mb-6 bg-indigo-50 border-2 border-indigo-300 rounded-xl p-5 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">💡</span>
                <p className="font-bold text-indigo-900 text-lg">AI 심리 분석 및 상담 권장사항</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{dsiRec}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {dsiQ.map(q => (
              <div key={q.num} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 flex-1">{q.num}. {q.content}</p>
                  <span className={`px-3 py-1 rounded font-bold text-sm ${dsiResponses[q.num] ? "bg-green-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                    {dsiResponses[q.num] || "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700 font-semibold">✅ AI 분석 기능이 활성화되었습니다!</p>
            <p className="text-xs text-green-600 mt-1">룰 기반 AI 시스템이 검사 결과를 종합적으로 분석하여 전문적인 권장사항을 제공합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "admin") return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🔐 관리자 대시보드</h1>
            <p className="text-xs text-gray-400 mt-1">LocalStorage 영구 저장 활성화</p>
          </div>
          <div className="flex gap-2">
            <label className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 cursor-pointer flex items-center gap-2">
              📂 불러오기
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileUpload} 
                className="hidden"
              />
            </label>
            <button 
              onClick={() => {
                console.log('=== 🔍 LocalStorage 데이터 확인 ===');
                console.log('승인된 상담사:', approvedCounselors.length);
                console.log('대기 중인 상담사:', pendingCounselors.length);
                console.log('제출된 검사:', submitted.length);
                console.log('전체 키:', Object.keys(localStorage).length);
                alert(`✅ 데이터 확인\n\n승인된 상담사: ${approvedCounselors.length}명\n대기 중인 상담사: ${pendingCounselors.length}명\n제출된 검사: ${submitted.length}건\n\n콘솔(F12)에서 상세 정보 확인 가능`);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
            >
              🔍 데이터 확인
            </button>
            <button onClick={logout} className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-500">
              로그아웃
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">👨‍⚕️ 상담사 승인 대기 ({pendingCounselors.length}건)</h2>
          {pendingCounselors.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>대기 중인 신청이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCounselors.map((c, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{c.name || "이름 미입력"} ({c.phone})</p>
                      <p className="text-sm text-gray-600">자격증: {c.certification || "없음"}</p>
                      <p className="text-sm text-gray-600">학력: {c.education}</p>
                      <p className="text-sm text-gray-600">경력: {c.experience || "없음"}</p>
                      <div className={`mt-2 inline-block px-2 py-1 rounded text-xs font-bold ${c.eduOk ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {c.eduOk ? `✅ 관련 학과: ${c.eduKws.join(", ")}` : "⚠️ 상담 관련 학과 미확인"}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">신청일: {new Date(c.requestDate).toLocaleString("ko-KR")}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => approveCounselor(c.phone)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700">
                        ✓ 승인
                      </button>
                      <button onClick={() => rejectCounselor(c.phone)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600">
                        ✗ 거부
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">✅ 승인된 상담사 ({approvedCounselors.length}명)</h2>
          {approvedCounselors.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>승인된 상담사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {approvedCounselors.map((c, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800">{c.name || "이름 미입력"} ({c.phone})</p>
                    <p className="text-xs text-gray-400">승인일: {new Date(c.approvedDate).toLocaleString("ko-KR")}</p>
                  </div>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">활성</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📊 전체 제출된 검사 ({submitted.length}건)</h2>
          <SessionList sessions={submitted} onView={viewSession} />
        </div>
      </div>
    </div>
  );

  return null;
}

function SessionList({ sessions, onView }) {
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  
  // 1초마다 시간 업데이트 (카운트다운)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  if (sessions.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-5xl mb-3">📋</div>
      <p>제출된 검사가 없습니다</p>
    </div>
  );
  
  // 만료 시간 계산 함수
  const getTimeRemaining = (createdAt) => {
    const now = currentTime;
    const createdTime = new Date(createdAt).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const elapsed = now - createdTime;
    const remaining = TWENTY_FOUR_HOURS - elapsed;
    
    if (remaining <= 0) {
      return { expired: true, text: "만료됨", color: "text-red-600" };
    }
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    
    let color = "text-green-600";
    if (hours < 3) color = "text-red-600";
    else if (hours < 6) color = "text-orange-600";
    
    return {
      expired: false,
      text: `${hours}시간 ${minutes}분 ${seconds}초`,
      color: color,
      hours: hours
    };
  };
  
  // JSON 다운로드 함수
  const downloadJson = (sessionId, e) => {
    e.stopPropagation();
    const r = localStorage.getItem("session_" + sessionId);
    if (!r) {
      alert('❌ 검사 결과를 찾을 수 없습니다.');
      return;
    }
    
    const sessionData = JSON.parse(r);
    const jsonStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `검사결과_${sessionData.testType}_${sessionId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('✅ 검사 결과가 JSON 파일로 다운로드되었습니다!');
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800 font-semibold">⚠️ 검사 결과는 24시간 후 자동 삭제됩니다</p>
        <p className="text-xs text-yellow-700 mt-1">중요한 결과는 <strong>💾 JSON 저장</strong> 버튼으로 로컬에 저장해주세요!</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {["#", "검사 유형", "전화번호", "제출 시간", "⏱️ 남은 시간", "액션"].map(h => <th key={h} className="border p-2 text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => {
              const timeInfo = getTimeRemaining(s.createdAt);
              return (
                <tr key={s.sessionId} className={`hover:bg-gray-50 ${timeInfo.expired ? 'opacity-50 bg-red-50' : ''}`}>
                  <td className="border p-2 text-center text-gray-400">{i + 1}</td>
                  <td className="border p-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.testType === "SCT" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                      {s.testType === "SCT" ? "📝 문장완성" : "🔍 자아분화"}
                    </span>
                  </td>
                  <td className="border p-2">{s.userPhone}</td>
                  <td className="border p-2 text-xs text-gray-600">{new Date(s.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="border p-2">
                    <span className={`font-bold text-xs ${timeInfo.color}`}>
                      {timeInfo.expired ? '🔴 만료됨' : `⏱️ ${timeInfo.text}`}
                    </span>
                    {!timeInfo.expired && timeInfo.hours < 6 && (
                      <div className="text-xs text-red-600 mt-1 font-semibold">
                        ⚠️ 곧 삭제됩니다!
                      </div>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex flex-col gap-1">
                      {!timeInfo.expired ? (
                        <>
                          <button 
                            onClick={() => onView(s.sessionId)} 
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 w-full"
                          >
                            📊 결과 보기
                          </button>
                          <button 
                            onClick={(e) => downloadJson(s.sessionId, e)} 
                            className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-green-700 w-full"
                            title="로컬에 JSON 파일로 저장"
                          >
                            💾 저장
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-red-600 font-semibold px-2 py-1">삭제됨</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PsychologicalTestSystem />);
