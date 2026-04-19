# Art Sison 배포 가이드

artsison.com을 실제로 인터넷에 띄우는 방법입니다. 총 **10분** 정도 걸립니다.

---

## 빠른 요약

1. **Vercel**에 `artsison-deploy` 폴더를 업로드한다
2. **Namecheap**에서 artsison.com의 DNS를 Vercel로 연결한다
3. 끝 — 10분~1시간 안에 artsison.com이 열립니다

---

## 1단계 · Vercel에 배포하기 (5분, 무료)

### 1-1. 프로젝트 다운로드
- 왼쪽 파일 탐색기에서 `artsison-deploy` 폴더를 다운로드하세요
- 그 안에 `index.html` 하나만 있으면 됩니다 — 이 파일 하나가 전체 사이트입니다

### 1-2. Vercel 가입
1. https://vercel.com 접속
2. **Sign Up** → GitHub/Google/이메일로 가입 (무료)

### 1-3. 사이트 올리기
1. 대시보드에서 **Add New → Project** 클릭
2. **Deploy without Git** 또는 **Upload** 선택
3. `artsison-deploy` 폴더 통째로 드래그 & 드롭
4. Project Name을 `artsison`으로 설정
5. **Deploy** 클릭

→ 몇 초 뒤 `artsison.vercel.app` 같은 임시 주소가 나옵니다. 여기 열어서 사이트가 잘 뜨는지 확인하세요.

---

## 2단계 · artsison.com 연결하기 (5분)

### 2-1. Vercel에서 도메인 추가
1. Vercel 프로젝트 페이지 → **Settings → Domains**
2. `artsison.com` 입력 → **Add**
3. Vercel이 DNS 레코드 2개를 알려줍니다 (아래와 비슷합니다):
   ```
   A    @     76.76.21.21
   CNAME www  cname.vercel-dns.com
   ```
   ⚠️ Vercel이 알려주는 실제 값을 쓰세요 — 위 숫자는 예시입니다.

### 2-2. Namecheap에서 DNS 바꾸기
1. https://ap.www.namecheap.com/ 로그인
2. **Domain List → artsison.com → MANAGE** 클릭
3. 상단 탭에서 **Advanced DNS** 선택
4. **기존 레코드 모두 삭제** (다른 사이트로 연결돼 있던 것들)
   - URL Redirect, A Record, CNAME 전부 지우세요
5. **ADD NEW RECORD** 로 Vercel이 준 레코드 2개를 추가:
   - Type: `A Record`, Host: `@`, Value: `76.76.21.21`
   - Type: `CNAME Record`, Host: `www`, Value: `cname.vercel-dns.com.`
6. 초록 체크 (Save) 클릭

### 2-3. 기다리기
- 보통 **10분~1시간** 안에 `artsison.com` 으로 접속하면 사이트가 뜹니다
- 최대 48시간까지 걸릴 수 있지만 드뭅니다
- Vercel이 자동으로 **HTTPS (SSL 인증서)** 까지 붙여줍니다

---

## 문제가 생기면

**"This site can't be reached"**
→ DNS 전파가 아직 안 된 상태. 30분 더 기다려 보세요. https://dnschecker.org 에서 artsison.com 조회해서 전 세계적으로 퍼졌는지 확인할 수 있습니다.

**Namecheap에 기존 URL Redirect가 있을 때**
→ 반드시 **지워야** 합니다. 안 지우면 Vercel 레코드가 무시됩니다.

**www.artsison.com만 되고 artsison.com이 안 될 때**
→ A Record의 Host가 `@`로 돼 있는지 확인하세요.

---

## 나중에 사이트를 수정하고 싶을 때

이 프로젝트에서 수정한 뒤:
1. 다시 `artsison-deploy/index.html` 한 파일을 새로 받으세요 (저에게 "번들 다시 만들어줘" 라고 하시면 됩니다)
2. Vercel 프로젝트 페이지에서 새 파일을 다시 업로드하면 자동으로 업데이트됩니다

---

## 대안: Netlify (Vercel 대신)

Vercel 대신 Netlify(https://app.netlify.com)도 똑같이 무료입니다.
- **Sites → Add new site → Deploy manually**
- `artsison-deploy` 폴더를 드래그
- **Domain settings**에서 `artsison.com` 추가
- Netlify가 알려주는 DNS 레코드로 Namecheap을 업데이트

둘 다 무료고 속도 비슷합니다. 하나 고르세요.
