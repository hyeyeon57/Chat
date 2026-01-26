# 화상 회의 웹 애플리케이션

줌(Zoom)과 유사한 기능을 제공하는 화상 회의 웹 애플리케이션입니다.

## 주요 기능

- 🔐 **하이브리드 로그인 시스템**: 일반 회원가입/로그인 + 카카오톡/네이버 소셜 로그인
- 🎥 **실시간 비디오 통화**: WebRTC를 사용한 P2P 비디오 통신
- 🎤 **오디오 통화**: 실시간 오디오 스트리밍
- 📺 **화면 공유**: 데스크톱 화면 공유 기능
- 💬 **실시간 채팅**: 참가자 간 텍스트 채팅
- 👥 **다중 참가자 지원**: 여러 사용자가 동시에 참가 가능
- 🎨 **현대적인 UI**: 반응형 디자인과 아름다운 사용자 인터페이스

## 기술 스택

- **Frontend**: React
- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.io
- **WebRTC**: 브라우저 네이티브 WebRTC API

## 설치 및 실행

### 1. 환경 변수 설정

`.env` 파일을 생성하고 필요한 설정을 추가하세요:

```bash
cp .env.example .env
```

`.env` 파일을 열어 다음 값들을 설정하세요:
- `JWT_SECRET`: JWT 토큰 암호화 키 (프로덕션에서는 강력한 랜덤 문자열 사용)
- `SESSION_SECRET`: 세션 암호화 키
- `KAKAO_CLIENT_ID`: 카카오 개발자 콘솔에서 발급받은 클라이언트 ID
- `NAVER_CLIENT_ID`: 네이버 개발자 센터에서 발급받은 클라이언트 ID
- `NAVER_CLIENT_SECRET`: 네이버 개발자 센터에서 발급받은 클라이언트 시크릿

### 2. 의존성 설치

```bash
# 루트 디렉토리에서
npm run install-all
```

또는 개별적으로:

```bash
# 서버 의존성
npm install

# 클라이언트 의존성
cd client
npm install
cd ..
```

### 2. 개발 모드 실행

```bash
# 서버와 클라이언트를 동시에 실행
npm run dev
```

또는 개별적으로:

```bash
# 터미널 1: 서버 실행
npm run server

# 터미널 2: 클라이언트 실행
npm run client
```

### 3. 프로덕션 빌드

```bash
# 클라이언트 빌드
cd client
npm run build
cd ..

# 서버 실행 (빌드된 클라이언트 포함)
npm start
```

## 사용 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. 로그인 화면에서 다음 중 하나 선택:
   - **일반 회원가입/로그인**: 이메일과 비밀번호로 계정 생성 또는 로그인
   - **카카오톡 로그인**: 카카오톡 계정으로 간편 로그인
   - **네이버 로그인**: 네이버 계정으로 간편 로그인
3. 로그인 후 방 ID를 입력하거나 랜덤 생성 버튼 사용
4. "참가하기" 버튼 클릭
5. 다른 사용자도 같은 방 ID로 접속하여 참가
6. 비디오/오디오 제어, 화면 공유, 채팅 기능 사용

## 소셜 로그인 설정

### 카카오톡 로그인 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 애플리케이션 생성 및 설정
3. 플랫폼 설정에서 Web 플랫폼 추가
4. Redirect URI 설정: `http://localhost:5000/api/auth/kakao/callback`
5. REST API 키를 `.env` 파일의 `KAKAO_CLIENT_ID`에 설정

### 네이버 로그인 설정

1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. 애플리케이션 등록
3. 서비스 URL: `http://localhost:3000`
4. Callback URL: `http://localhost:5000/api/auth/naver/callback`
5. Client ID와 Client Secret을 `.env` 파일에 설정

## 주의사항

- HTTPS 환경에서 실행하는 것을 권장합니다 (프로덕션 환경)
- WebRTC는 브라우저의 미디어 권한이 필요합니다
- 방화벽이나 NAT 환경에서는 STUN/TURN 서버 설정이 필요할 수 있습니다
- 현재는 Google의 공개 STUN 서버를 사용합니다
- 소셜 로그인을 사용하려면 각 플랫폼의 개발자 콘솔에서 앱을 등록하고 OAuth 설정이 필요합니다
- 프로덕션 환경에서는 `.env` 파일의 시크릿 키들을 반드시 변경하세요

## 브라우저 호환성

- Chrome/Edge (권장)
- Firefox
- Safari

## 라이선스

MIT

