import { app, analytics, auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  updateProfile,
  sendEmailVerification,
  getAdditionalUserInfo,
  deleteUser
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

const ADMIN_EMAIL = "vulter3653@gmail.com";

const AVATAR_STYLES = [
  { id: 'avataaars', name: '사람' }, { id: 'adventurer', name: '모험가' }, { id: 'open-peeps', name: '스케치' }, { id: 'personas', name: '캐릭터' }, { id: 'lorelei', name: '애니' }, { id: 'bottts', name: '로봇' }, { id: 'pixel-art', name: '픽셀' }, { id: 'miniavs', name: '미니' }, { id: 'big-smile', name: '미소' }, { id: 'fun-emoji', name: '이모지' }, { id: 'notionists', name: '노션' }, { id: 'croodles', name: '낙서' }, { id: 'thumbs', name: '추상화' }, { id: 'identicon', name: '기하학' }, { id: 'rings', name: '원형' }
];

const initTheme = () => { const savedTheme = localStorage.getItem('theme') || 'light'; document.documentElement.setAttribute('data-theme', savedTheme); };
const toggleTheme = () => { const current = document.documentElement.getAttribute('data-theme'); const next = current === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('theme', next); window.dispatchEvent(new CustomEvent('theme-update', { detail: { theme: next } })); };
initTheme();

const getAvatarUrl = (style, seed) => `https://api.dicebear.com/7.x/${style || 'avataaars'}/svg?seed=${seed || 'default'}`;

/* 프로필 설정 컴포넌트 */
class ProfileSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentStyle = 'avataaars'; this.currentSeed = ''; }
  connectedCallback() { this.render(); window.addEventListener('theme-update', () => this.render()); }
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
      <style>@import url('/style.css'); :host { display: block; width: 100%; padding: 40px 0; } .profile-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: clamp(20px, 5%, 40px); box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); text-align: center; } .avatar-preview { width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--primary); background: #fff; margin-bottom: 20px; } .form-group { text-align: left; margin-bottom: 20px; } select, input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(128,128,128,0.2); background: var(--card-bg); color: var(--text-main); font-family: inherit; margin-bottom: 10px; } .btn-save { width: 100%; padding: 16px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 12px; cursor: pointer; margin-top: 20px; transition: 0.3s; } .btn-danger { background: none; border: 1px solid #ff4d4d; color: #ff4d4d; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.8rem; margin-top: 40px; width: 100%; }</style>
      <div class="profile-card">
        <h2>프로필 설정</h2>
        <img class="avatar-preview" id="preview" src="${getAvatarUrl(this.currentStyle, this.currentSeed)}">
        <div class="form-group"><label>아바타 스타일</label><select id="style-select">${AVATAR_STYLES.map(s => `<option value="${s.id}" ${this.currentStyle === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>키워드</label><input type="text" id="seed-input" value="${this.currentSeed}"></div>
        <div class="form-group"><label>닉네임</label><input type="text" id="new-nickname" value="${user.displayName || ''}"></div>
        <button id="save-profile" class="btn-save">모든 내용 저장</button>
        <button id="back-to-feed" style="background:none; border:none; color:var(--text-dim); cursor:pointer; margin-top:20px; text-decoration:underline;">피드로 돌아가기</button>
        <button id="delete-account" class="btn-danger">회원 탈퇴 및 모든 글 삭제</button>
      </div>
    `;
    const update = () => { this.currentStyle = this.shadowRoot.getElementById('style-select').value; this.currentSeed = this.shadowRoot.getElementById('seed-input').value; this.shadowRoot.getElementById('preview').src = getAvatarUrl(this.currentStyle, this.currentSeed); };
    this.shadowRoot.getElementById('style-select').onchange = update; this.shadowRoot.getElementById('seed-input').oninput = update;
    this.shadowRoot.getElementById('save-profile').onclick = async () => {
      const btn = this.shadowRoot.getElementById('save-profile'); btn.disabled = true;
      try {
        const newName = this.shadowRoot.getElementById('new-nickname').value.trim();
        const photoURL = getAvatarUrl(this.currentStyle, this.currentSeed);
        await updateProfile(user, { displayName: newName, photoURL });
        const snaps = await getDocs(query(collection(db, "comments"), where("authorUid", "==", user.uid)));
        if (!snaps.empty) { const batch = writeBatch(db); snaps.forEach(d => batch.update(d.ref, { authorName: newName, authorPhoto: photoURL })); await batch.commit(); }
        alert("정보가 변경되었습니다!"); location.reload();
      } catch (e) { alert("저장 실패"); btn.disabled = false; }
    };
    this.shadowRoot.getElementById('delete-account').onclick = async () => {
      if (confirm("탈퇴하실거에요..? 작성하신 모든 글이 삭제되며 복구할 수 없습니다.")) {
        try {
          const snaps = await getDocs(query(collection(db, "comments"), where("authorUid", "==", user.uid)));
          if (!snaps.empty) { const batch = writeBatch(db); snaps.forEach(d => batch.delete(d.ref)); await batch.commit(); }
          await deleteUser(user); alert("탈퇴 처리되었습니다."); location.reload();
        } catch (e) { alert("로그인이 만료되었습니다. 다시 로그인해 주세요."); }
      }
    };
    this.shadowRoot.getElementById('back-to-feed').onclick = () => updateView('feed');
  }
}
customElements.define('profile-section', ProfileSection);

