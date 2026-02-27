import { app, analytics, auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  updateProfile,
  sendEmailVerification
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

/* 테마 관리 로직 */
const initTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
};
const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: next } }));
};
initTheme();

/* 프로필 설정 컴포넌트 */
class ProfileSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() { this.render(); }
  render() {
    const user = auth.currentUser;
    if (!user) return;
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 500px; margin: 60px auto; padding: 20px; }
        .profile-card { background: var(--card-bg); border-radius: 24px; padding: 40px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); text-align: center; }
        h2 { color: var(--primary); margin-bottom: 30px; }
        .form-group { text-align: left; margin-bottom: 24px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.9rem; }
        input { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; font-size: 1rem; }
        .btn-save { width: 100%; padding: 16px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 12px; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .btn-back { background: none; border: none; color: var(--text-dim); cursor: pointer; margin-top: 20px; text-decoration: underline; }
      </style>
      <div class="profile-card">
        <h2>프로필 설정</h2>
        <div class="form-group"><label>이메일 계정</label><input type="text" value="${user.email}" disabled></div>
        <div class="form-group"><label>현재 닉네임</label><input type="text" id="new-nickname" value="${user.displayName || ''}" placeholder="사용할 닉네임을 입력하세요"></div>
        <button id="save-profile" class="btn-save">닉네임 변경 저장</button>
        <button id="back-to-feed" class="btn-back">피드로 돌아가기</button>
      </div>
    `;
    this.shadowRoot.getElementById('save-profile').onclick = async () => {
      const newName = this.shadowRoot.getElementById('new-nickname').value.trim();
      if (!newName) return alert("닉네임을 입력해 주세요.");
      try { await updateProfile(auth.currentUser, { displayName: newName }); alert("변경되었습니다!"); updateView('feed'); } catch (e) { alert("오류가 발생했습니다."); }
    };
    this.shadowRoot.getElementById('back-to-feed').onclick = () => updateView('feed');
  }
}
customElements.define('profile-section', ProfileSection);

/* 댓글 컴포넌트 */
class CommentsSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentUser = null; }
  connectedCallback() {
    onAuthStateChanged(auth, (user) => { this.currentUser = user; this.render(); this.loadComments(); });
    window.addEventListener('theme-changed', () => this.render());
  }
  render() {
    const isVerified = this.currentUser && (this.currentUser.emailVerified || this.currentUser.providerData[0]?.providerId === 'google.com');
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; gap: 20px; flex-wrap: wrap; }
        .user-info { display: flex; align-items: center; gap: 12px; color: var(--text-dim); font-size: 0.9rem; }
        .comment-input-card { background: var(--card-bg); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 40px; position: sticky; top: 20px; z-index: 10; }
        textarea { width: 100%; background: rgba(128,128,128,0.05); border: 2px solid transparent; border-radius: 12px; padding: 16px; color: var(--text-main); font-family: inherit; font-size: 1rem; resize: vertical; min-height: 80px; transition: 0.3s; margin-bottom: 12px; }
        textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        .btn-post { background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; float: right; transition: 0.3s; }
        .btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.3s; }
        .btn-outline:hover { background: var(--primary); color: var(--bg-color); }
        .comment-item { background: var(--card-bg); border-radius: 12px; padding: 20px; margin-bottom: 16px; border-left: 4px solid var(--primary); transition: 0.3s; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .comment-item.mine { border-left-color: var(--secondary); background: rgba(128,128,128,0.03); }
        .author { font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .content { color: var(--text-main); font-size: 1rem; line-height: 1.6; white-space: pre-wrap; margin-bottom: 12px; }
        .btn-action { background: none; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; transition: 0.2s; color: var(--text-dim); }
        .theme-toggle { background: var(--card-bg); border: 1px solid rgba(128,128,128,0.2); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.3s; }
        .theme-toggle:hover { transform: rotate(15deg) scale(1.1); }
      </style>
      <div class="header">
        <div>
          <h1 style="color:var(--primary); margin-bottom:4px; font-size:1.8rem;">SKKU Marketing Coffee Chat</h1>
          <p style="color:var(--text-dim); font-size:0.85rem;">실시간 소통 공간</p>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <button class="theme-toggle" id="theme-btn">${currentTheme === 'dark' ? '☀️' : '🌙'}</button>
          ${this.currentUser ? `
            <div class="user-info">
              <span id="profile-btn" style="color:var(--primary); cursor:pointer; text-decoration:underline;">${this.currentUser.displayName || '프로필'}</span>
              <button id="logout-btn" class="btn-outline" style="padding:6px 12px; font-size:0.8rem;">로그아웃</button>
            </div>
          ` : `
            <div class="auth-buttons" style="display:flex; gap:10px;">
              <button id="main-signup-btn" class="btn-outline" style="padding:8px 16px;">회원가입</button>
              <button id="main-login-btn" class="btn-post" style="padding:8px 16px; float:none;">로그인</button>
            </div>
          `}
        </div>
      </div>

      ${this.currentUser ? (isVerified ? `
        <div class="comment-input-card"><textarea id="comment-input" placeholder="이야기를 나눠보세요..."></textarea><button id="submit-btn" class="btn-post">메시지 전송</button></div>
      ` : `
        <div class="comment-input-card" style="text-align:center;"><p style="color:#ff4d4d; margin-bottom:10px;">⚠️ 이메일 인증이 필요합니다.</p><button id="resend-verify-btn" class="btn-outline" style="font-size:0.8rem;">인증 메일 재발송</button></div>
      `) : `<div style="text-align:center; padding:30px; border:2px dashed rgba(128,128,128,0.2); border-radius:16px; color:var(--text-dim); margin-bottom:40px;">로그인 후 참여하실 수 있습니다.</div>`}

      <div id="comment-list" class="comment-list"></div>
    `;
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.shadowRoot.getElementById('theme-btn').onclick = toggleTheme;
    if (this.shadowRoot.getElementById('logout-btn')) this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
    if (this.shadowRoot.getElementById('profile-btn')) this.shadowRoot.getElementById('profile-btn').onclick = () => updateView('profile');
    if (this.shadowRoot.getElementById('resend-verify-btn')) this.shadowRoot.getElementById('resend-verify-btn').onclick = () => sendEmailVerification(auth.currentUser);
    const lBtn = this.shadowRoot.getElementById('main-login-btn');
    const sBtn = this.shadowRoot.getElementById('main-signup-btn');
    if (lBtn) lBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'login' } }));
    if (sBtn) sBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'signup' } }));
    const subBtn = this.shadowRoot.getElementById('submit-btn');
    if (subBtn) {
      subBtn.onclick = async () => {
        const input = this.shadowRoot.getElementById('comment-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "comments"), { content: input.value.trim(), authorEmail: this.currentUser.email, authorName: this.currentUser.displayName || "익명", authorUid: this.currentUser.uid, createdAt: serverTimestamp() });
        input.value = '';
      };
    }
  }
  loadComments() {
    const listEl = this.shadowRoot.getElementById('comment-list');
    onSnapshot(query(collection(db, "comments"), orderBy("createdAt", "desc")), (snapshot) => {
      listEl.innerHTML = snapshot.empty ? '<p style="text-align:center; color:var(--text-dim)">첫 메시지를 남겨보세요!</p>' : '';
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const isMine = this.currentUser && data.authorUid === this.currentUser.uid;
        const item = document.createElement('div');
        item.className = `comment-item ${isMine ? 'mine' : ''}`;
        item.innerHTML = `
          <div class="author"><span>${data.authorName || data.authorEmail}${isMine ? ' (나)' : ''}</span><span style="color:var(--text-dim); font-size:0.75rem;">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전'}</span></div>
          <div class="content" id="content-${id}">${this.escapeHTML(data.content)}</div>
          ${isMine ? `<div class="actions" id="actions-${id}"><button class="btn-action" id="edit-${id}">수정</button><button class="btn-action" id="del-${id}" style="color:#ff4d4d">삭제</button></div>` : ''}
        `;
        listEl.appendChild(item);
        if (isMine) {
          this.shadowRoot.getElementById(`del-${id}`).onclick = () => deleteDoc(doc(db, "comments", id));
          this.shadowRoot.getElementById(`edit-${id}`).onclick = () => this.startEdit(id, data.content);
        }
      });
    });
  }
  async startEdit(id, old) {
    const cEl = this.shadowRoot.getElementById(`content-${id}`);
    const aEl = this.shadowRoot.getElementById(`actions-${id}`);
    const oC = cEl.innerHTML; const oA = aEl.innerHTML;
    cEl.innerHTML = `<textarea id="in-${id}" style="min-height:60px; margin-top:10px;">${old}</textarea>`;
    aEl.innerHTML = `<button class="btn-action" id="can-${id}">취소</button><button class="btn-action" id="sav-${id}" style="color:var(--primary); font-weight:700">저장</button>`;
    this.shadowRoot.getElementById(`can-${id}`).onclick = () => { cEl.innerHTML = oC; aEl.innerHTML = oA; this.loadComments(); };
    this.shadowRoot.getElementById(`sav-${id}`).onclick = async () => { const val = this.shadowRoot.getElementById(`in-${id}`).value.trim(); if (val) await updateDoc(doc(db, "comments", id), { content: val }); };
  }
  escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
}
customElements.define('comments-section', CommentsSection);

