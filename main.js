import { app, analytics } from './firebase-config.js';

class LoginScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
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
          transition: color 0.3s;
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
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        input:focus {
          outline: none;
          border-color: var(--primary);
          background: oklch(0 0 0 / 0.3);
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
          cursor: pointer;
          color: var(--text-dim);
        }

        .remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.2s;
        }

        a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        button {
          width: 100%;
          background: var(--primary);
          color: oklch(0.1 0 0);
          border: none;
          border-radius: var(--radius-md);
          padding: 16px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px var(--primary-glow);
          margin-top: 8px;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px var(--primary-glow);
          filter: brightness(1.1);
        }

        button:active {
          transform: translateY(0);
        }

        .footer {
          margin-top: 32px;
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-dim);
        }

        /* Responsive */
        @container (max-width: 400px) {
          .login-card {
            padding: 32px;
          }
        }
      </style>

      <div class="login-card">
        <h2>반갑습니다</h2>
        <p class="subtitle">계정에 로그인하여 계속하세요</p>
        
        <form id="login-form">
          <div class="form-group">
            <label for="username">사용자명 또는 이메일</label>
            <input type="text" id="username" placeholder="name@example.com" required>
          </div>
          
          <div class="form-group">
            <label for="password">비밀번호</label>
            <input type="password" id="password" placeholder="••••••••" required>
          </div>

          <div class="options">
            <label class="remember-me">
              <input type="checkbox"> 로그인 유지
            </label>
            <a href="#">비밀번호 찾기</a>
          </div>

          <button type="submit">로그인</button>
        </form>

        <div class="footer">
          계정이 없으신가요? <a href="#">회원가입</a>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = this.shadowRoot.getElementById('username').value;
      console.log('Login attempt:', username);
      alert(`${username}님, 환영합니다!`);
    });
  }
}

customElements.define('login-screen', LoginScreen);