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
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 댓글 컴포넌트 */
class CommentsSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.currentUser = null;
  }

  connectedCallback() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.render();
      this.loadComments();
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; gap: 20px; flex-wrap: wrap; }
        .user-info { display: flex; align-items: center; gap: 12px; color: var(--text-dim); font-size: 0.9rem; }
        .auth-buttons { display: flex; gap: 10px; }
        
        .comment-input-card { 
          background: var(--card-bg); border-radius: 16px; padding: 24px; 
          box-shadow: var(--shadow-deep); border: 1px solid oklch(1 0 0 / 0.1); 
          margin-bottom: 40px; position: sticky; top: 20px; z-index: 10;
        }
        textarea { 
          width: 100%; background: rgba(0,0,0,0.2); border: 2px solid transparent; 
          border-radius: 12px; padding: 16px; color: #fff; font-family: inherit; font-size: 1rem;
          resize: vertical; min-height: 80px; transition: 0.3s; margin-bottom: 12px;
        }
        textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        
        .btn-post { background: var(--primary); color: #000; font-weight: 700; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; float: right; transition: 0.3s; }
        .btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.3s; }
        .btn-outline:hover { background: var(--primary); color: #000; }
        
        .login-prompt { text-align: center; padding: 30px; border: 2px dashed oklch(1 0 0 / 0.2); border-radius: 16px; color: var(--text-dim); margin-bottom: 40px; }
        .btn-login-redirect { color: var(--primary); font-weight: 700; text-decoration: underline; cursor: pointer; }
        
        .comment-list { margin-top: 20px; clear: both; }
        .comment-item { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px; border-left: 4px solid var(--primary); transition: 0.3s; position: relative; }
        .comment-item.mine { border-left-color: var(--accent); background: rgba(255,255,255,0.08); }
        .author { font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .comment-item.mine .author { color: var(--accent); }
        .content { color: var(--text-main); font-size: 1rem; line-height: 1.6; white-space: pre-wrap; margin-bottom: 12px; }
        .actions { display: flex; gap: 12px; font-size: 0.8rem; justify-content: flex-end; height: 24px; align-items: center; }
        .btn-action { background: none; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; transition: 0.2s; font-family: inherit; }
        .btn-edit { color: var(--primary); }
        .btn-delete { color: #ff4d4d; }
        .btn-save { color: var(--accent); font-weight: 700; }
        .btn-cancel { color: var(--text-dim); }
        .btn-action:hover { background: rgba(255,255,255,0.1); }
        .timestamp { color: var(--text-dim); font-size: 0.75rem; font-weight: 400; }
        .btn-logout { background: transparent; border: 1px solid var(--text-dim); color: var(--text-dim); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
      </style>
      <div class="header">
        <div><h1 style="color:var(--text-main); margin-bottom:4px; font-size:1.8rem;">SKKU Marketing Coffee Chat</h1><p style="color:var(--text-dim); font-size:0.85rem;">성균관대 마케팅 학우들을 위한 실시간 소통 공간</p></div>
        ${this.currentUser ? `
          <div class="user-info">
            <span>${this.currentUser.email || this.currentUser.displayName}</span>
            <button id="logout-btn" class="btn-logout">로그아웃</button>
          </div>
        ` : `
          <div class="auth-buttons">
            <button id="main-signup-btn" class="btn-outline">회원가입</button>
            <button id="main-login-btn" class="btn-post" style="float:none;">로그인</button>
          </div>
        `}
      </div>
      ${this.currentUser ? `<div class="comment-input-card"><textarea id="comment-input" placeholder="커피 한 잔 하며 나누고 싶은 이야기를 적어주세요..."></textarea><button id="submit-btn" class="btn-post">메시지 전송</button></div>` : `<div class="login-prompt">메시지를 작성하려면 <span id="prompt-login-btn" class="btn-login-redirect">로그인</span>이 필요합니다.</div>`}
      <div id="comment-list" class="comment-list"><p style="text-align:center; color:var(--text-dim)">이야기를 불러오는 중...</p></div>
    `;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const logoutBtn = this.shadowRoot.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
    
    const loginBtn = this.shadowRoot.getElementById('main-login-btn');
    const signupBtn = this.shadowRoot.getElementById('main-signup-btn');
    const promptLoginBtn = this.shadowRoot.getElementById('prompt-login-btn');
    
    const openAuth = (mode = 'login') => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode } }));
    
    if (loginBtn) loginBtn.onclick = () => openAuth('login');
    if (signupBtn) signupBtn.onclick = () => openAuth('signup');
    if (promptLoginBtn) promptLoginBtn.onclick = () => openAuth('login');

    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const input = this.shadowRoot.getElementById('comment-input');
        const text = input.value.trim();
        if (!text || !this.currentUser) return;
        try {
          await addDoc(collection(db, "comments"), { content: text, authorEmail: this.currentUser.email || this.currentUser.displayName || "익명", authorUid: this.currentUser.uid, createdAt: serverTimestamp() });
          input.value = '';
        } catch (e) { alert("전송 중 오류가 발생했습니다."); }
      };
    }
  }

  loadComments() {
    const listEl = this.shadowRoot.getElementById('comment-list');
    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      listEl.innerHTML = '';
      if (snapshot.empty) { listEl.innerHTML = '<p style="text-align:center; color:var(--text-dim)">첫 메시지를 남겨보세요!</p>'; return; }
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const isMine = this.currentUser && data.authorUid === this.currentUser.uid;
        const item = document.createElement('div');
        item.className = `comment-item ${isMine ? 'mine' : ''}`;
        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전';
        item.innerHTML = `
          <div class="author"><span>${data.authorEmail}${isMine ? ' <span style="color:var(--accent); font-size:0.7rem;">(나)</span>' : ''}</span><span class="timestamp">${date}</span></div>
          <div class="content" id="content-${id}">${this.escapeHTML(data.content)}</div>
          ${isMine ? `<div class="actions" id="actions-${id}"><button class="btn-action btn-edit" id="btn-edit-${id}">수정</button><button class="btn-action btn-delete" id="btn-delete-${id}">삭제</button></div>` : ''}
        `;
        listEl.appendChild(item);
        if (isMine) {
          const dBtn = this.shadowRoot.getElementById(`btn-delete-${id}`);
          const eBtn = this.shadowRoot.getElementById(`btn-edit-${id}`);
          if (dBtn) dBtn.onclick = () => this.deleteComment(id);
          if (eBtn) eBtn.onclick = () => this.startEdit(id, data.content);
        }
      });
    });
  }

  async deleteComment(id) {
    if (confirm("정말로 이 댓글을 삭제하시겠습니까?")) {
      try { await deleteDoc(doc(db, "comments", id)); } catch (e) { alert("삭제 권한이 없습니다."); }
    }
  }

  async startEdit(id, oldContent) {
    const contentEl = this.shadowRoot.getElementById(`content-${id}`);
    const actionsEl = this.shadowRoot.getElementById(`actions-${id}`);
    const originalContentHTML = contentEl.innerHTML;
    const originalActionsHTML = actionsEl.innerHTML;
    contentEl.innerHTML = `<textarea id="edit-input-${id}" style="min-height:60px; margin-top:10px; margin-bottom:0;">${oldContent}</textarea>`;
    actionsEl.innerHTML = `<button class="btn-action btn-cancel" id="btn-cancel-${id}">취소</button><button class="btn-action btn-save" id="btn-save-${id}">저장</button>`;
    this.shadowRoot.getElementById(`btn-cancel-${id}`).onclick = () => {
      contentEl.innerHTML = originalContentHTML;
      actionsEl.innerHTML = originalActionsHTML;
      this.shadowRoot.getElementById(`btn-delete-${id}`).onclick = () => this.deleteComment(id);
      this.shadowRoot.getElementById(`btn-edit-${id}`).onclick = () => this.startEdit(id, oldContent);
    };
    this.shadowRoot.getElementById(`btn-save-${id}`).onclick = async () => {
      const newContent = this.shadowRoot.getElementById(`edit-input-${id}`).value.trim();
      if (!newContent) return;
      try { await updateDoc(doc(db, "comments", id), { content: newContent }); } catch (e) { alert("수정 권한이 없습니다."); }
    };
  }

  escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
}
customElements.define('comments-section', CommentsSection);

/* 로그인 화면 컴포넌트 */
class LoginScreen extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.mode = 'login'; this.isVisible = false; }
  connectedCallback() {
    window.addEventListener('show-login', (e) => {
      this.isVisible = true;
      if (e.detail && e.detail.mode) this.mode = e.detail.mode;
      this.render();
    });
    onAuthStateChanged(auth, (user) => { if (user) { this.isVisible = false; this.render(); } });
    this.render();
  }
  setMode(mode) { this.mode = mode; this.render(); }
  render() {
    if (!this.isVisible) { this.shadowRoot.innerHTML = ''; return; }
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px); }
        .login-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: 40px; width: 90%; max-width: 400px; box-shadow: var(--shadow-deep); animation: scaleUp 0.3s ease; position: relative; }
        @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        h2 { text-align: center; margin-bottom: 24px; color: var(--text-main); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.85rem; }
        input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; box-sizing: border-box; }
        .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: #000; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; }
        .btn-close { position: absolute; top: 15px; right: 15px; color: #fff; cursor: pointer; font-size: 1.5rem; background: none; border: none; }
        .divider { text-align: center; margin: 20px 0; color: var(--text-dim); font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1); line-height: 0.1em; }
        .divider span { background: var(--card-bg); padding: 0 10px; }
        .btn-google { width: 100%; padding: 12px; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .footer { text-align: center; margin-top: 24px; font-size: 0.85rem; color: var(--text-dim); }
        a { color: var(--primary); cursor: pointer; text-decoration: underline; }
      </style>
      <div class="overlay">
        <div class="login-card">
          <button class="btn-close" id="close-btn">&times;</button>
          <h2>${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '회원가입' : '비밀번호 찾기'}</h2>
          <div id="error-msg" style="color:#ff4d4d; font-size:0.8rem; text-align:center; margin-bottom:10px; display:none;"></div>
          <form id="auth-form">
            <div class="form-group"><label>이메일</label><input type="email" id="email" required></div>
            ${this.mode !== 'reset' ? `<div class="form-group"><label>비밀번호</label><input type="password" id="password" required minlength="6"></div>` : ''}
            <button type="submit" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '이메일 발송'}</button>
          </form>
          ${this.mode === 'login' ? `<div class="divider"><span>또는</span></div><button id="google-btn" class="btn-google">Google로 계속하기</button><div style="text-align:center; margin-top:15px;"><a id="forgot-link">비밀번호를 잊으셨나요?</a></div>` : ''}
          <div class="footer">${this.mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'} <a id="toggle-link">${this.mode === 'login' ? '회원가입' : '로그인으로 돌아가기'}</a></div>
        </div>
      </div>
    `;
    this.setupEventListeners();
  }
  setupEventListeners() {
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    if (closeBtn) closeBtn.onclick = () => { this.isVisible = false; this.render(); };
    const toggleLink = this.shadowRoot.getElementById('toggle-link');
    if (toggleLink) toggleLink.onclick = () => this.setMode(this.mode === 'login' ? 'signup' : 'login');
    const forgotLink = this.shadowRoot.getElementById('forgot-link');
    if (forgotLink) forgotLink.onclick = () => this.setMode('reset');
    const googleBtn = this.shadowRoot.getElementById('google-btn');
    if (googleBtn) googleBtn.onclick = async () => { try { await signInWithPopup(auth, googleProvider); } catch(e) {} };
    const form = this.shadowRoot.getElementById('auth-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = this.shadowRoot.getElementById('email').value;
        const password = this.shadowRoot.getElementById('password')?.value || '';
        const errorEl = this.shadowRoot.getElementById('error-msg');
        errorEl.style.display = 'none';
        try {
          if (this.mode === 'login') await signInWithEmailAndPassword(auth, email, password);
          else if (this.mode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
          else await sendPasswordResetEmail(auth, email);
        } catch (error) { errorEl.style.display = 'block'; errorEl.textContent = "인증 오류가 발생했습니다."; }
      };
    }
  }
}
customElements.define('login-screen', LoginScreen);

// 초기 진입점 설정
document.body.innerHTML = `<comments-section></comments-section><login-screen></login-screen><div style="position: fixed; top: -10%; left: -10%; width: 50%; height: 50%; background: var(--secondary); filter: blur(150px); opacity: 0.15; border-radius: 50%; pointer-events: none; z-index: -1;"></div><div style="position: fixed; bottom: -10%; right: -10%; width: 40%; height: 40%; background: var(--primary); filter: blur(150px); opacity: 0.1; border-radius: 50%; pointer-events: none; z-index: -1;"></div>`;
document.body.style.display = 'block';
document.body.style.overflow = 'auto';