/* 댓글 컴포넌트 */
class CommentsSection extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.currentUser = null; this.currentBoard = BOARDS[0].id; this.unsubscribe = null; this.allComments = []; }
  connectedCallback() {
    onAuthStateChanged(auth, (user) => { this.currentUser = user; this.render(); this.loadComments(); });
    window.addEventListener('theme-update', (e) => { const btn = this.shadowRoot.getElementById('theme-btn'); if (btn) btn.textContent = e.detail.theme === 'dark' ? '☀️' : '🌙'; });
  }
  render() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const isVerified = this.currentUser && (this.currentUser.emailVerified || this.currentUser.providerData[0]?.providerId === 'google.com');
    this.shadowRoot.innerHTML = `
      <style>@import url('/style.css'); :host { display: block; width: 100%; padding: 20px 0; } .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; gap: 15px; flex-wrap: wrap; } .header-info { flex: 1; min-width: 180px; } .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; } .user-chip { display: flex; align-items: center; gap: 8px; background: rgba(128,128,128,0.08); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(128,128,128,0.1); white-space: nowrap; flex-shrink: 0; } .nav-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; } .nickname { font-weight: 700; color: var(--primary); font-size: 0.85rem; cursor: pointer; text-decoration: underline; } .btn-logout-small { background: none; border: 1px solid var(--text-dim); color: var(--text-dim); padding: 3px 8px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; transition: 0.2s; } .board-tabs { display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none; } .tab { padding: 8px 16px; border-radius: 20px; background: var(--card-bg); border: 1px solid rgba(128,128,128,0.1); color: var(--text-dim); cursor: pointer; white-space: nowrap; font-size: 0.85rem; transition: 0.3s; } .tab.active { background: var(--primary); color: var(--bg-color); font-weight: 700; } .comment-input-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 30px; position: sticky; top: 10px; z-index: 10; } textarea { width: 100%; background: rgba(128,128,128,0.05); border: 2px solid transparent; border-radius: 12px; padding: 12px; color: var(--text-main); font-family: inherit; font-size: 0.95rem; resize: none; min-height: 50px; } .btn-post { background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; margin-top: 8px; float: right; font-size: 0.9rem; } .comment-item { background: var(--card-bg); border-radius: 12px; padding: 16px; margin-bottom: 10px; border-left: 3px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.3s; position: relative; } .comment-item[data-depth="1"] { margin-left: 30px; border-left-color: var(--secondary); background: rgba(128,128,128,0.01); } .comment-item[data-depth="2"] { margin-left: 60px; border-left-color: var(--accent); background: rgba(128,128,128,0.02); } .item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; } .item-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(128,128,128,0.1); } .author-name { font-weight: 700; color: var(--primary); font-size: 0.85rem; } .timestamp { font-size: 0.65rem; color: var(--text-dim); margin-left: auto; } .content { color: var(--text-main); font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; margin-bottom: 10px; } .footer-actions { display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-dim); } .action-link { cursor: pointer; opacity: 0.8; } .mention { color: var(--primary); font-weight: 700; margin-right: 5px; } .btn-admin { color: #ff4d4d; font-weight: 700; text-decoration: underline; margin-left: 10px; cursor: pointer; }</style>
      <div class="header">
        <div class="header-info"><h1 style="color:var(--primary); font-size:1.4rem; margin-bottom:2px;">SKKU Coffee Chat</h1><p style="color:var(--text-dim); font-size:0.75rem;">학우들과 나누는 따뜻한 대화</p></div>
        <div class="header-actions">
          <button style="background:none; border:none; cursor:pointer; font-size:1.1rem;" id="theme-btn">${currentTheme === 'dark' ? '☀️' : '🌙'}</button>
          ${this.currentUser ? `<div class="user-chip"><img class="nav-avatar" src="${this.currentUser.photoURL || getAvatarUrl('avataaars', 'default')}"><span id="profile-btn" class="nickname">${this.currentUser.displayName || '닉네임'}</span><button id="logout-btn" class="btn-logout-small">로그아웃</button></div>` : `<button id="main-login-btn" class="btn-post" style="margin-top:0; padding:6px 14px;">로그인</button>`}
        </div>
      </div>
      <div class="board-tabs">${BOARDS.map(b => `<div class="tab ${this.currentBoard === b.id ? 'active' : ''}" data-id="${b.id}">${b.icon} ${b.name}</div>`).join('')}</div>
      ${this.currentUser ? (isVerified ? `<div class="comment-input-card"><textarea id="main-input" placeholder="이야기 남기기..."></textarea><button id="main-submit" class="btn-post">게시</button><div style="clear:both;"></div></div>` : `<div class="comment-input-card" style="text-align:center; font-size:0.85rem; color:#ff4d4d;">⚠️ 이메일 인증 필요 <button id="resend-verify" style="background:none; border:none; text-decoration:underline; color:inherit; cursor:pointer;">재발송</button></div>`) : `<div style="text-align:center; padding:20px; border:2px dashed rgba(128,128,128,0.1); border-radius:16px; color:var(--text-dim); margin-bottom:30px; font-size:0.85rem;">로그인 후 참여하세요.</div>`}
      <div id="comment-list"></div>
    `;
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.shadowRoot.getElementById('theme-btn').onclick = toggleTheme;
    if (this.shadowRoot.getElementById('logout-btn')) this.shadowRoot.getElementById('logout-btn').onclick = () => signOut(auth);
    if (this.shadowRoot.getElementById('profile-btn')) this.shadowRoot.getElementById('profile-btn').onclick = () => updateView('profile');
    if (this.shadowRoot.getElementById('resend-verify')) this.shadowRoot.getElementById('resend-verify').onclick = () => sendEmailVerification(auth.currentUser);
    if (this.shadowRoot.getElementById('main-login-btn')) this.shadowRoot.getElementById('main-login-btn').onclick = () => window.dispatchEvent(new CustomEvent('show-login'));
    this.shadowRoot.querySelectorAll('.tab').forEach(tab => { tab.onclick = () => { this.currentBoard = tab.dataset.id; this.render(); this.loadComments(); }; });
    const sub = this.shadowRoot.getElementById('main-submit');
    if (sub) sub.onclick = () => this.postComment(this.shadowRoot.getElementById('main-input'));
  }
  async postComment(inputEl, pid = null) {
    const text = inputEl.value.trim();
    if (!text || !this.currentUser) return;
    try {
      await addDoc(collection(db, "comments"), { content: text, authorName: this.currentUser.displayName || "익명", authorUid: this.currentUser.uid, authorPhoto: this.currentUser.photoURL || '', boardId: this.currentBoard, parentId: pid, createdAt: serverTimestamp(), likes: [] });
      inputEl.value = ''; if (pid) this.shadowRoot.getElementById(`reply-box-${pid}`).innerHTML = '';
    } catch (e) { alert("등록 실패"); }
  }
  loadComments() {
    if (this.unsubscribe) this.unsubscribe();
    onSnapshot(query(collection(db, "comments"), where("boardId", "==", this.currentBoard)), (snapshot) => {
      this.allComments = []; snapshot.forEach(d => this.allComments.push({ id: d.id, ...d.data() }));
      this.allComments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      const roots = this.allComments.filter(c => !c.parentId).reverse();
      const listEl = this.shadowRoot.getElementById('comment-list');
      listEl.innerHTML = ''; roots.forEach(root => this.renderRecursive(listEl, root, 0));
    });
  }
  renderRecursive(container, comment, depth) {
    this.renderItem(container, comment, depth);
    this.allComments.filter(c => c.parentId === comment.id).forEach(child => this.renderRecursive(container, child, depth + 1));
  }
  renderItem(container, data, depth) {
    const isMine = this.currentUser && data.authorUid === this.currentUser.uid;
    const isAdmin = this.currentUser && this.currentUser.email === ADMIN_EMAIL;
    const id = data.id;
    const item = document.createElement('div');
    item.className = 'comment-item'; item.dataset.depth = Math.min(depth, 2);
    let contentHTML = this.escapeHTML(data.content);
    if (depth > 0) contentHTML = contentHTML.replace(/^(@[^\s]+)/, '<span class="mention">$1</span>');
    item.innerHTML = `
      <div class="item-header"><img class="item-avatar" src="${data.authorPhoto || getAvatarUrl('avataaars', 'default')}"><span class="author-name">${data.authorName}${isMine ? ' (나)' : ''}</span><span class="timestamp">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('ko-KR', {hour:'2-digit', minute:'2-digit'}) : ''}</span></div>
      <div class="content" id="content-${id}">${contentHTML}</div>
      <div class="footer-actions" id="act-${id}">
        <div class="action-link" id="like-${id}" style="color:${this.currentUser && data.likes?.includes(this.currentUser.uid) ? '#ff4d4d' : 'inherit'}">❤️ ${data.likes?.length || 0}</div>
        <div class="action-link" id="rep-${id}">💬 답글</div>
        ${isMine ? `<div class="action-link" id="ed-${id}">수정</div><div class="action-link" style="color:#ff4d4d" id="del-${id}">삭제</div>` : ''}
        ${isAdmin && !isMine ? `<div class="btn-admin" id="admin-del-all-${id}">관리자: 모든 글 삭제</div>` : ''}
      </div>
      <div id="reply-box-${id}"></div>
    `;
    container.appendChild(item);
    this.shadowRoot.getElementById(`like-${id}`).onclick = async () => { if (!this.currentUser) return window.dispatchEvent(new CustomEvent('show-login')); const isLiked = data.likes?.includes(this.currentUser.uid); await updateDoc(doc(db, "comments", id), { likes: isLiked ? arrayRemove(this.currentUser.uid) : arrayUnion(this.currentUser.uid) }); };
    this.shadowRoot.getElementById(`rep-${id}`).onclick = () => this.showReplyBox(id, data.authorName);
    if (isMine) {
      this.shadowRoot.getElementById(`del-${id}`).onclick = async () => { if (confirm("삭제하실거에요..?")) await deleteDoc(doc(db, "comments", id)); };
      this.shadowRoot.getElementById(`ed-${id}`).onclick = () => this.startEdit(id, data.content);
    }
    if (isAdmin && !isMine) {
      this.shadowRoot.getElementById(`admin-del-all-${id}`).onclick = async () => {
        if (confirm(`관리자: [${data.authorName}]님의 모든 글을 삭제할까요?`)) {
          const snaps = await getDocs(query(collection(db, "comments"), where("authorUid", "==", data.authorUid)));
          if (!snaps.empty) { const batch = writeBatch(db); snaps.forEach(d => batch.delete(d.ref)); await batch.commit(); alert("삭제 완료"); }
        }
      };
    }
  }
  showReplyBox(targetId, targetName) {
    if (!this.currentUser) return window.dispatchEvent(new CustomEvent('show-login'));
    const isVerified = this.currentUser.emailVerified || this.currentUser.providerData[0]?.providerId === 'google.com';
    const box = this.shadowRoot.getElementById(`reply-box-${targetId}`);
    if (box.innerHTML !== '') { box.innerHTML = ''; return; }
    if (!isVerified) { box.innerHTML = `<div style="margin-top:10px; font-size:0.8rem; color:#ff4d4d; border:1px dashed #ff4d4d; padding:10px; border-radius:8px;">⚠️ 이메일 인증 필요</div>`; return; }
    box.innerHTML = `<div style="margin-top:8px;"><textarea id="rin-${targetId}" placeholder="${targetName}님에게 답글 작성..." style="min-height:40px; font-size:0.9rem;">@${targetName} </textarea><div style="display:flex; justify-content:flex-end; gap:8px; margin-top:5px;"><button id="rcan-${targetId}" style="font-size:0.75rem; cursor:pointer; background:none; border:none; color:var(--text-dim);">취소</button><button class="btn-post" style="padding:4px 12px; font-size:0.75rem; margin-top:0;" id="rsub-${targetId}">등록</button></div></div>`;
    this.shadowRoot.getElementById(`rcan-${targetId}`).onclick = () => box.innerHTML = '';
    this.shadowRoot.getElementById(`rsub-${targetId}`).onclick = () => this.postComment(this.shadowRoot.getElementById(`rin-${targetId}`), targetId);
  }
  async startEdit(id, old) {
    const cEl = this.shadowRoot.getElementById(`content-${id}`); const aEl = this.shadowRoot.getElementById(`act-${id}`); const oC = cEl.innerHTML; const oA = aEl.innerHTML;
    cEl.innerHTML = `<textarea id="in-${id}" style="min-height:50px; font-size:0.95rem;">${old}</textarea>`;
    aEl.innerHTML = `<div style="display:flex; justify-content:flex-end; gap:10px;"><button id="can-${id}" style="font-size:0.75rem; color:var(--text-dim); background:none; border:none; cursor:pointer;">취소</button><button id="sav-${id}" style="font-size:0.75rem; color:var(--primary); font-weight:700; background:none; border:none; cursor:pointer;">저장</button></div>`;
    this.shadowRoot.getElementById('can-'+id).onclick = () => { cEl.innerHTML = oC; aEl.innerHTML = oA; };
    this.shadowRoot.getElementById('sav-'+id).onclick = async () => {
      const val = this.shadowRoot.getElementById('in-'+id).value.trim();
      if (!val) return;
      try {
        await updateDoc(doc(db, "comments", id), { content: val });
        // 내용이 동일하더라도 강제 갱신하여 UI 복구
        this.loadComments();
      } catch (e) { alert("수정 실패"); }
    };
  }
  escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
}
customElements.define('comments-section', CommentsSection);

