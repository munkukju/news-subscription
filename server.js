// =============================================
// 필요한 모듈 불러오기
// =============================================
const express = require('express');
const mysql   = require('mysql2');
const path    = require('path');

const app  = express();
const PORT = 3000;


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
// API 라우팅
// =============================================

// ---------------------------------------------
// GET /api/posts?user_id=1
// 해당 사용자가 구독한 카테고리의 뉴스만 조회
// ---------------------------------------------
app.get('/api/posts', (req, res) => {
  const { user_id } = req.query; // URL 쿼리스트링에서 user_id 꺼내기

  // 사용자의 구독 카테고리에 해당하는 뉴스만 필터링
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
    res.json(results); // 조회된 뉴스 목록 반환
  });
});


// ---------------------------------------------
// POST /api/posts
// 회원가입 처리: 사용자 저장 + 카테고리 저장
// ---------------------------------------------
app.post('/api/posts', (req, res) => {
  const { name, email, password, categories } = req.body;
  // categories는 배열로 넘어옴 ex) ['기술', '경제']

  // 1단계: users 테이블에 사용자 저장
  const userSql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

  db.query(userSql, [name, email, password], (err, result) => {
    if (err) {
      return res.status(500).json({ message: '회원가입 실패' });
    }

    const userId = result.insertId; // 방금 저장된 사용자의 id

    // 2단계: user_categories 테이블에 카테고리 저장
    // 선택한 카테고리 수만큼 INSERT
    const categorySql = `INSERT INTO user_categories (user_id, category) VALUES ?`;
    const categoryData = categories.map(cat => [userId, cat]);

    db.query(categorySql, [categoryData], (err) => {
      if (err) {
        return res.status(500).json({ message: '카테고리 저장 실패' });
      }
      res.json({ message: '회원가입 성공', user_id: userId });
    });
  });
});


// ---------------------------------------------
// PUT /api/update
// 카테고리 수정: 기존 카테고리 삭제 후 새로 저장
// ---------------------------------------------
app.put('/api/update', (req, res) => {
  const { user_id, categories } = req.body;

  // 1단계: 기존 카테고리 전부 삭제
  const deleteSql = `DELETE FROM user_categories WHERE user_id = ?`;

  db.query(deleteSql, [user_id], (err) => {
    if (err) {
      return res.status(500).json({ message: '카테고리 삭제 실패' });
    }

    // 2단계: 새 카테고리 다시 저장
    const insertSql  = `INSERT INTO user_categories (user_id, category) VALUES ?`;
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
app.delete('/api/update', (req, res) => {
  const { user_id } = req.body;

  const sql = `DELETE FROM users WHERE id = ?`;

  db.query(sql, [user_id], (err) => {
    if (err) {
      return res.status(500).json({ message: '삭제 실패' });
    }
    res.json({ message: '탈퇴 완료' });
  });
});


// ---------------------------------------------
// 로그인 처리
// email + password 확인 후 user_id 반환
// ---------------------------------------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const sql = `SELECT id, name FROM users WHERE email = ? AND password = ?`;

  db.query(sql, [email, password], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'DB 오류' });
    }
    if (results.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 틀렸습니다' });
    }
    // 로그인 성공 → user_id와 name 반환 (프론트에서 localStorage에 저장)
    res.json({ message: '로그인 성공', user_id: results[0].id, name: results[0].name });
  });
});


// =============================================
// 서버 시작
// =============================================
app.listen(PORT, () => {
  console.log(`서버 실행 중 → http://localhost:${PORT}`);
});
