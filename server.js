// =============================================
// 필요한 모듈 불러오기
// =============================================
const express = require('express');
const mysql   = require('mysql2');
const path    = require('path');
const jwt     = require('jsonwebtoken'); // JWT 추가
const bcrypt  = require('bcrypt');        // 비밀번호 암호화

const app         = express();
const PORT        = 3000;
const JWT_SECRET  = 'news-secret-key'; // 토큰 암호화에 사용하는 비밀키
const SALT_ROUNDS = 10;                // bcrypt 암호화 강도 (숫자가 클수록 더 안전하지만 느려짐)


// =============================================
// 미들웨어 설정
// =============================================

// static 폴더 안의 파일(css 등)을 브라우저에서 바로 접근할 수 있게 설정
app.use('/static', express.static(path.join(__dirname, 'static')));

// 요청 body를 JSON 형태로 파싱 (POST, PUT 요청에 필요)
app.use(express.json());


// =============================================
// MariaDB 연결 설정
// =============================================
const db = mysql.createConnection({
  host     : 'localhost',
  user     : 'testuser',   // 생성한 유저
  password : '1234',       // testuser 비밀번호
  database : 'testdb'      // 생성한 DB
});

db.connect((err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
    return;
  }
  console.log('DB 연결 성공!');
});


// =============================================
// 페이지 라우팅 (HTML 파일 반환)
// =============================================

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// 회원가입 페이지
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'register.html'));
});

// 로그인 페이지
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});

// 뉴스 피드 페이지
app.get('/feed', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'feed.html'));
});


// =============================================
// JWT 토큰 검증 미들웨어
// → /api/posts 요청 전에 토큰이 유효한지 확인
// =============================================
function verifyToken(req, res, next) {

  // 요청 헤더에서 토큰 꺼내기
  const token = req.headers['authorization'];

  // 토큰이 없으면 접근 거부
  if (!token) {
    return res.status(401).json({ message: '토큰이 없습니다. 로그인이 필요합니다.' });
  }

  // 토큰 검증
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
    // 검증 성공 → 토큰 안의 user_id를 req에 저장
    req.user_id = decoded.user_id;
    next(); // 다음 단계로 진행
  });
}


// =============================================
// API 라우팅
// =============================================

// ---------------------------------------------
// GET /api/posts
// 토큰 검증 후 구독 카테고리 뉴스 조회
// ---------------------------------------------
app.get('/api/posts', verifyToken, (req, res) => {
  // verifyToken에서 저장한 user_id 사용
  const user_id = req.user_id;

  const sql = `
    SELECT p.*
    FROM posts p
    WHERE p.category IN (
      SELECT category FROM user_categories WHERE user_id = ?
    )
    ORDER BY p.created_at DESC
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'DB 조회 실패' });
    }
    res.json(results);
  });
});


// ---------------------------------------------
// POST /api/posts
// 회원가입 처리: 사용자 저장 + 카테고리 저장
// ---------------------------------------------
app.post('/api/posts', (req, res) => {
  const { name, email, password, categories } = req.body;

  // 1단계: 비밀번호를 bcrypt로 암호화
  // → 같은 비밀번호라도 매번 다른 암호화 결과가 나오기 때문에 안전하다
  bcrypt.hash(password, SALT_ROUNDS, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ message: '비밀번호 암호화 실패' });
    }

    // 2단계: users 테이블에 사용자 저장 (암호화된 비밀번호를 저장)
    const userSql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

    db.query(userSql, [name, email, hashedPassword], (err, result) => {
      if (err) {
        return res.status(500).json({ message: '회원가입 실패' });
      }

      const userId = result.insertId;

      // 3단계: user_categories 테이블에 카테고리 저장
      const categorySql  = `INSERT INTO user_categories (user_id, category) VALUES ?`;
      const categoryData = categories.map(cat => [userId, cat]);

      db.query(categorySql, [categoryData], (err) => {
        if (err) {
          return res.status(500).json({ message: '카테고리 저장 실패' });
        }
        res.json({ message: '회원가입 성공' });
      });
    });
  });
});


// ---------------------------------------------
// POST /api/login
// 로그인 처리 → JWT 토큰 발급
// ---------------------------------------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // 1단계: 이메일로 사용자 찾기
  // → 비밀번호는 암호화되어 있어서 SQL에서 바로 비교할 수 없다
  //    그래서 일단 이메일로만 찾고, 비밀번호는 다음 단계에서 bcrypt로 비교
  const sql = `SELECT id, name, password FROM users WHERE email = ?`;

  db.query(sql, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'DB 오류' });
    }
    if (results.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 틀렸습니다' });
    }

    const user = results[0];

    // 2단계: 입력한 비밀번호와 DB에 저장된 암호화 비밀번호를 bcrypt로 비교
    // → 내부적으로 같은 방식으로 암호화한 뒤 비교해준다
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: '비밀번호 비교 실패' });
      }
      if (!isMatch) {
        return res.status(401).json({ message: '이메일 또는 비밀번호가 틀렸습니다' });
      }

      // 3단계: 로그인 성공 → JWT 토큰 발급
      // user_id를 토큰 안에 암호화해서 저장
      const token = jwt.sign(
        { user_id: user.id },  // 토큰 안에 담을 데이터
        JWT_SECRET,             // 암호화 비밀키
        { expiresIn: '1h' }    // 토큰 유효시간 1시간
      );

      res.json({ message: '로그인 성공', token: token, name: user.name });
    });
  });
});


// ---------------------------------------------
// PUT /api/update
// 카테고리 수정: 기존 카테고리 삭제 후 새로 저장
// ---------------------------------------------
app.put('/api/update', verifyToken, (req, res) => {
  const user_id        = req.user_id;
  const { categories } = req.body;

  // 1단계: 기존 카테고리 전부 삭제
  const deleteSql = `DELETE FROM user_categories WHERE user_id = ?`;

  db.query(deleteSql, [user_id], (err) => {
    if (err) {
      return res.status(500).json({ message: '카테고리 삭제 실패' });
    }

    // 2단계: 새 카테고리 다시 저장
    const insertSql    = `INSERT INTO user_categories (user_id, category) VALUES ?`;
    const categoryData = categories.map(cat => [user_id, cat]);

    db.query(insertSql, [categoryData], (err) => {
      if (err) {
        return res.status(500).json({ message: '카테고리 수정 실패' });
      }
      res.json({ message: '카테고리 수정 완료' });
    });
  });
});


// ---------------------------------------------
// DELETE /api/update
// 회원 탈퇴: 사용자 삭제 (카테고리는 CASCADE로 자동 삭제)
// ---------------------------------------------
app.delete('/api/update', verifyToken, (req, res) => {
  const user_id = req.user_id; // 토큰에서 가져온 user_id

  const sql = `DELETE FROM users WHERE id = ?`;

  db.query(sql, [user_id], (err) => {
    if (err) {
      return res.status(500).json({ message: '삭제 실패' });
    }
    res.json({ message: '탈퇴 완료' });
  });
});


// =============================================
// 서버 시작
// =============================================
app.listen(PORT, () => {
  console.log(`서버 실행 중 → http://localhost:${PORT}`);
});
