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
  updateDoc,
  arrayUnion,
  arrayRemove,
  where,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 테마 관리 */
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

// DiceBear 아바타 URL 생성 함수
const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || 'default'}`;

/* 프로필 설정 컴포넌트 */
class ProfileSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentSeed = ''; }
  connectedCallback() { this.render(); }
  render() {
    const user = auth.currentUser;
    if (!user) return;
    if (!this.currentSeed) {
      // 기존 photoURL에서 seed 추출 시도 (없으면 기본값)
      const url = user.photoURL || '';
      const match = url.match(/seed=([^&]+)/);
      this.currentSeed = match ? match[1] : user.uid.substring(0, 5);
    }

    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; max-width: 500px; margin: 60px auto; padding: 20px; }
        .profile-card { background: var(--card-bg); border-radius: 24px; padding: 40px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); text-align: center; }
        h2 { color: var(--primary); margin-bottom: 30px; }
        
        .avatar-container { margin-bottom: 30px; }
        .avatar-preview { width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--primary); background: #f0f0f0; margin-bottom: 15px; }
        
        .avatar-controls { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
        .seed-input { padding: 10px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); width: 150px; text-align: center; }
        .btn-random { background: var(--secondary); color: #000; border: none; border-radius: 8px; padding: 10px 15px; cursor: pointer; font-weight: 700; font-size: 0.8rem; }

        .form-group { text-align: left; margin-bottom: 24px; }
        label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 0.9rem; }
        input[type="text"] { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; font-size: 1rem; }
        .btn-save { width: 100%; padding: 16px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 12px; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .btn-back { background: none; border: none; color: var(--text-dim); cursor: pointer; margin-top: 20px; text-decoration: underline; }
      </style>
      <div class="profile-card">
        <h2>내 아바타 만들기</h2>
        
        <div class="avatar-container">
          <img class="avatar-preview" id="preview" src="${getAvatarUrl(this.currentSeed)}">
          <div class="avatar-controls">
            <input type="text" id="seed-input" class="seed-input" value="${this.currentSeed}" placeholder="고유 키워드">
            <button id="random-btn" class="btn-random">🎲 랜덤</button>
          </div>
          <p style="color:var(--text-dim); font-size:0.75rem;">나만의 키워드를 입력하거나 랜덤 버튼을 눌러보세요!</p>
        </div>

        <div class="form-group">
          <label>사용할 닉네임</label>
          <input type="text" id="new-nickname" value="${user.displayName || ''}">
        </div>
        
        <button id="save-profile" class="btn-save">모든 변경 내용 저장</button>
        <button id="back-to-feed" class="btn-back">피드로 돌아가기</button>
      </div>
    `;

    const seedInput = this.shadowRoot.getElementById('seed-input');
    const preview = this.shadowRoot.getElementById('preview');
    const randomBtn = this.shadowRoot.getElementById('random-btn');

    // 키워드 입력 시 즉시 아바타 변경
    seedInput.oninput = (e) => {
      this.currentSeed = e.target.value;
      preview.src = getAvatarUrl(this.currentSeed);
    };

    // 랜덤 버튼 클릭 시 무작위 시드 생성
    randomBtn.onclick = () => {
      this.currentSeed = Math.random().toString(36).substring(7);
      seedInput.value = this.currentSeed;
      preview.src = getAvatarUrl(this.currentSeed);
    };

    this.shadowRoot.getElementById('save-profile').onclick = async () => {
      const newName = this.shadowRoot.getElementById('new-nickname').value.trim();
      const btn = this.shadowRoot.getElementById('save-profile');
      btn.disabled = true; btn.textContent = "저장 중...";

      try {
        const photoURL = getAvatarUrl(this.currentSeed);
        
        // 1. Auth 프로필 업데이트
        await updateProfile(user, { displayName: newName, photoURL: photoURL });

        // 2. 과거 댓글 일괄 업데이트
        const q = query(collection(db, "comments"), where("authorUid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((docSnap) => {
            batch.update(docSnap.ref, { authorName: newName, authorPhoto: photoURL });
          });
          await batch.commit();
        }

        alert("아바타와 프로필이 저장되었습니다!");
        location.reload();
      } catch (e) {
        alert("저장 실패");
      } finally {
        btn.disabled = false; btn.textContent = "모든 변경 내용 저장";
      }
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
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .nav-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary); background: #eee; }
        .comment-input-card { background: var(--card-bg); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 40px; position: sticky; top: 20px; z-index: 10; }
        textarea { width: 100%; background: rgba(128,128,128,0.05); border: 2px solid transparent; border-radius: 12px; padding: 16px; color: var(--text-main); font-family: inherit; font-size: 1rem; resize: vertical; min-height: 80px; transition: 0.3s; margin-bottom: 12px; }
        textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
        .btn-post { background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; float: right; transition: 0.3s; }
        .comment-item { background: var(--card-bg); border-radius: 12px; padding: 20px; margin-bottom: 12px; border-left: 4px solid var(--primary); transition: 0.3s; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .comment-item.is-reply { margin-left: 40px; border-left-color: var(--secondary); background: rgba(128,128,128,0.02); }
        .item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .item-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: #eee; }
        .author-name { font-weight: 700; color: var(--primary); font-size: 0.9rem; }
        .timestamp { font-size: 0.7rem; color: var(--text-dim); }
        .footer-actions { display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-dim); align-items: center; }
        .action-link { cursor: pointer; transition: 0.2s; user-select: none; }
        .action-link:hover { color: var(--primary); }
        .theme-toggle { background: var(--card-bg); border: 1px solid rgba(128,128,128,0.2); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 700; }
      </style>
      <div class="header">
        <div><h1 style="color:var(--primary); margin-bottom:4px; font-size:1.8rem;">SKKU Coffee Chat</h1><p style="color:var(--text-dim); font-size:0.85rem;">실시간 소통 공간</p></div>
        <div style="display:flex; align-items:center; gap:12px;">
          <button class="theme-toggle" id="theme-btn">${currentTheme === 'dark' ? '☀️' : '🌙'}</button>
          ${this.currentUser ? `
            <div class="user-info">
              <img class="nav-avatar" src="${this.currentUser.photoURL || getAvatarUrl('default')}">
              <span id="profile-btn" style="color:var(--primary); cursor:pointer; font-weight:600; text-decoration:underline;">${this.currentUser.displayName || '닉네임 설정'}</span>
              <button id="logout-btn" class="btn-outline" style="font-size:0.8rem;">로그아웃</button>
            </div>
          ` : `
            <button id="main-signup-btn" class="btn-outline">회원가입</button>
            <button id="main-login-btn" class="btn-post" style="float:none;">로그인</button>
          `}
        </div>
      </div>
      ${this.currentUser ? (isVerified ? `
        <div class="comment-input-card"><textarea id="main-input" placeholder="새로운 이야기를 시작해보세요..."></textarea><button id="main-submit" class="btn-post">게시하기</button></div>
      ` : `
        <div class="comment-input-card" style="text-align:center;"><p style="color:#ff4d4d; margin-bottom:10px;">⚠️ 이메일 인증이 필요합니다.</p><button id="resend-verify" class="btn-outline">인증 메일 재발송</button></div>
      `) : `<div style="text-align:center; padding:30px; border:2px dashed rgba(128,128,128,0.2); border-radius:16px; color:var(--text-dim); margin-bottom:40px;">로그인 후 참여하세요.</div>`}
      <div id="comment-list" class="comment-list"></div>
    `;
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.shadowRoot.getElementById('theme-btn').onclick = toggleTheme;
    if (this.shadowRoot.getElementById('logout-btn')) this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
    if (this.shadowRoot.getElementById('profile-btn')) this.shadowRoot.getElementById('profile-btn').onclick = () => updateView('profile');
    if (this.shadowRoot.getElementById('resend-verify')) this.shadowRoot.getElementById('resend-verify').onclick = () => sendEmailVerification(auth.currentUser);
    const lBtn = this.shadowRoot.getElementById('main-login-btn');
    const sBtn = this.shadowRoot.getElementById('main-signup-btn');
    if (lBtn) lBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'login' } }));
    if (sBtn) sBtn.onclick = () => window.dispatchEvent(new CustomEvent('show-login', { detail: { mode: 'signup' } }));
    const subBtn = this.shadowRoot.getElementById('main-submit');
    if (subBtn) subBtn.onclick = () => this.postComment(this.shadowRoot.getElementById('main-input'));
  }
  async postComment(inputEl, pid = null) {
    const text = inputEl.value.trim();
    if (!text || !this.currentUser) return;
    try {
      await addDoc(collection(db, "comments"), { 
        content: text, authorName: this.currentUser.displayName || "익명", authorUid: this.currentUser.uid, 
        authorPhoto: this.currentUser.photoURL || getAvatarUrl('default'),
        createdAt: serverTimestamp(), parentId: pid, likes: [] 
      });
      inputEl.value = '';
    } catch (e) { alert("오류 발생"); }
  }
  loadComments() {
    const listEl = this.shadowRoot.getElementById('comment-list');
    onSnapshot(query(collection(db, "comments"), orderBy("createdAt", "asc")), (snapshot) => {
      const all = []; snapshot.forEach(d => all.push({ id: d.id, ...d.data() }));
      const parents = all.filter(c => !c.parentId);
      listEl.innerHTML = parents.length === 0 ? '<p style="text-align:center; color:var(--text-dim)">글이 없습니다.</p>' : '';
      parents.reverse().forEach(p => {
        this.renderItem(listEl, p, false);
        all.filter(c => c.parentId === p.id).forEach(r => this.renderItem(listEl, r, true));
      });
    });
  }
  renderItem(container, data, isReply) {
    const isMine = this.currentUser && data.authorUid === this.currentUser.uid;
    const isLiked = this.currentUser && data.likes?.includes(this.currentUser.uid);
    const id = data.id;
    const item = document.createElement('div');
    item.className = `comment-item ${isReply ? 'is-reply' : ''}`;
    const avatar = data.authorPhoto || getAvatarUrl('default');
    item.innerHTML = `
      <div class="item-header"><img class="item-avatar" src="${avatar}"><div style="display:flex; flex-direction:column;"><span class="author-name">${data.authorName}${isMine ? ' (나)' : ''}</span><span class="timestamp">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전'}</span></div></div>
      <div class="content" id="content-${id}">${this.escapeHTML(data.content)}</div>
      <div class="footer-actions" id="actions-${id}">
        <div class="action-link" id="like-${id}" style="color:${isLiked ? '#ff4d4d' : 'var(--text-dim)'}">❤️ 좋아요 ${data.likes?.length || 0}</div>
        ${!isReply ? `<div class="action-link" id="rep-${id}">💬 답글</div>` : ''}
        ${isMine ? `<div class="action-link" id="ed-${id}">수정</div><div class="action-link" style="color:#ff4d4d" id="del-${id}">삭제</div>` : ''}
      </div>
      <div id="reply-box-${id}"></div>
    `;
    container.appendChild(item);
    this.shadowRoot.getElementById(`like-${id}`).onclick = async () => { if (!this.currentUser) return window.dispatchEvent(new CustomEvent('show-login')); await updateDoc(doc(db, "comments", id), { likes: isLiked ? arrayRemove(this.currentUser.uid) : arrayUnion(this.currentUser.uid) }); };
    if (!isReply) this.shadowRoot.getElementById(`rep-${id}`).onclick = () => this.showReplyBox(id);
    if (isMine) {
      this.shadowRoot.getElementById(`del-${id}`).onclick = async () => { if (confirm("삭제?")) await deleteDoc(doc(db, "comments", id)); };
      this.shadowRoot.getElementById(`ed-${id}`).onclick = () => this.startEdit(id, data.content);
    }
  }
  showReplyBox(pid) {
    const box = this.shadowRoot.getElementById(`reply-box-${pid}`);
    if (box.innerHTML !== '') { box.innerHTML = ''; return; }
    box.innerHTML = `<div style="margin-top:15px;"><textarea id="rin-${pid}" placeholder="답글 작성..."></textarea><div style="display:flex; justify-content:flex-end; gap:10px;"><button class="btn-outline" style="font-size:0.8rem; padding:5px 12px;" id="rcan-${pid}">취소</button><button class="btn-post" style="font-size:0.8rem; padding:5px 12px;" id="rsub-${pid}">등록</button></div></div>`;
    this.shadowRoot.getElementById(`rcan-${pid}`).onclick = () => box.innerHTML = '';
    this.shadowRoot.getElementById(`rsub-${pid}`).onclick = () => this.postComment(this.shadowRoot.getElementById(`rin-${pid}`), pid);
  }
  async startEdit(id, old) {
    const cEl = this.shadowRoot.getElementById(`content-${id}`);
    const aEl = this.shadowRoot.getElementById(`actions-${id}`);
    const oC = cEl.innerHTML; const oA = aEl.innerHTML;
    cEl.innerHTML = `<textarea id="in-${id}">${old}</textarea>`;
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
        .login-card { background: var(--card-bg); border-radius: 24px; padding: 40px; width: 90%; max-width: 400px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); }
        h2 { text-align: center; margin-bottom: 24px; color: var(--primary); }
        input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; margin-bottom: 15px; }
        .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; }
        .btn-close { position: absolute; top: 15px; right: 15px; color: var(--text-dim); cursor: pointer; background: none; border: none; font-size: 1.5rem; }
        .btn-google { width: 100%; padding: 12px; background: #fff; color: #000; border: 1px solid #ddd; border-radius: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; }
      </style>
      <div class="overlay"><div class="login-card" style="position:relative;"><button class="btn-close" id="close-btn">&times;</button><h2>${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '회원가입' : '비밀번호 찾기'}</h2><form id="auth-form">${this.mode === 'signup' ? `<input type="text" id="nickname" placeholder="닉네임" required>` : ''}<input type="email" id="email" placeholder="이메일" required>${this.mode !== 'reset' ? `<input type="password" id="password" placeholder="비밀번호" required minlength="6">` : ''}<button type="submit" id="submit-btn" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '발송'}</button></form><button id="google-btn" class="btn-google"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> Google 계정 사용</button><div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-dim);"><a id="toggle-link" style="color:var(--primary); cursor:pointer;">${this.mode === 'login' ? '회원가입 하러가기' : '로그인 하러가기'}</a></div></div></div>
    `;
    this.shadowRoot.getElementById('close-btn').onclick = () => { this.isVisible = false; this.render(); };
    this.shadowRoot.getElementById('toggle-link').onclick = () => this.setMode(this.mode === 'login' ? 'signup' : 'login');
    this.shadowRoot.getElementById('google-btn').onclick = async () => { try { googleProvider.setCustomParameters({ prompt: 'select_account' }); await signInWithPopup(auth, googleProvider); } catch(e) {} };
    this.shadowRoot.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
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
      } catch (error) { alert("오류 발생"); } finally { this.render(); }
    };
  }
}
customElements.define('login-screen', LoginScreen);

const updateView = (v) => { document.getElementById('main-container').innerHTML = v === 'feed' ? '<comments-section></comments-section>' : '<profile-section></profile-section>'; };
document.body.innerHTML = `<div id="main-container"><comments-section></comments-section></div><login-screen></login-screen><div style="position: fixed; top: -10%; left: -10%; width: 50%; height: 50%; background: var(--secondary); filter: blur(150px); opacity: 0.15; border-radius: 50%; pointer-events: none; z-index: -1;"></div><div style="position: fixed; bottom: -10%; right: -10%; width: 40%; height: 40%; background: var(--primary); filter: blur(150px); opacity: 0.1; border-radius: 50%; pointer-events: none; z-index: -1;"></div>`;
