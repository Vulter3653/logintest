import { app, analytics, auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

class LoginScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isLoginMode = true; // true: 로그인, false: 회원가입
  }

  connectedCallback() {
    // 인증 상태 감시 (공식 문서 권장 사항)
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("사용자가 로그인 상태입니다:", user.email);
        this.renderAuthenticated(user);
      } else {
        console.log("사용자가 로그아웃 상태입니다.");
        this.render();
      }
    });
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.render();
  }

  // 로그인 상태일 때의 UI
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
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        h2 { color: var(--text-main); margin-bottom: 16px; }
        p { color: var(--text-dim); margin-bottom: 32px; }
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
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: 440px;
          perspective: 1000px;
          z-index: 2;
        }

        .login-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          padding: 48px;
          box-shadow: var(--shadow-deep);
          border: 1px solid oklch(1 0 0 / 0.1);
          backdrop-filter: blur(10px);
          animation: slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        h2 {
          font-size: 2rem;
          margin-bottom: 8px;
          color: var(--text-main);
          text-align: center;
        }

        p.subtitle {
          color: var(--text-dim);
          text-align: center;
          margin-bottom: 32px;
          font-size: 0.95rem;
        }

        .form-group {
          margin-bottom: 20px;
          position: relative;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.85rem;
          color: var(--text-dim);
          font-weight: 500;
        }

        input {
          width: 100%;
          background: oklch(0 0 0 / 0.2);
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          padding: 14px 16px;
          color: white;
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.3s ease;
        }

        input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: var(--shadow-glow);
        }

        .options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          font-size: 0.85rem;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-dim);
        }

        a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
          cursor: pointer;
        }

        a:hover { text-decoration: underline; }

        button#submit-btn {
          width: 100%;
          background: var(--primary);
          color: oklch(0.1 0 0);
          border: none;
          border-radius: var(--radius-md);
          padding: 16px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          box-shadow: 0 4px 15px var(--primary-glow);
        }

        button#submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        button:disabled { opacity: 0.6; cursor: wait; }

        .error-message {
          color: #ff4d4d;
          background: rgba(255, 77, 77, 0.1);
          padding: 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 20px;
          display: none;
          text-align: center;
        }

        .footer {
          margin-top: 32px;
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-dim);
        }
      </style>

      <div class="login-card">
        <h2>${this.isLoginMode ? '반갑습니다' : '회원가입'}</h2>
        <p class="subtitle">${this.isLoginMode ? '계정에 로그인하여 계속하세요' : '새로운 계정을 만드세요'}</p>
        
        <div id="error-msg" class="error-message"></div>

        <form id="auth-form">
          <div class="form-group">
            <label for="email">이메일 주소</label>
            <input type="email" id="email" placeholder="name@example.com" required>
          </div>
          
          <div class="form-group">
            <label for="password">비밀번호</label>
            <input type="password" id="password" placeholder="••••••••" required minlength="6">
          </div>

          ${this.isLoginMode ? `
            <div class="options">
              <label class="remember-me"><input type="checkbox"> 로그인 유지</label>
              <a>비밀번호 찾기</a>
            </div>
          ` : ''}

          <button type="submit" id="submit-btn">${this.isLoginMode ? '로그인' : '가입하기'}</button>
        </form>

        <div class="footer">
          ${this.isLoginMode ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'} 
          <a id="toggle-link">${this.isLoginMode ? '회원가입' : '로그인'}</a>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.shadowRoot.getElementById('auth-form');
    const toggleLink = this.shadowRoot.getElementById('toggle-link');
    const errorEl = this.shadowRoot.getElementById('error-msg');
    const submitBtn = this.shadowRoot.getElementById('submit-btn');

    toggleLink.onclick = () => this.toggleMode();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = this.shadowRoot.getElementById('email').value;
      const password = this.shadowRoot.getElementById('password').value;

      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';

      try {
        if (this.isLoginMode) {
          // 로그인 로직 (공식 문서)
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          // 회원가입 로직 (공식 문서)
          await createUserWithEmailAndPassword(auth, email, password);
          alert('회원가입이 완료되었습니다! 자동으로 로그인됩니다.');
        }
      } catch (error) {
        console.error('Auth 에러:', error.code);
        errorEl.style.display = 'block';
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorEl.textContent = '이미 사용 중인 이메일입니다.';
            break;
          case 'auth/weak-password':
            errorEl.textContent = '비밀번호는 6자리 이상이어야 합니다.';
            break;
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorEl.textContent = '이메일 또는 비밀번호가 잘못되었습니다.';
            break;
          default:
            errorEl.textContent = '인증 중 오류가 발생했습니다. 다시 시도해 주세요.';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = this.isLoginMode ? '로그인' : '가입하기';
      }
    };
  }
}

customElements.define('login-screen', LoginScreen);
