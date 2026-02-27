import { app, analytics, auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 댓글 컴포넌트 */
class CommentsSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadComments();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 800px; margin: 20px auto; padding: 0 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .comment-card { 
          background: var(--card-bg); border-radius: 16px; padding: 24px; 
          box-shadow: var(--shadow-deep); border: 1px solid oklch(1 0 0 / 0.1); backdrop-filter: blur(10px); 
          margin-bottom: 24px; animation: slideUp 0.6s ease;
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        textarea { 
          width: 100%; background: rgba(0,0,0,0.2); border: 2px solid transparent; 
          border-radius: 12px; padding: 16px; color: #fff; font-family: inherit; font-size: 1rem;
          resize: vertical; min-height: 100px; transition: 0.3s; margin-bottom: 12px;
        }
        textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        
        .btn-post { 
          background: var(--primary); color: #000; font-weight: 700; border: none; 
          padding: 12px 24px; border-radius: 8px; cursor: pointer; float: right; transition: 0.3s;
        }
        .btn-post:hover { transform: scale(1.05); filter: brightness(1.1); }

        .comment-list { margin-top: 60px; clear: both; }
        .comment-item { 
          background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; 
          margin-bottom: 16px; border-left: 4px solid var(--primary);
          transition: 0.3s;
        }
        .comment-item.mine { border-left-color: var(--accent); background: rgba(255,255,255,0.1); }
        .author { font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
        .comment-item.mine .author { color: var(--accent); }
        .content { color: var(--text-main); font-size: 1rem; line-height: 1.5; white-space: pre-wrap; }
        .timestamp { color: var(--text-dim); font-size: 0.75rem; font-weight: 400; }
        .btn-logout { background: transparent; border: 1px solid var(--text-dim); color: var(--text-dim); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
        .badge { background: var(--accent); color: #000; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; }
      </style>

      <div class="header">
        <div>
          <h2 style="color:var(--text-main); margin-bottom:4px;">글로벌 피드</h2>
          <p style="color:var(--text-dim); font-size:0.85rem;">모든 사용자와 실시간으로 대화하세요</p>
        </div>
        <button id="logout-btn" class="btn-logout">로그아웃</button>
      </div>

      <div class="comment-card">
        <textarea id="comment-input" placeholder="커뮤니티에 메시지를 남겨보세요..."></textarea>
        <button id="submit-btn" class="btn-post">메시지 전송</button>
      </div>

      <div id="comment-list" class="comment-list">
        <p style="text-align:center; color:var(--text-dim)">메시지를 불러오는 중...</p>
      </div>
    `;

    this.shadowRoot.getElementById('submit-btn').onclick = () => this.postComment();
    this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
  }

  async postComment() {
    const input = this.shadowRoot.getElementById('comment-input');
    const text = input.value.trim();
    const user = auth.currentUser;

    if (!text || !user) return;

    try {
      await addDoc(collection(db, "comments"), {
        content: text,
        authorEmail: user.email || user.displayName || "익명 사용자",
        authorUid: user.uid,
        createdAt: serverTimestamp()
      });
      input.value = '';
    } catch (e) {
      console.error("전송 에러:", e);
      alert("전송 중 오류가 발생했습니다. Firestore 규칙을 확인해 주세요.");
    }
  }

  loadComments() {
    const listEl = this.shadowRoot.getElementById('comment-list');
    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
      const user = auth.currentUser;
      listEl.innerHTML = '';
      if (snapshot.empty) {
        listEl.innerHTML = '<p style="text-align:center; color:var(--text-dim)">아직 메시지가 없습니다.</p>';
        return;
      }
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isMine = user && data.authorUid === user.uid;
        const item = document.createElement('div');
        item.className = `comment-item ${isMine ? 'mine' : ''}`;
        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전';
        item.innerHTML = `
          <div class="author">
            <span>${data.authorEmail}${isMine ? '<span class="badge">나</span>' : ''}</span>
            <span class="timestamp">${date}</span>
          </div>
          <div class="content">${this.escapeHTML(data.content)}</div>
        `;
        listEl.appendChild(item);
      });
    });
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
customElements.define('comments-section', CommentsSection);

/* 로그인 컴포넌트 */
class LoginScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.mode = 'login';
  }

  connectedCallback() {
    onAuthStateChanged(auth, (user) => {
      if (user) this.renderDashboard();
      else this.render();
    });
  }

  setMode(mode) { this.mode = mode; this.render(); }

  renderDashboard() {
    this.shadowRoot.innerHTML = `
      <style>:host { display: block; width: 100%; min-height: 100vh; overflow-y: auto; padding-top: 40px; }</style>
      <comments-section></comments-section>
    `;
    document.body.style.display = 'block';
    document.body.style.overflow = 'auto';
  }

  render() {
    document.body.style.display = 'grid';
    document.body.style.overflow = 'hidden';

    let title = '반갑습니다';
    let subtitle = '계정에 로그인하여 계속하세요';
    let submitText = '로그인';
    let footerText = '계정이 없으신가요?';
    let footerLinkText = '회원가입';

    if (this.mode === 'signup') {
      title = '회원가입'; subtitle = '새로운 계정을 만드세요'; submitText = '가입하기';
      footerText = '이미 계정이 있으신가요?'; footerLinkText = '로그인';
    } else if (this.mode === 'reset') {
      title = '비밀번호 찾기'; subtitle = '재설정 링크를 보내드립니다'; submitText = '이메일 발송';
      footerText = '기억이 나셨나요?'; footerLinkText = '로그인으로 돌아가기';
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; max-width: 440px; perspective: 1000px; z-index: 2; margin: 0 auto; }
        .login-card {
          background: var(--card-bg); border-radius: var(--radius-lg); padding: 48px;
          box-shadow: var(--shadow-deep); border: 1px solid oklch(1 0 0 / 0.1);
          backdrop-filter: blur(10px); animation: slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        h2 { font-size: 2rem; margin-bottom: 8px; color: var(--text-main); text-align: center; }
        p.subtitle { color: var(--text-dim); text-align: center; margin-bottom: 32px; font-size: 0.95rem; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-dim); font-weight: 500; }
        input {
          width: 100%; background: oklch(0 0 0 / 0.2); border: 2px solid transparent;
          border-radius: var(--radius-md); padding: 14px 16px; color: white;
          font-size: 1rem; font-family: inherit; transition: 0.3s;
        }
        input:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        .options { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; font-size: 0.85rem; }
        .remember-me { display: flex; align-items: center; gap: 8px; color: var(--text-dim); cursor: pointer; }
        a { color: var(--primary); text-decoration: none; font-weight: 500; cursor: pointer; }
        
        button#submit-btn {
          width: 100%; background: var(--primary); color: oklch(0.1 0 0); border: none;
          border-radius: var(--radius-md); padding: 16px; font-size: 1rem;
          font-weight: 700; cursor: pointer; transition: 0.3s;
          box-shadow: 0 4px 15px var(--primary-glow);
        }

        .divider { display: flex; align-items: center; text-align: center; margin: 24px 0; color: var(--text-dim); font-size: 0.8rem; }
        .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid oklch(1 0 0 / 0.1); }
        .divider:not(:empty)::before { margin-right: .5em; }
        .divider:not(:empty)::after { margin-left: .5em; }

        .btn-google {
          width: 100%; background: #fff; color: #000; border: none;
          border-radius: var(--radius-md); padding: 14px; font-size: 0.95rem;
          font-weight: 600; cursor: pointer; transition: 0.3s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn-google:hover { background: #f1f1f1; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .google-icon { width: 18px; height: 18px; }

        button:disabled { opacity: 0.6; }
        .error-message, .success-message { padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 20px; display: none; text-align: center; }
        .error-message { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); }
        .success-message { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
        .footer { margin-top: 32px; text-align: center; font-size: 0.9rem; color: var(--text-dim); }
      </style>

      <div class="login-card">
        <h2>${title}</h2>
        <p class="subtitle">${subtitle}</p>
        <div id="error-msg" class="error-message"></div>
        <div id="success-msg" class="success-message"></div>

        <form id="auth-form">
          <div class="form-group"><label>이메일 주소</label><input type="email" id="email" placeholder="name@example.com" required></div>
          ${this.mode !== 'reset' ? `<div class="form-group"><label>비밀번호</label><input type="password" id="password" placeholder="••••••••" required minlength="6"></div>` : ''}
          ${this.mode === 'login' ? `<div class="options"><label class="remember-me"><input type="checkbox"> 로그인 유지</label><a id="forgot-link">비밀번호 찾기</a></div>` : ''}
          <button type="submit" id="submit-btn">${submitText}</button>
        </form>

        ${this.mode === 'login' ? `
          <div class="divider">또는</div>
          <button id="google-btn" class="btn-google">
            <svg class="google-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>
        ` : ''}

        <div class="footer">${footerText} <a id="toggle-link">${footerLinkText}</a></div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.shadowRoot.getElementById('auth-form');
    const toggleLink = this.shadowRoot.getElementById('toggle-link');
    const forgotLink = this.shadowRoot.getElementById('forgot-link');
    const googleBtn = this.shadowRoot.getElementById('google-btn');
    const errorEl = this.shadowRoot.getElementById('error-msg');
    const successEl = this.shadowRoot.getElementById('success-msg');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');

    toggleLink.onclick = () => (this.mode === 'login' ? this.setMode('signup') : this.setMode('login'));
    if (forgotLink) forgotLink.onclick = () => this.setMode('reset');

    if (googleBtn) {
      googleBtn.onclick = async () => {
        try {
          errorEl.style.display = 'none';
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          console.error('구글 로그인 에러:', error);
          errorEl.style.display = 'block';
          // 영문 에러 코드를 직접 표시하여 원인 파악을 돕습니다.
          errorEl.textContent = `오류가 발생했습니다: (${error.code})`;
        }
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = this.shadowRoot.getElementById('email').value;
      const password = this.shadowRoot.getElementById('password')?.value || '';
      errorEl.style.display = 'none'; successEl.style.display = 'none';
      submitBtn.disabled = true;

      try {
        if (this.mode === 'login') await signInWithEmailAndPassword(auth, email, password);
        else if (this.mode === 'signup') { await createUserWithEmailAndPassword(auth, email, password); alert('회원가입 완료!'); }
        else { await sendPasswordResetEmail(auth, email); successEl.style.display = 'block'; successEl.textContent = '이메일을 보냈습니다!'; }
      } catch (error) {
        errorEl.style.display = 'block';
        errorEl.textContent = `인증 중 오류가 발생했습니다: (${error.code})`;
      } finally { submitBtn.disabled = false; }
    };
  }
}
customElements.define('login-screen', LoginScreen);
