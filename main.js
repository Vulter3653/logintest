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

/* 게시판 정의 */
const BOARDS = [
  { id: 'free', name: '자유게시판', icon: '💬' },
  { id: 'info', name: '정보공유', icon: '💡' },
  { id: 'qna', name: '질문답변', icon: '❓' },
  { id: 'club', name: '학회/동아리', icon: '🤝' }
];

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

const getAvatarUrl = (style, seed) => `https://api.dicebear.com/7.x/${style || 'avataaars'}/svg?seed=${seed || 'default'}`;

/* 프로필 설정 컴포넌트 */
class ProfileSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentStyle = 'avataaars'; this.currentSeed = ''; }
  connectedCallback() { this.render(); }
  render() {
    const user = auth.currentUser;
    if (!user) return;
    if (!this.currentSeed) {
      const url = user.photoURL || '';
      const styleMatch = url.match(/\/7\.x\/([^/]+)\//);
      const seedMatch = url.match(/seed=([^&]+)/);
      this.currentStyle = styleMatch ? styleMatch[1] : 'avataaars';
      this.currentSeed = seedMatch ? seedMatch[1] : user.uid.substring(0, 5);
    }
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; padding: 40px 0; }
        .profile-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: clamp(20px, 5%, 40px); box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); text-align: center; }
        .avatar-box { margin-bottom: 30px; padding: 20px; background: rgba(128,128,128,0.05); border-radius: 20px; }
        .avatar-preview { width: min(120px, 30vw); height: min(120px, 30vw); border-radius: 50%; border: 4px solid var(--primary); background: #fff; margin-bottom: 20px; }
        .controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        select, .seed-input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(128,128,128,0.2); background: var(--card-bg); color: var(--text-main); font-size: 0.9rem; }
        .btn-save { width: 100%; padding: 16px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 12px; cursor: pointer; margin-top: 20px; transition: 0.3s; }
        @media (max-width: 480px) { .controls-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="profile-card">
        <h2>내 아바타 커스텀</h2>
        <div class="avatar-box">
          <img class="avatar-preview" id="preview" src="${getAvatarUrl(this.currentStyle, this.currentSeed)}">
          <div class="controls-grid">
            <select id="style-select">
              <option value="avataaars" ${this.currentStyle === 'avataaars' ? 'selected' : ''}>사람</option>
              <option value="bottts" ${this.currentStyle === 'bottts' ? 'selected' : ''}>로봇</option>
              <option value="pixel-art" ${this.currentStyle === 'pixel-art' ? 'selected' : ''}>픽셀</option>
              <option value="lorelei" ${this.currentStyle === 'lorelei' ? 'selected' : ''}>귀여운</option>
            </select>
            <input type="text" id="seed-input" class="seed-input" value="${this.currentSeed}">
          </div>
        </div>
        <div style="text-align:left; margin-bottom:20px;"><label style="display:block; margin-bottom:8px; font-size:0.9rem; color:var(--text-dim);">닉네임</label><input type="text" id="new-nickname" value="${user.displayName || ''}" style="width:100%; padding:14px; border-radius:12px; border:1px solid rgba(128,128,128,0.2); background:rgba(128,128,128,0.05); color:var(--text-main);"></div>
        <button id="save-profile" class="btn-save">모든 설정 저장하기</button>
        <button id="back-to-feed" style="background:none; border:none; color:var(--text-dim); cursor:pointer; margin-top:20px; text-decoration:underline;">피드로 돌아가기</button>
      </div>
    `;
    const update = () => { this.currentStyle = this.shadowRoot.getElementById('style-select').value; this.currentSeed = this.shadowRoot.getElementById('seed-input').value; this.shadowRoot.getElementById('preview').src = getAvatarUrl(this.currentStyle, this.currentSeed); };
    this.shadowRoot.getElementById('style-select').onchange = update; this.shadowRoot.getElementById('seed-input').oninput = update;
    this.shadowRoot.getElementById('save-profile').onclick = async () => {
      const newName = this.shadowRoot.getElementById('new-nickname').value.trim();
      const photoURL = getAvatarUrl(this.currentStyle, this.currentSeed);
      try {
        await updateProfile(user, { displayName: newName, photoURL });
        const q = query(collection(db, "comments"), where("authorUid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach(d => batch.update(d.ref, { authorName: newName, authorPhoto: photoURL }));
          await batch.commit();
        }
        alert("저장되었습니다!"); location.reload();
      } catch (e) { alert("저장 실패"); }
    };
    this.shadowRoot.getElementById('back-to-feed').onclick = () => updateView('feed');
  }
}
customElements.define('profile-section', ProfileSection);

/* 댓글 컴포넌트 */
class CommentsSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentUser = null; this.currentBoard = BOARDS[0].id; this.unsubscribe = null; }
  connectedCallback() {
    onAuthStateChanged(auth, (user) => { this.currentUser = user; this.render(); this.loadComments(); });
    window.addEventListener('theme-changed', () => this.render());
  }
  render() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const isVerified = this.currentUser && (this.currentUser.emailVerified || this.currentUser.providerData[0]?.providerId === 'google.com');

    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        :host { display: block; width: 100%; padding: clamp(20px, 5vw, 40px) 0; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; gap: 15px; }
        .board-tabs { display: flex; gap: 10px; margin-bottom: 30px; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .tab { padding: 10px 18px; border-radius: 20px; background: var(--card-bg); border: 1px solid rgba(128,128,128,0.1); color: var(--text-dim); cursor: pointer; white-space: nowrap; font-size: 0.9rem; transition: 0.3s; }
        .tab.active { background: var(--primary); color: var(--bg-color); font-weight: 700; }
        
        .comment-input-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: clamp(15px, 4vw, 24px); box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 40px; position: sticky; top: 10px; z-index: 10; }
        textarea { width: 100%; background: rgba(128,128,128,0.05); border: 2px solid transparent; border-radius: 12px; padding: 14px; color: var(--text-main); font-family: inherit; font-size: 1rem; resize: none; min-height: 60px; transition: 0.3s; }
        .btn-post { background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 10px; float: right; transition: 0.3s; }
        
        .comment-item { background: var(--card-bg); border-radius: var(--radius-md); padding: clamp(15px, 4vw, 20px); margin-bottom: 12px; border-left: 4px solid var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .comment-item.is-reply { margin-left: clamp(20px, 8vw, 40px); border-left-color: var(--secondary); background: rgba(128,128,128,0.02); }
        .item-avatar { width: clamp(30px, 10vw, 36px); height: clamp(30px, 10vw, 36px); border-radius: 50%; object-fit: cover; }
        .author-name { font-weight: 700; color: var(--primary); font-size: 0.9rem; }
        .footer-actions { display: flex; gap: clamp(10px, 3vw, 15px); font-size: 0.8rem; color: var(--text-dim); margin-top: 10px; flex-wrap: wrap; }
        .action-link { cursor: pointer; }
        
        @media (max-width: 480px) {
          .header { flex-direction: column; align-items: flex-start; }
          .header div:last-child { align-self: flex-end; }
        }
      </style>
      <div class="header">
        <div><h1 style="color:var(--primary); margin-bottom:4px;">SKKU Coffee Chat</h1><p style="color:var(--text-dim); font-size:0.8rem;">함께 성장하는 마케팅 커뮤니티</p></div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button style="background:none; border:none; cursor:pointer; font-size:1.2rem;" id="theme-btn">${currentTheme === 'dark' ? '☀️' : '🌙'}</button>
          ${this.currentUser ? `<span id="profile-btn" style="color:var(--primary); cursor:pointer; font-weight:600; text-decoration:underline; font-size:0.9rem;">${this.currentUser.displayName || '닉네임'}</span>` : `<button id="main-login-btn" class="btn-post" style="margin-top:0; padding:8px 16px;">로그인</button>`}
        </div>
      </div>
      <div class="board-tabs">${BOARDS.map(b => `<div class="tab ${this.currentBoard === b.id ? 'active' : ''}" data-id="${b.id}">${b.icon} ${b.name}</div>`).join('')}</div>
      ${this.currentUser ? (isVerified ? `
        <div class="comment-input-card">
          <textarea id="main-input" placeholder="${BOARDS.find(b=>b.id===this.currentBoard).name}에 남기기..."></textarea>
          <button id="main-submit" class="btn-post">게시</button>
          <div style="clear:both;"></div>
        </div>
      ` : `<div class="comment-input-card" style="text-align:center;">⚠️ 이메일 인증이 필요합니다.</div>`) : `<div style="text-align:center; padding:30px; border:2px dashed rgba(128,128,128,0.2); border-radius:16px; color:var(--text-dim); margin-bottom:40px; font-size:0.9rem;">로그인 후 참여해 보세요!</div>`}
      <div id="comment-list"></div>
    `;
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.shadowRoot.getElementById('theme-btn').onclick = toggleTheme;
    if (this.shadowRoot.getElementById('profile-btn')) this.shadowRoot.getElementById('profile-btn').onclick = () => updateView('profile');
    if (this.shadowRoot.getElementById('main-login-btn')) this.shadowRoot.getElementById('main-login-btn').onclick = () => window.dispatchEvent(new CustomEvent('show-login'));
    this.shadowRoot.querySelectorAll('.tab').forEach(tab => { tab.onclick = () => { this.currentBoard = tab.dataset.id; this.render(); this.loadComments(); }; });
    const mainSubmit = this.shadowRoot.getElementById('main-submit');
    if (mainSubmit) {
      mainSubmit.onclick = async () => {
        const input = this.shadowRoot.getElementById('main-input');
        if (!input.value.trim()) return;
        await addDoc(collection(db, "comments"), { content: input.value.trim(), authorName: this.currentUser.displayName || "익명", authorUid: this.currentUser.uid, authorPhoto: this.currentUser.photoURL || '', boardId: this.currentBoard, createdAt: serverTimestamp(), likes: [] });
        input.value = '';
      };
    }
  }
  loadComments() {
    if (this.unsubscribe) this.unsubscribe();
    const listEl = this.shadowRoot.getElementById('comment-list');
    onSnapshot(query(collection(db, "comments"), where("boardId", "==", this.currentBoard)), (snapshot) => {
      const all = []; snapshot.forEach(d => all.push({ id: d.id, ...d.data() }));
      all.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      const parents = all.filter(c => !c.parentId);
      listEl.innerHTML = parents.length === 0 ? '<p style="text-align:center; color:var(--text-dim); margin-top:40px;">첫 게시글을 기다리고 있어요!</p>' : '';
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
    item.innerHTML = `
      <div class="item-header"><img class="item-avatar" src="${data.authorPhoto || getAvatarUrl('avataaars', 'default')}"><div style="display:flex; flex-direction:column;"><span class="author-name">${data.authorName}${isMine ? ' (나)' : ''}</span><span style="font-size:0.65rem; color:var(--text-dim);">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '방금 전'}</span></div></div>
      <div class="content" id="content-${id}">${data.content}</div>
      <div class="footer-actions"><div class="action-link" id="like-${id}" style="color:${isLiked ? '#ff4d4d' : 'var(--text-dim)'}">❤️ ${data.likes?.length || 0}</div>${!isReply ? `<div class="action-link" id="rep-${id}">💬 답글</div>` : ''}${isMine ? `<div class="action-link" id="ed-${id}">수정</div><div class="action-link" style="color:#ff4d4d" id="del-${id}">삭제</div>` : ''}</div><div id="reply-box-${id}"></div>
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
    box.innerHTML = `<div style="margin-top:10px;"><textarea id="rin-${pid}" placeholder="답글..." style="min-height:50px; font-size:0.9rem;"></textarea><div style="display:flex; justify-content:flex-end; gap:8px;"><button style="background:none; border:1px solid var(--text-dim); color:var(--text-dim); border-radius:5px; padding:4px 10px; font-size:0.75rem; cursor:pointer;" id="rcan-${pid}">취소</button><button class="btn-post" style="padding:4px 12px; font-size:0.75rem; margin-top:0;" id="rsub-${pid}">등록</button></div></div>`;
    this.shadowRoot.getElementById(`rcan-${pid}`).onclick = () => box.innerHTML = '';
    this.shadowRoot.getElementById(`rsub-${pid}`).onclick = () => { this.postComment(this.shadowRoot.getElementById(`rin-${pid}`), pid); box.innerHTML = ''; };
  }
  async startEdit(id, old) {
    const cEl = this.shadowRoot.getElementById(`content-${id}`);
    cEl.innerHTML = `<textarea id="in-${id}">${old}</textarea><div style="display:flex; justify-content:flex-end; gap:8px; margin-top:5px;"><button id="can-${id}" style="font-size:0.8rem; background:none; border:none; color:var(--text-dim); cursor:pointer;">취소</button><button id="sav-${id}" style="font-size:0.8rem; background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer;">저장</button></div>`;
    this.shadowRoot.getElementById(`can-${id}`).onclick = () => this.loadComments();
    this.shadowRoot.getElementById(`sav-${id}`).onclick = async () => { const val = this.shadowRoot.getElementById(`in-${id}`).value.trim(); if (val) await updateDoc(doc(db, "comments", id), { content: val }); };
  }
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
      <style>@import url('/style.css'); .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); } .login-card { background: var(--card-bg); border-radius: 24px; padding: clamp(20px, 8vw, 40px); width: min(400px, 90%); box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); position: relative; } h2 { text-align: center; margin-bottom: 24px; color: var(--primary); } input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; margin-bottom: 15px; } .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 8px; cursor: pointer; } .btn-close { position: absolute; top: 15px; right: 15px; color: var(--text-dim); cursor: pointer; background: none; border: none; font-size: 1.5rem; } .btn-google { width: 100%; padding: 12px; background: #fff; color: #000; border: 1px solid #ddd; border-radius: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; font-size: 0.9rem; }</style>
      <div class="overlay"><div class="login-card"><button class="btn-close" id="close-btn">&times;</button><h2>${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '회원가입' : '비밀번호 찾기'}</h2><form id="auth-form">${this.mode === 'signup' ? `<input type="text" id="nickname" placeholder="닉네임" required>` : ''}<input type="email" id="email" placeholder="이메일" required>${this.mode !== 'reset' ? `<input type="password" id="password" placeholder="비밀번호" required minlength="6">` : ''}<button type="submit" id="submit-btn" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '발송'}</button></form><button id="google-btn" class="btn-google"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> Google 계정 사용</button><div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-dim);"><a id="toggle-link" style="color:var(--primary); cursor:pointer;">${this.mode === 'login' ? '회원가입 하러가기' : '로그인 하러가기'}</a></div></div></div>
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
          if (!res.user.emailVerified) alert("이메일 인증 필요");
        } else if (this.mode === 'signup') {
          const res = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(res.user, { displayName: nickname });
          await sendEmailVerification(res.user);
          alert("인증 메일 발송 완료");
          await signOut(auth);
        } else await sendPasswordResetEmail(auth, email);
      } catch (error) { alert("인증 오류"); } finally { this.render(); }
    };
  }
}
customElements.define('login-screen', LoginScreen);

const updateView = (v) => { document.getElementById('main-container').innerHTML = v === 'feed' ? '<comments-section></comments-section>' : '<profile-section></profile-section>'; };
document.body.innerHTML = `<div id="main-container"><comments-section></comments-section></div><login-screen></login-screen><div style="position: fixed; top: -10%; left: -10%; width: 50%; height: 50%; background: var(--secondary); filter: blur(150px); opacity: 0.15; border-radius: 50%; pointer-events: none; z-index: -1;"></div><div style="position: fixed; bottom: -10%; right: -10%; width: 40%; height: 40%; background: var(--primary); filter: blur(150px); opacity: 0.1; border-radius: 50%; pointer-events: none; z-index: -1;"></div>`;
