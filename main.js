import { app, analytics, auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

class LoginScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.mode = 'login'; // 'login', 'signup', 'reset'
  }

  connectedCallback() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.renderAuthenticated(user);
      } else {
        this.render();
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  renderAuthenticated(user) {
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 440px; z-index: 2; }
        .card { 
          background: var(--card-bg); 
          border-radius: var(--radius-lg); 
          padding: 48px; 
          text-align: center;
          box-shadow: var(--shadow-deep);
          backdrop-filter: blur(10px);
          animation: fadeIn 0.5s ease-out;
        }
        h2 { color: var(--text-main); margin-bottom: 16px; }
        p { color: var(--text-dim); margin-bottom: 32px; font-size: 0.9rem; }
        button { 
          width: 100%; background: var(--primary); color: #000; 
          border: none; border-radius: var(--radius-md); padding: 16px; 
          font-weight: 700; cursor: pointer; transition: 0.3s;
        }
        button:hover { transform: translateY(-2px); filter: brightness(1.1); }
      </style>
      <div class="card">
        <h2>환영합니다!</h2>
        <p><strong>${user.email}</strong> 님으로 접속 중입니다.</p>
        <button id="logout-btn">로그아웃</button>
      </div>
    `;
    this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
  }

  render() {
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
        :host { display: block; width: 100%; max-width: 440px; perspective: 1000px; z-index: 2; }
        .login-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          padding: 48px;
          box-shadow: var(--shadow-deep);
          border: 1px solid oklch(1 0 0 / 0.1);
          backdrop-filter: blur(10px);
          animation: slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        h2 { font-size: 2rem; margin-bottom: 8px; color: var(--text-main); text-align: center; }
        p.subtitle { color: var(--text-dim); text-align: center; margin-bottom: 32px; font-size: 0.95rem; }
        .form-group { margin-bottom: 20px; }
        label.input-label { display: block; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-dim); font-weight: 500; }
        input {
          width: 100%; background: oklch(0 0 0 / 0.2); border: 2px solid transparent;
          border-radius: var(--radius-md); padding: 14px 16px; color: white;
          font-size: 1rem; font-family: inherit; transition: all 0.3s ease;
        }
        input:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        
        /* 개선된 options 영역 스타일 */
        .options { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          flex-wrap: wrap; /* 좁은 화면에서 줄바꿈 허용 */
          gap: 12px; /* 요소 간 간격 유지 */
          margin-bottom: 24px; 
          font-size: 0.85rem; 
        }
        .remember-me { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          color: var(--text-dim); 
          cursor: pointer;
          white-space: nowrap; /* 텍스트 줄바꿈 방지 */
        }
        .remember-me input { width: auto; padding: 0; cursor: pointer; }

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

        /* 좁은 화면을 위한 추가 미디어 쿼리 */
        @media (max-width: 360px) {
          .options { justify-content: center; text-align: center; }
          .login-card { padding: 32px 24px; }
        }
      </style>

      <div class="login-card">
        <h2>${title}</h2>
        <p class="subtitle">${subtitle}</p>
        
        <div id="error-msg" class="error-message"></div>
        <div id="success-msg" class="success-message"></div>

        <form id="auth-form">
          <div class="form-group">
            <label class="input-label" for="email">이메일 주소</label>
            <input type="email" id="email" placeholder="name@example.com" required>
          </div>
          
          ${this.mode !== 'reset' ? `
            <div class="form-group">
              <label class="input-label" for="password">비밀번호</label>
              <input type="password" id="password" placeholder="••••••••" required minlength="6">
            </div>
          ` : ''}

          ${this.mode === 'login' ? `
            <div class="options">
              <label class="remember-me">
                <input type="checkbox"> 로그인 유지
              </label>
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
            errorEl.textContent = '등록되지 않은 이메일 주소입니다.';
            break;
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorEl.textContent = '이메일 또는 비밀번호가 잘못되었습니다.';
            break;
          case 'auth/email-already-in-use':
            errorEl.textContent = '이미 사용 중인 이메일입니다.';
            break;
          case 'auth/invalid-email':
            errorEl.textContent = '유효하지 않은 이메일 형식입니다.';
            break;
          default:
            errorEl.textContent = '인증 중 오류가 발생했습니다. 다시 시도해 주세요.';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    };
  }
}

customElements.define('login-screen', LoginScreen);