/* 로그인 모달 */
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
      <style>@import url('/style.css'); .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); } .login-card { background: var(--card-bg); border-radius: 24px; padding: 30px; width: min(380px, 90%); box-shadow: var(--shadow-deep); border: 1px solid rgba(128,128,128,0.1); position: relative; } h2 { text-align: center; margin-bottom: 20px; color: var(--primary); font-size: 1.4rem; } input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); background: rgba(128,128,128,0.05); color: var(--text-main); box-sizing: border-box; margin-bottom: 12px; font-size: 0.9rem; } .btn-submit { width: 100%; padding: 14px; background: var(--primary); color: var(--bg-color); font-weight: 700; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95rem; } .btn-close { position: absolute; top: 12px; right: 12px; color: var(--text-dim); cursor: pointer; background: none; border: none; font-size: 1.4rem; } .btn-google { width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #ddd; border-radius: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; }</style>
      <div class="overlay"><div class="login-card"><button class="btn-close" id="close-btn">&times;</button><h2>${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '회원가입' : '비밀번호 찾기'}</h2><form id="auth-form">${this.mode === 'signup' ? `<input type="text" id="nickname" placeholder="닉네임" required>` : ''}<input type="email" id="email" placeholder="이메일" required>${this.mode !== 'reset' ? `<input type="password" id="password" placeholder="비밀번호" required minlength="6">` : ''}<button type="submit" id="submit-btn" class="btn-submit">${this.mode === 'login' ? '로그인' : this.mode === 'signup' ? '가입하기' : '발송'}</button></form><button id="google-btn" class="btn-google"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="16"> Google 계정 사용</button><div style="text-align:center; margin-top:15px; font-size:0.8rem; color:var(--text-dim);"><a id="toggle-link" style="color:var(--primary); cursor:pointer;">${this.mode === 'login' ? '회원가입 하러가기' : '로그인 하러가기'}</a></div></div></div>
    `;
    this.shadowRoot.getElementById('close-btn').onclick = () => { this.isVisible = false; this.render(); };
    this.shadowRoot.getElementById('toggle-link').onclick = () => this.setMode(this.mode === 'login' ? 'signup' : 'login');
    this.shadowRoot.getElementById('google-btn').onclick = async () => { try { googleProvider.setCustomParameters({ prompt: 'select_account' }); const result = await signInWithPopup(auth, googleProvider); const details = getAdditionalUserInfo(result); if (details.isNewUser) alert("반가워요! 닉네임과 프로필 사진을 변경하지 않으시면 구글 정보로 활동하게 됩니다. ✨"); } catch(e) {} };
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