/* 로그인 화면 컴포넌트 */
class LoginScreen extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.mode = 'login'; this.isVisible = false; }
  connectedCallback() {
    window.addEventListener('show-login', (e) => { this.isVisible = true; if (e.detail?.mode) this.mode = e.detail.mode; this.render(); });
    onAuthStateChanged(auth, (user) => { if (user && (user.emailVerified || user.providerData[0]?.providerId === 'google.com')) { this.isVisible = false; this.render(); } });
    this.render();
  }
  setMode(mode) { this.mode = mode; this.render(); }
  render() {
    if (!this.isVisible) { this.shadowRoot.innerHTML = ''; return; }
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .login-card { background: var(--card-bg); border-radius: 24px; padding: 40px; width: 90%; max-width: 400px; box-shadow: var(--shadow-deep); position: relative; border: 1px solid rgba(128,128,128,0.1); }
        h2 { text-align: center; margin-bottom: 24px; color: var(--primary); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.85rem; }
        input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; }
        .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; }
        .btn-close { position: absolute; top: 15px; right: 15px; color: var(--text-dim); cursor: pointer; background: none; border: none; font-size: 1.5rem; }
        .divider { text-align: center; margin: 20px 0; color: var(--text-dim); font-size: 0.8rem; border-bottom: 1px solid rgba(128,128,128,0.1); line-height: 0.1em; }
        .divider span { background: var(--card-bg); padding: 0 10px; }
        .btn-google { width: 100%; padding: 12px; background: #fff; color: #000; border: 1px solid #ddd; border-radius: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .footer { text-align: center; margin-top: 24px; font-size: 0.85rem; color: var(--text-dim); }
        a { color: var(--primary); cursor: pointer; text-decoration: underline; }
      </style>
      <div class="overlay">
        <div class="login-card">
          <button class="btn-close" id="close-btn">&times;</button>
          <h2>${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '회원가입' : '비밀번호 찾기'}</h2>
          <form id="auth-form">
            ${this.mode === 'signup' ? `<div class="form-group"><label>닉네임</label><input type="text" id="nickname" placeholder="홍길동" required></div>` : ''}
            <div class="form-group"><label>이메일</label><input type="email" id="email" required></div>
            ${this.mode !== 'reset' ? `<div class="form-group"><label>비밀번호</label><input type="password" id="password" required minlength="6"></div>` : ''}
            <button type="submit" id="submit-btn" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '이메일 발송'}</button>
          </form>
          <div class="divider"><span>또는</span></div>
          <button id="google-btn" class="btn-google"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> Google로 계속하기</button>
          <div class="footer">${this.mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'} <a id="toggle-link">${this.mode === 'login' ? '회원가입' : '로그인'}</a></div>
        </div>
      </div>
    `;
    this.shadowRoot.getElementById('close-btn').onclick = () => { this.isVisible = false; this.render(); };
    this.shadowRoot.getElementById('toggle-link').onclick = () => this.setMode(this.mode === 'login' ? 'signup' : 'login');
    this.shadowRoot.getElementById('google-btn').onclick = async () => { try { googleProvider.setCustomParameters({ prompt: 'select_account' }); await signInWithPopup(auth, googleProvider); } catch(e) {} };
    this.shadowRoot.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const sBtn = this.shadowRoot.getElementById('submit-btn');
      const email = this.shadowRoot.getElementById('email').value;
      const password = this.shadowRoot.getElementById('password')?.value || '';
      const nickname = this.shadowRoot.getElementById('nickname')?.value;
      try {
        if (this.mode === 'login') {
          const res = await signInWithEmailAndPassword(auth, email, password);
          if (!res.user.emailVerified) alert("이메일 인증이 필요합니다.");
        } else if (this.mode === 'signup') {
          const res = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(res.user, { displayName: nickname });
          await sendEmailVerification(res.user);
          alert("인증 메일 발송! 확인 후 로그인해 주세요.");
          await signOut(auth);
        } else await sendPasswordResetEmail(auth, email);
      } catch (error) { alert("오류가 발생했습니다."); } finally { this.render(); }
    };
  }
}
customElements.define('login-screen', LoginScreen);

const updateView = (view) => { const container = document.getElementById('main-container'); container.innerHTML = view === 'feed' ? '<comments-section></comments-section>' : '<profile-section></profile-section>'; };
window.addEventListener('show-view', (e) => updateView(e.detail.view));
document.body.innerHTML = `<div id="main-container"><comments-section></comments-section></div><login-screen></login-screen><div style="position: fixed; top: -10%; left: -10%; width: 50%; height: 50%; background: var(--secondary); filter: blur(150px); opacity: 0.15; border-radius: 50%; pointer-events: none; z-index: -1;"></div><div style="position: fixed; bottom: -10%; right: -10%; width: 40%; height: 40%; background: var(--primary); filter: blur(150px); opacity: 0.1; border-radius: 50%; pointer-events: none; z-index: -1;"></div>`;
