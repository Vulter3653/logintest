# 로그인 화면 구현 블루프린트

## 개요
이 프로젝트는 사용자 인증을 위한 세련되고 현대적인 로그인/회원가입 화면을 제공합니다. 프레임워크 없이 웹 표준 기술(Web Components, Modern CSS, ES Modules)과 Firebase를 사용하여 구현됩니다.

## 주요 기능 및 디자인
- **웹 컴포넌트 (`<login-screen>`)**: 독립적이고 재사용 가능한 인증 폼 구성.
- **Firebase Authentication 통합 (공식 문서 기반)**:
  - **로그인**: `signInWithEmailAndPassword`를 통한 인증.
  - **회원가입**: `createUserWithEmailAndPassword`를 통한 신규 계정 생성.
  - **상태 관리**: `onAuthStateChanged`를 사용하여 실시간 로그인 상태 감시 및 UI 전환.
  - **로그아웃**: `signOut` 기능을 통한 세션 종료.
  - **에러 핸들링**: `auth/user-not-found`, `auth/email-already-in-use` 등 상세 에러 코드의 한국어 대응.
- **현대적인 UI/UX**:
  - OKLCH 색상 체계를 사용한 생동감 있는 그라데이션 및 강조 색상.
  - 깊이감 있는 그림자(Drop Shadows)와 매끄러운 트랜지션.
  - 반응형 디자인 및 컨테이너 쿼리 활용.
- **상호작용**:
  - 로그인/회원가입 모드 전환 애니메이션 및 텍스트 변경.
  - 인증 시도 시 버튼 비활성화 및 처리 중 상태 표시.

## 구현 현황
1. [x] **`blueprint.md` 생성 및 업데이트**: 프로젝트 상태 및 계획 기록.
2. [x] **`style.css` 작성**: 전역 변수, 타이포그래피, 배경 스타일 정의.
3. [x] **Firebase SDK 연동**: `firebase-config.js`를 통한 앱 초기화 및 Auth 설정.
4. [x] **공식 문서 기반 기능 구현**: `main.js`에 로그인, 회원가입, 상태 감시 로직 적용.
5. [x] **GitHub 연동**: 모든 변경 사항 자동 푸시 및 버전 관리.

## 다음 단계 (제안)
- [ ] **소셜 로그인**: 구글, 깃허브 등 OAuth 인증 추가.
- [ ] **비밀번호 재설정**: `sendPasswordResetEmail`을 통한 초기화 이메일 발송.
- [ ] **프로필 관리**: 로그인한 사용자의 닉네임이나 프로필 사진 설정 기능.
