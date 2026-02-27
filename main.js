import { app, analytics, auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
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
        .btn-post:disabled { opacity: 0.5; cursor: wait; }

        .comment-list { margin-top: 60px; clear: both; }
        .comment-item { 
          background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; 
          margin-bottom: 16px; border-left: 4px solid var(--primary);
        }
        .author { font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between; }
        .content { color: var(--text-main); font-size: 1rem; line-height: 1.5; white-space: pre-wrap; }
        .timestamp { color: var(--text-dim); font-size: 0.75rem; font-weight: 400; }
        .btn-logout { background: transparent; border: 1px solid var(--text-dim); color: var(--text-dim); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
        .btn-logout:hover { color: #fff; border-color: #fff; }
      </style>

      <div class="header">
        <h2 style="color:var(--text-main)">커뮤니티 댓글</h2>
        <button id="logout-btn" class="btn-logout">로그아웃</button>
      </div>

      <div class="comment-card">
        <textarea id="comment-input" placeholder="이곳에 댓글을 남겨보세요..."></textarea>
        <button id="submit-btn" class="btn-post">등록하기</button>
      </div>

      <div id="comment-list" class="comment-list">
        <p style="text-align:center; color:var(--text-dim)">댓글을 불러오는 중...</p>
      </div>
    `;

    this.shadowRoot.getElementById('submit-btn').onclick = () => this.postComment();
    this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
  }

  async postComment() {
    const input = this.shadowRoot.getElementById('comment-input');
    const btn = this.shadowRoot.getElementById('submit-btn');
    const text = input.value.trim();
    const user = auth.currentUser;

    if (!text || !user) return;

    btn.disabled = true;
    try {
      await addDoc(collection(db, "comments"), {
        content: text,
        authorEmail: user.email,
        authorUid: user.uid,
        createdAt: serverTimestamp()
      });
      input.value = '';
    } catch (e) {
      console.error("댓글 등록 에러:", e);
      alert("댓글을 등록하는 중 오류가 발생했습니다.");
    } finally {
      btn.disabled = false;
    }
  }

  loadComments() {
    const listEl = this.shadowRoot.getElementById('comment-list');
    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
      listEl.innerHTML = '';
      if (snapshot.empty) {
        listEl.innerHTML = '<p style="text-align:center; color:var(--text-dim)">첫 번째 댓글을 남겨보세요!</p>';
        return;
      }
      snapshot.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement('div');
        item.className = 'comment-item';
        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전';
        item.innerHTML = `
          <div class="author">
            ${data.authorEmail}
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


/* 로그인 컴포넌트 (수정됨) */
class LoginScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.mode = 'login';
  }

  connectedCallback() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.renderDashboard(user);
      } else {
        this.render();
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  renderDashboard(user) {
    // 로그인이 되면 전체 화면을 댓글 섹션으로 변경
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; min-height: 100vh; overflow-y: auto; padding-top: 40px; }
      </style>
      <comments-section></comments-section>
    `;
    
    // 바디 스타일 수정 (그리드 해제)
    document.body.style.display = 'block';
    document.body.style.overflow = 'auto';
  }

  render() {
    // 기존 로그인 화면 복원 및 바디 스타일 복구
    document.body.style.display = 'grid';
    document.body.style.overflow = 'hidden';

    let title = '반갑습니다';
    let subtitle = '계정에 로그인하여 계속하세요';
    let submitText = '로그인';
    let footerText = '계정이 없으신가요?';
    let footerLinkText = '회원가입';

    if (this.mode === 'signup') {
      title = '회원가입';
      subtitle = '새로운 계정을 만드세요';
      submitText = '가입하기';
      footerText = '이미 계정이 있으신가요?';
      footerLinkText = '로그인';
    } else if (this.mode === 'reset') {
      title = '비밀번호 찾기';
      subtitle = '가입하신 이메일로 재설정 링크를 보내드립니다';
      submitText = '이메일 발송';
      footerText = '기억이 나셨나요?';
      footerLinkText = '로그인으로 돌아가기';
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
          font-size: 1rem; font-family: inherit; transition: all 0.3s ease;
        }
        input:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        .options { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; font-size: 0.85rem; }
        .remember-me { display: flex; align-items: center; gap: 8px; color: var(--text-dim); cursor: pointer; white-space: nowrap; }
        a { color: var(--primary); text-decoration: none; font-weight: 500; cursor: pointer; }
        a:hover { text-decoration: underline; }
        button#submit-btn {
          width: 100%; background: var(--primary); color: oklch(0.1 0 0); border: none;
          border-radius: var(--radius-md); padding: 16px; font-size: 1rem;
          font-weight: 700; cursor: pointer; transition: 0.3s;
          box-shadow: 0 4px 15px var(--primary-glow);
        }
        button#submit-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        button:disabled { opacity: 0.6; cursor: wait; }
        .error-message { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 20px; display: none; text-align: center; }
        .success-message { color: #4ade80; background: rgba(74, 222, 128, 0.1); padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 20px; display: none; text-align: center; }
        .footer { margin-top: 32px; text-align: center; font-size: 0.9rem; color: var(--text-dim); }
      </style>

      <div class="login-card">
        <h2>${title}</h2>
        <p class="subtitle">${subtitle}</p>
        
        <div id="error-msg" class="error-message"></div>
        <div id="success-msg" class="success-message"></div>

        <form id="auth-form">
          <div class="form-group">
            <label for="email">이메일 주소</label>
            <input type="email" id="email" placeholder="name@example.com" required>
          </div>
          
          ${this.mode !== 'reset' ? `
            <div class="form-group">
              <label for="password">비밀번호</label>
              <input type="password" id="password" placeholder="••••••••" required minlength="6">
            </div>
          ` : ''}

          ${this.mode === 'login' ? `
            <div class="options">
              <label class="remember-me"><input type="checkbox"> 로그인 유지</label>
              <a id="forgot-link">비밀번호 찾기</a>
            </div>
          ` : ''}

          <button type="submit" id="submit-btn">${submitText}</button>
        </form>

        <div class="footer">
          ${footerText} 
          <a id="toggle-link">${footerLinkText}</a>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.shadowRoot.getElementById('auth-form');
    const toggleLink = this.shadowRoot.getElementById('toggle-link');
    const forgotLink = this.shadowRoot.getElementById('forgot-link');
    const errorEl = this.shadowRoot.getElementById('error-msg');
    const successEl = this.shadowRoot.getElementById('success-msg');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');

    toggleLink.onclick = () => {
      if (this.mode === 'login') this.setMode('signup');
      else this.setMode('login');
    };

    if (forgotLink) {
      forgotLink.onclick = () => this.setMode('reset');
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = this.shadowRoot.getElementById('email').value;
      const passwordEl = this.shadowRoot.getElementById('password');
      const password = passwordEl ? passwordEl.value : '';

      errorEl.style.display = 'none';
      successEl.style.display = 'none';
      submitBtn.disabled = true;
      const originalBtnText = submitBtn.textContent;
      submitBtn.textContent = '처리 중...';

      try {
        if (this.mode === 'login') {
          await signInWithEmailAndPassword(auth, email, password);
        } else if (this.mode === 'signup') {
          await createUserWithEmailAndPassword(auth, email, password);
          alert('회원가입이 완료되었습니다!');
        } else if (this.mode === 'reset') {
          await sendPasswordResetEmail(auth, email);
          successEl.style.display = 'block';
          successEl.textContent = '비밀번호 재설정 이메일을 보냈습니다. 받은 편지함을 확인해 주세요!';
        }
      } catch (error) {
        console.error('Auth 에러:', error.code);
        errorEl.style.display = 'block';
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorEl.textContent = '이메일 또는 비밀번호가 잘못되었습니다.';
            break;
          default:
            errorEl.textContent = '인증 중 오류가 발생했습니다.';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    };
  }
}

customElements.define('login-screen', LoginScreen);
