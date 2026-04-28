# artsison.com — setup guide

이 문서는 artsison.com 사이트를 실제로 가동하기 위한 1회 설정 절차입니다.
사이트 코드는 이 폴더(`artsison-deploy/`) 전체가 그대로 Vercel 프로젝트가 됩니다.

## 배포 구조

```
artsison-deploy/
├─ index.html            # 랜딩 (Coming Soon)
├─ preview.html          # 실제 스토어 (React 앱)
├─ admin.html            # /admin 어드민 SPA
├─ success.html          # Stripe 결제 성공 리다이렉트
├─ cancel.html           # Stripe 결제 취소 리다이렉트
├─ package.json          # @vercel/postgres + stripe 의존성
├─ vercel.json           # /admin, /success, /cancel 라우팅
├─ schema.sql            # DB 스키마 (admin > Setup 에서 실행)
├─ lib/                  # db / auth / stripe / gelato 헬퍼
└─ api/                  # 서버리스 함수
   ├─ artworks.js, artworks/[id].js
   ├─ artists.js,  artists/[id].js
   ├─ orders.js,   orders/[id].js
   ├─ checkout.js
   ├─ admin/login.js, admin/me.js, admin/migrate.js, admin/variants.js
   └─ webhook/stripe.js, webhook/gelato.js
```

## 1. Vercel Postgres 프로비저닝

1. https://vercel.com/dashboard 에서 artsison 프로젝트 → **Storage** → **Create Database** → **Postgres**.
2. 리전은 가까운 곳(Seoul 없으면 Tokyo 또는 Frankfurt) 선택.
3. 생성이 끝나면 **Connect Project** 버튼을 누르면 `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` 등이 자동으로 주입됩니다.

## 2. 환경 변수

Vercel 프로젝트 **Settings → Environment Variables** 에 아래를 Production (그리고 원하면 Preview) 범위로 추가합니다.

| 변수명 | 설명 |
|---|---|
| `ADMIN_PASSWORD` | `/admin` 로그인 비밀번호 (원하는 문자열) |
| `SESSION_SECRET` | 세션 쿠키 서명용, 아무 긴 랜덤 문자열 (`openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | 3번 단계에서 웹훅을 만들면 자동으로 발급되는 `whsec_...` |
| `GELATO_API_KEY` | Gelato 가입 후 API key (없으면 비워두세요 — 결제까진 되고, Gelato 자동제출만 보류됩니다) |
| `SITE_URL` | `https://artsison.com` (도메인이 붙은 뒤) |

환경 변수를 추가하면 Vercel이 자동 재배포를 트리거합니다.

## 3. Stripe 설정

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://artsison.com/api/webhook/stripe`
3. Event 선택: `checkout.session.completed`
4. 생성 후 **Signing secret**을 복사해 `STRIPE_WEBHOOK_SECRET` 에 넣고 Vercel에 재배포.

테스트는 Stripe 대시보드 오른쪽 위 토글로 **Test mode** 전환 후 `sk_test_...` / `whsec_test_...` 로 따로 돌려보세요. 운영 키/웹훅은 다른 변수 세트로 나눠 관리하는 게 안전합니다.

## 4. 첫 배포 & 마이그레이션

1. 이 폴더(`artsison-deploy/`)에서 `~/Downloads/deploy-artsison.sh` 실행.
   - 기존 레포 내용을 지우고 이 폴더를 그대로 rsync 합니다.
   - 푸시 후 Vercel이 약 30초 안에 새 빌드를 올립니다.
2. 빌드가 끝나면 `https://artsison.com/admin` 접속 → `ADMIN_PASSWORD` 로 로그인.
3. **Setup** 탭 → **Run + seed demo catalog** 클릭.
   - `artists`, `artworks`, `gelato_variants`, `orders`, `order_items` 테이블이 생성되고 초기 8개 작품이 채워집니다.
4. **Artworks** 탭에서 작품이 보이면 정상. 여기서 직접 가격/제목/설명/sort order 를 수정 가능합니다.

## 5. Gelato 연동 (나중에)

Gelato 계정을 만들면 다음을 수행:

1. Gelato Dashboard → API → 키 발급 → `GELATO_API_KEY` 에 입력 후 재배포.
2. 각 작품당 실제 인쇄 파일(고해상도 TIFF/PNG, 최소 300dpi)을 준비.
   - Gelato는 **외부 URL**로 파일을 받기 때문에, 파일은 S3/Cloudflare R2/GitHub Release 등 **공개 URL**에 올려둡니다.
   - 비율별 9종 (3:4/4:3/3:2 × S/M/L) 세트를 준비하거나, 캔버스 최대 사이즈 하나를 업로드하면 Gelato가 자동 리사이즈 해줍니다.
3. Admin → Artworks → (작품 선택) → **Gelato product UIDs & print URLs** 를 펼쳐서
   - **Gelato product UID**: Gelato 상품 카탈로그의 정식 UID. 기본값(`canvas_product_canvas-450-gsm_...`)이 맞지 않으면 Gelato 대시보드에서 실제 UID를 복사해 덮어씁니다.
   - **print URL**: 공개 인쇄 파일 URL.
4. 각 포맷/사이즈 행마다 저장을 누르면 `gelato_variants` 테이블에 저장됩니다.

`print_url`이 모든 아이템에 세팅된 주문은 Stripe 결제가 끝나면 자동으로 Gelato로 제출되고, 주문 상태가 `paid → submitted → in_production → shipped → delivered`로 업데이트됩니다(Gelato 웹훅은 `/api/webhook/gelato` 로 받습니다. Gelato 대시보드에서 URL을 등록해 주세요).

`print_url`이 없는 아이템이 있는 주문은 `paid_hold` 상태로 보류되고, Admin → Orders 에서 수동으로 **Submit to Gelato** 할 수 있습니다.

## 6. 운영 체크리스트

- [ ] `ADMIN_PASSWORD` / `SESSION_SECRET` 주입 후 재배포
- [ ] Vercel Postgres 프로비저닝 (`POSTGRES_URL` 자동 주입)
- [ ] `/admin` 로그인 가능 확인
- [ ] Admin → Setup → **Run migrations (+seed)** 실행
- [ ] `/preview` 에서 작품 8개가 API 에서 불러져 뜨는지 확인
- [ ] Stripe **test mode**로 테스트 결제 1건
- [ ] `checkout.session.completed` 웹훅 도착 확인 → orders 행이 `paid` 로 바뀌는지 확인
- [ ] Gelato 연동 시점에 `GELATO_API_KEY` 와 작품별 `product_uid` / `print_url` 등록
- [ ] DNS 는 artsison.com 이미 연결되어 있음 — 필요 시 Vercel 프로젝트 → Domains 에서 확인
