# 📰 카테고리별 뉴스 구독 서비스

> 해커톤 미니 프로젝트 | HTML/CSS · JavaScript · Node.js · MariaDB · JWT · bcrypt · GCP · Cloudflare

---

## 서비스 소개

사용자가 관심 카테고리를 선택하면 해당 카테고리의 뉴스만 맞춤형으로 제공하는 구독 서비스입니다.

**구독 카테고리:** `기술` `경제` `스포츠` `환경` `정치` `문화`

**접속 주소**
```
http://34.158.200.6:3000
https://spoke-existence-diploma-boys.trycloudflare.com
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML, CSS, JavaScript (Fetch API) |
| 백엔드 | Node.js, Express |
| 데이터베이스 | MariaDB |
| 인증 | JWT (jsonwebtoken) |
| 보안 | bcrypt (비밀번호 해시 암호화) |
| 인프라 | GCP VM 인스턴스, PM2 |
| 보안 배포 | Cloudflare Tunnel (HTTPS) |
| 버전 관리 | GitHub |

---

## 파일 구조

```
news-subscription/
├── server.js          # Express 앱 + 라우터 + DB 연결 + JWT + bcrypt
├── static/
│   └── style.css      # 전체 공통 스타일
├── templates/
│   ├── index.html     # 메인 (서비스 소개, 로그인/회원가입 진입)
│   ├── register.html  # 회원가입 + 카테고리 선택
│   ├── login.html     # 로그인 → JWT 토큰 발급
│   └── feed.html      # 구독 카테고리 뉴스 피드
└── package.json
```

---

## DB 설계

### 테이블 구조

**users** — 사용자 정보
```sql
id, name, email, password, created_at
-- password는 bcrypt 해시값으로 저장
```

**user_categories** — 사용자별 구독 카테고리 (users.id FK)
```sql
id, user_id, category
```

**posts** — 뉴스 게시물
```sql
id, title, content, category, created_at
```

### 테이블 관계

```
users (1) ──→ (N) user_categories
user_categories.category = posts.category 로 뉴스 필터링
```

### 핵심 SQL (서브쿼리 필터링)

```sql
-- 사용자가 구독한 카테고리의 뉴스만 조회
SELECT p.*
FROM posts p
WHERE p.category IN (
  SELECT category FROM user_categories WHERE user_id = ?
)
ORDER BY p.created_at DESC;
```

---

## 백엔드 API

| 메서드 | 경로 | 인증 | 기능 |
|--------|------|------|------|
| GET | `/` | X | index.html |
| GET | `/register` | X | register.html |
| GET | `/login` | X | login.html |
| GET | `/feed` | X | feed.html |
| POST | `/api/posts` | X | 회원가입 + bcrypt 암호화 + 카테고리 저장 |
| POST | `/api/login` | X | 로그인 → bcrypt 비교 → JWT 토큰 발급 |
| GET | `/api/posts` | ✅ JWT | 구독 카테고리 뉴스 조회 |
| PUT | `/api/update` | ✅ JWT | 카테고리 수정 |
| DELETE | `/api/update` | ✅ JWT | 회원 탈퇴 |

---

## 보안 처리 흐름

### JWT 인증 흐름
```
로그인 성공
→ 서버가 JWT 토큰 발급 (유효시간 1시간)
→ 프론트에서 localStorage에 토큰 저장

뉴스 피드 요청
→ 프론트가 Authorization 헤더에 토큰 담아서 전송
→ 서버가 토큰 검증
→ 유효하면 뉴스 반환 ✅
→ 만료되면 401 오류 → 로그인 페이지로 이동

로그아웃
→ localStorage에서 토큰 삭제
```

### bcrypt 비밀번호 처리 흐름
```
회원가입
→ 입력한 비밀번호 "1234"
→ bcrypt.hash → "$2b$10$xxx..." 형태로 암호화
→ 암호화된 값을 DB에 저장

로그인
→ 입력한 비밀번호 "1234"
→ bcrypt.compare → DB의 해시값과 비교
→ 일치하면 JWT 토큰 발급 ✅
→ 불일치하면 401 오류 ❌
```

---

## 기능 흐름

```
1. 회원가입  → 이름·이메일·비밀번호 입력 + 카테고리 선택
               비밀번호 bcrypt 암호화
               users 테이블 INSERT
               user_categories 테이블 INSERT

