import { app, analytics, auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile
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

/* 프로필 설정 컴포넌트 */
class ProfileSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const user = auth.currentUser;
    if (!user) return;

    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 500px; margin: 60px auto; padding: 20px; }
        .profile-card { background: var(--card-bg); border-radius: 24px; padding: 40px; box-shadow: var(--shadow-deep); border: 1px solid rgba(255,255,255,0.1); text-align: center; }
        h2 { color: var(--primary); margin-bottom: 30px; }
        .form-group { text-align: left; margin-bottom: 24px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.9rem; }
        input { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; box-sizing: border-box; font-size: 1rem; }
        .btn-save { width: 100%; padding: 16px; background: var(--primary); color: #000; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .btn-back { background: none; border: none; color: var(--text-dim); cursor: pointer; margin-top: 20px; text-decoration: underline; }
      </style>
      <div class="profile-card">
        <h2>프로필 설정</h2>
        <div class="form-group">
          <label>이메일 계정</label>
          <input type="text" value="${user.email}" disabled style="opacity: 0.5;">
        </div>
        <div class="form-group">
          <label>현재 닉네임</label>
          <input type="text" id="new-nickname" value="${user.displayName || ''}" placeholder="사용할 닉네임을 입력하세요">
        </div>
        <button id="save-profile" class="btn-save">닉네임 변경 저장</button>
        <button id="back-to-feed" class="btn-back">피드로 돌아가기</button>
      </div>
    `;

    this.shadowRoot.getElementById('save-profile').onclick = async () => {
      const newName = this.shadowRoot.getElementById('new-nickname').value.trim();
      if (!newName) return alert("닉네임을 입력해 주세요.");
      try {
        await updateProfile(auth.currentUser, { displayName: newName });
        alert("닉네임이 변경되었습니다!");
        window.dispatchEvent(new CustomEvent('show-view', { detail: { view: 'feed' } }));
      } catch (e) { alert("저장 중 오류가 발생했습니다."); }
    };

    this.shadowRoot.getElementById('back-to-feed').onclick = () => {
      window.dispatchEvent(new CustomEvent('show-view', { detail: { view: 'feed' } }));
    };
  }
}
customElements.define('profile-section', ProfileSection);

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
        .comment-input-card { background: var(--card-bg); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-deep); border: 1px solid oklch(1 0 0 / 0.1); margin-bottom: 40px; position: sticky; top: 20px; z-index: 10; }
        textarea { width: 100%; background: rgba(0,0,0,0.2); border: 2px solid transparent; border-radius: 12px; padding: 16px; color: #fff; font-family: inherit; font-size: 1rem; resize: vertical; min-height: 80px; transition: 0.3s; margin-bottom: 12px; }
        textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        .btn-post { background: var(--primary); color: #000; font-weight: 700; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; float: right; transition: 0.3s; }
        .btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.3s; }
        .btn-outline:hover { background: var(--primary); color: #000; }
        .comment-list { margin-top: 20px; clear: both; }
        .comment-item { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px; border-left: 4px solid var(--primary); transition: 0.3s; position: relative; }
        .comment-item.mine { border-left-color: var(--accent); background: rgba(255,255,255,0.08); }
        .author { font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .comment-item.mine .author { color: var(--accent); }
        .content { color: var(--text-main); font-size: 1rem; line-height: 1.6; white-space: pre-wrap; margin-bottom: 12px; }
        .actions { display: flex; gap: 12px; font-size: 0.8rem; justify-content: flex-end; }
        .btn-action { background: none; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; transition: 0.2s; color: var(--text-dim); }
        .btn-edit { color: var(--primary); }
        .btn-delete { color: #ff4d4d; }
        .timestamp { color: var(--text-dim); font-size: 0.75rem; font-weight: 400; }
        .btn-profile { color: var(--primary); cursor: pointer; text-decoration: underline; margin-right: 10px; }
      </style>
      <div class="header">
        <div><h1 style="color:var(--text-main); margin-bottom:4px; font-size:1.8rem;">SKKU Marketing Coffee Chat</h1><p style="color:var(--text-dim); font-size:0.85rem;">성균관대 마케팅 학우들을 위한 실시간 소통 공간</p></div>
        ${this.currentUser ? `
          <div class="user-info">
            <span id="profile-btn" class="btn-profile">${this.currentUser.displayName || '프로필 설정'}</span>
            <button id="logout-btn" class="btn-outline" style="padding:6px 12px; font-size:0.8rem;">로그아웃</button>
          </div>
        ` : `
          <div class="auth-buttons">
            <button id="main-signup-btn" class="btn-outline">회원가입</button>
            <button id="main-login-btn" class="btn-post" style="float:none;">로그인</button>
          </div>
        `}
      </div>
      ${this.currentUser ? `
        <div class="comment-input-card"><textarea id="comment-input" placeholder="커피 한 잔 하며 나누고 싶은 이야기를 적어주세요..."></textarea><button id="submit-btn" class="btn-post">메시지 전송</button></div>
      ` : `
        <div style="text-align:center; padding:30px; border:2px dashed rgba(255,255,255,0.1); border-radius:16px; color:var(--text-dim); margin-bottom:40px;">메시지를 작성하려면 로그인이 필요합니다.</div>
      `}
      <div id="comment-list" class="comment-list"><p style="text-align:center; color:var(--text-dim)">이야기를 불러오는 중...</p></div>
    `;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.shadowRoot.getElementById('logout-btn')) this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
    if (this.shadowRoot.getElementById('profile-btn')) this.shadowRoot.getElementById('profile-btn').onclick = () => {
      window.dispatchEvent(new CustomEvent('show-view', { detail: { view: 'profile' } }));
    };
    
    const loginBtn = this.shadowRoot.getElementById('main-login-btn');
    const signupBtn = this.shadowRoot.getElementById('main-signup-btn');
    if (loginBtn) loginBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'login' } }));
    if (signupBtn) signupBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'signup' } }));

    const submitBtn = this.shadowRoot.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const input = this.shadowRoot.getElementById('comment-input');
        const text = input.value.trim();
        if (!text || !this.currentUser) return;
        try {
          await addDoc(collection(db, "comments"), { 
            content: text, 
            authorEmail: this.currentUser.email,
            authorName: this.currentUser.displayName || "익명",
            authorUid: this.currentUser.uid, 
            createdAt: serverTimestamp() 
          });
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
          <div class="author">
            <span>${data.authorName || data.authorEmail}${isMine ? ' <span style="color:var(--accent); font-size:0.7rem;">(나)</span>' : ''}</span>
            <span class="timestamp">${date}</span>
          </div>
          <div class="content" id="content-${id}">${this.escapeHTML(data.content)}</div>
          ${isMine ? `<div class="actions" id="actions-${id}"><button class="btn-action btn-edit" id="btn-edit-${id}">수정</button><button class="btn-action btn-delete" id="btn-delete-${id}">삭제</button></div>` : ''}
        `;
        listEl.appendChild(item);
        if (isMine) {
          this.shadowRoot.getElementById(`btn-delete-${id}`).onclick = () => this.deleteComment(id);
          this.shadowRoot.getElementById(`btn-edit-${id}`).onclick = () => this.startEdit(id, data.content);
        }
      });
    });
  }

  async deleteComment(id) {
    if (confirm("정말로 삭제하시겠습니까?")) await deleteDoc(doc(db, "comments", id));
  }

  async startEdit(id, oldContent) {
    const contentEl = this.shadowRoot.getElementById(`content-${id}`);
    const actionsEl = this.shadowRoot.getElementById(`actions-${id}`);
    const originalContentHTML = contentEl.innerHTML;
    const originalActionsHTML = actionsEl.innerHTML;
    contentEl.innerHTML = `<textarea id="edit-input-${id}" style="min-height:60px; margin-top:10px; margin-bottom:0;">${oldContent}</textarea>`;
    actionsEl.innerHTML = `<button class="btn-action" id="btn-cancel-${id}">취소</button><button class="btn-action btn-edit" id="btn-save-${id}" style="font-weight:700">저장</button>`;
    this.shadowRoot.getElementById(`btn-cancel-${id}`).onclick = () => { contentEl.innerHTML = originalContentHTML; actionsEl.innerHTML = originalActionsHTML; this.loadComments(); };
    this.shadowRoot.getElementById(`btn-save-${id}`).onclick = async () => {
      const newContent = this.shadowRoot.getElementById(`edit-input-${id}`).value.trim();
      if (newContent) await updateDoc(doc(db, "comments", id), { content: newContent });
    };
  }

  escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
}
customElements.define('comments-section', CommentsSection);

/* 로그인 화면 컴포넌트 */
class LoginScreen extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.mode = 'login'; this.isVisible = false; }
  connectedCallback() {
    window.addEventListener('show-login', (e) => { this.isVisible = true; if (e.detail?.mode) this.mode = e.detail.mode; this.render(); });
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
        .login-card { background: var(--card-bg); border-radius: 24px; padding: 40px; width: 90%; max-width: 400px; box-shadow: var(--shadow-deep); position: relative; }
        h2 { text-align: center; margin-bottom: 24px; color: var(--text-main); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.85rem; }
        input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; box-sizing: border-box; }
        .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: #000; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; }
        .btn-close { position: absolute; top: 15px; right: 15px; color: #fff; cursor: pointer; background: none; border: none; font-size: 1.5rem; }
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
            <button type="submit" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '이메일 발송'}</button>
          </form>
          <div class="footer">${this.mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'} <a id="toggle-link">${this.mode === 'login' ? '회원가입' : '로그인'}</a></div>
        </div>
      </div>
    `;
    this.shadowRoot.getElementById('close-btn').onclick = () => { this.isVisible = false; this.render(); };
    this.shadowRoot.getElementById('toggle-link').onclick = () => this.setMode(this.mode === 'login' ? 'signup' : 'login');
    this.shadowRoot.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = this.shadowRoot.getElementById('email').value;
      const password = this.shadowRoot.getElementById('password')?.value || '';
      const nickname = this.shadowRoot.getElementById('nickname')?.value;
      try {
        if (this.mode === 'login') await signInWithEmailAndPassword(auth, email, password);
        else if (this.mode === 'signup') {
          const res = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(res.user, { displayName: nickname });
          alert("가입을 환영합니다, " + nickname + "님!");
        } else await sendPasswordResetEmail(auth, email);
      } catch (error) { alert("인증 오류가 발생했습니다."); }
    };
  }
}
customElements.define('login-screen', LoginScreen);

// 메인 뷰 관리
const updateView = (view) => {
  const container = document.getElementById('main-container');
  container.innerHTML = view === 'feed' ? '<comments-section></comments-section>' : '<profile-section></profile-section>';
};
window.addEventListener('show-view', (e) => updateView(e.detail.view));

document.body.innerHTML = `
  <div id="main-container"><comments-section></comments-section></div>
  <login-screen></login-screen>
  <div style="position: fixed; top: -10%; left: -10%; width: 50%; height: 50%; background: var(--secondary); filter: blur(150px); opacity: 0.15; border-radius: 50%; pointer-events: none; z-index: -1;"></div>
  <div style="position: fixed; bottom: -10%; right: -10%; width: 40%; height: 40%; background: var(--primary); filter: blur(150px); opacity: 0.1; border-radius: 50%; pointer-events: none; z-index: -1;"></div>
`;