2. 로그인    → email로 사용자 조회
               bcrypt.compare로 비밀번호 검증
               JWT 토큰 발급 → localStorage 저장

3. 피드 조회 → 토큰을 헤더에 담아 GET /api/posts 요청
               서버가 토큰 검증 후 구독 카테고리 뉴스 반환
               프론트에서 카드 형태로 렌더링

4. 카테고리 수정 → PUT /api/update
                   기존 카테고리 삭제 후 재등록
```

---

## 인프라 구성

```
GCP VM 인스턴스 (e2-micro, 서울 리전)
  └── Node.js 서버 (PM2 백그라운드 실행)
  └── MariaDB (testdb)
  └── Cloudflare Tunnel (HTTPS 자동 적용)
```

### GCP 서버 세팅 순서

```bash
# 1. 패키지 업데이트
sudo apt update -y

# 2. MariaDB 설치 & 시작
sudo apt install -y mariadb-server
sudo service mariadb start

# 3. GitHub에서 코드 가져오기
git clone https://github.com/munkukju/news-subscription.git
cd news-subscription
npm install

# 4. PM2로 서버 실행
sudo npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup

# 5. Cloudflare Tunnel 실행
pm2 start "cloudflared tunnel --url http://localhost:3000" --name tunnel
pm2 save
```

---

## 로컬 실행 방법

```bash
# 1. 패키지 설치
npm install

# 2. MariaDB 접속 후 DB 세팅
mysql -u testuser -p
USE testdb;

# 3. 서버 실행
node server.js

# 4. 브라우저 접속
http://localhost:3000
```

---

## GitHub 버전 관리

| 태그 | 내용 |
|------|------|
| v1.0 | 기본 기능 완성 (회원가입, 로그인, 피드) |
| v2.0 | JWT 인증 추가 |
| v3.0 | README 최종 정리 |
| v4.0 | 트러블슈팅 추가 |
| v5.0 | bcrypt 비밀번호 암호화 추가 |
| v6.0 | README 전체 업데이트 |

---

## 트러블슈팅

### localStorage → JWT 인증 전환 과정

---

**문제 1. localStorage에 user_id를 직접 저장하는 보안 취약점 발견**

기존에는 로그인 성공 후 user_id를 localStorage에 그대로 저장했습니다. 브라우저 개발자도구에서 누구나 user_id를 확인할 수 있었고, 값을 임의로 변경하면 다른 사용자 데이터에 접근할 수 있는 구조였습니다.

```js
// 기존 (취약)
localStorage.setItem('user_id', data.user_id);

// 변경 (JWT)
localStorage.setItem('token', data.token);
// user_id가 토큰 안에 암호화되어 외부에서 변조 불가
```

---

**문제 2. JWT 적용 후 피드 페이지에서 401 오류 발생**

로그인 후 피드 페이지로 이동하면 뉴스가 뜨지 않고 콘솔에서 401 오류가 발생했습니다. 프론트에서 토큰을 헤더에 담아 보내는 코드가 없었던 것이 원인이었습니다.

```js
// 기존
fetch('/api/posts')

// 변경
fetch('/api/posts', {
  headers: { 'Authorization': localStorage.getItem('token') }
})
```

---

**문제 3. 토큰 만료 시 흰 화면만 뜨는 문제**

로그인 후 1시간 뒤 피드 접속 시 화면이 빈 채로 멈추는 문제가 발생했습니다. 서버가 401을 반환해도 프론트에서 처리하는 코드가 없었던 것이 원인이었습니다.

```js
if (res.status === 401) {
  alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
  localStorage.removeItem('token');
  location.href = '/login';
  return null;
}
```

---

**문제 4. user_id를 쿼리스트링 대신 토큰에서 추출하는 방식으로 변경 필요**

JWT 적용 전에는 GET /api/posts?user_id=1 방식으로 user_id를 전달했지만, JWT 방식에서는 토큰을 검증한 뒤 req.user_id로 접근해야 했습니다.

```js
// 기존
const { user_id } = req.query;

// 변경
app.get('/api/posts', verifyToken, (req, res) => {
  const user_id = req.user_id; // 토큰에서 꺼낸 user_id 사용
});
```

---

### bcrypt 비밀번호 암호화 적용 과정

---

**문제 1. 평문 비밀번호가 DB에 그대로 저장되는 보안 취약점**

회원가입 시 "1234" 입력하면 DB에 "1234" 그대로 저장되어 DB가 유출되면 모든 사용자 비밀번호가 즉시 노출되는 문제가 있었습니다.

```js
// 기존 (평문 저장)
db.query(userSql, [name, email, password], ...)

// 변경 (bcrypt 암호화 후 저장)
bcrypt.hash(password, SALT_ROUNDS, (err, hashedPassword) => {
  db.query(userSql, [name, email, hashedPassword], ...)
})
// "1234" → "$2b$10$xxx..." 형태로 변환 후 저장
```

---

**문제 2. bcrypt 적용 후 기존 평문 비밀번호 계정 로그인 불가**

bcrypt 적용 후 기존 가입자 로그인 시 항상 실패했습니다. DB에 저장된 "1234" (평문)와 bcrypt.compare가 기대하는 해시 형식이 달라서 비교가 항상 false를 반환했던 것이 원인이었습니다.

```sql
-- 기존 평문 비밀번호 계정 전부 삭제
DELETE FROM user_categories;
DELETE FROM users;
-- 이후 새로 회원가입하면 bcrypt 해시로 저장됨
```

---

**문제 3. 로컬 bcrypt 모듈을 GCP에 그대로 복사하면 안 됨**

로컬(Windows)에서 npm install 후 GCP에 파일을 복사하면 서버 실행 시 bcrypt 모듈 오류가 발생했습니다. bcrypt는 네이티브 모듈이라 OS·아키텍처별로 따로 컴파일되기 때문에 Windows용 bcrypt가 Linux에서 동작하지 않았습니다.

```bash
# GCP SSH에서 직접 npm install 실행
git pull origin master
npm install  # Linux 환경에 맞게 bcrypt 재설치
pm2 restart server
```

---

## 회고록

### 잘 된 점

- `server.js` 단일 파일에 라우팅, DB 연결, JWT 인증, bcrypt 암호화를 모두 집중시켜 구조가 단순하고 파악하기 쉬웠다.
- `user_categories` 중간 테이블과 서브쿼리를 활용해 사용자별 맞춤 뉴스 필터링을 깔끔하게 구현했다.
- localStorage → JWT → bcrypt 순서로 보안을 단계적으로 강화하는 과정을 직접 경험했다.
- GCP VM + PM2 + Cloudflare Tunnel 조합으로 실제 서비스 가능한 수준의 배포 환경을 구축했다.
- GitHub 태그(v1.0 ~ v6.0)를 활용한 버전 관리 워크플로우를 실습했다.

### 아쉬운 점

- 뉴스 데이터가 더미 데이터 기반이라 실제 뉴스 API와 연동하지 못했다.
- Cloudflare Tunnel 주소가 재시작마다 바뀐다. 고정 도메인 연동이 필요하다.
- 에러 핸들링이 부족해 DB 오류 시 사용자에게 안내 메시지가 없다.
- Tailwind CSS를 적용하지 못했다.

### 배운 점

- Node.js 라우트를 메서드(GET/POST/PUT/DELETE)별로 세분화하는 방법을 익혔다.
- JWT 토큰 발급, 검증, 만료 처리 전체 흐름을 직접 구현했다.
- bcrypt를 활용한 비밀번호 해시 처리와 OS별 네이티브 모듈 차이를 이해했다.
- 동적 SQL 쿼리(`?` 바인딩)로 SQL 인젝션을 방지하는 기본 패턴을 적용했다.
- 서브쿼리(`IN (SELECT ...)`)를 활용한 데이터 필터링 방식을 이해했다.
- GCP VM 인스턴스 생성부터 PM2 백그라운드 실행까지 배포 전체 과정을 경험했다.

### 다음에 개선할 것

- [ ] 실시간 뉴스 API 연동 (NewsAPI 등)
- [ ] JOIN으로 서브쿼리 성능 최적화
- [ ] 인덱스(Index) 설계
- [ ] 고정 도메인 + Cloudflare 정식 연동
- [ ] Tailwind CSS 적용
- [ ] 카테고리별 뉴스 개수 뱃지 표시

---

> 개발 기간: 해커톤 당일 | 개발 인원: 1인
