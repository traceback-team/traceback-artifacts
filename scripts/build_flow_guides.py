"""Build infrastructure maps 03–05; guides 01–02 are hand-authored."""

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "docs" / "artifact"
BACKEND = "9e2108948c720497f65043b913cb55984a4243e1"
CLIENT = "afd7664ce2e1b5d58f8f259b73b352878bdbf0e8"


def source(repo: str, revision: str, path: str, lines: str, label: str) -> str:
    return (
        f'<a href="https://github.com/traceback-team/{repo}/blob/{revision}/{path}#L{lines}">'
        f"{escape(label)}</a>"
    )


PAGES = [
    {
        "file": "flow-1-system.html",
        "num": "01",
        "kicker": "서비스의 전체 경계",
        "title": "TRACEBACK 스토어의 화면과 API는 어디에 있을까?",
        "lead": "TRACEBACK은 상품 탐색·장바구니·결제·주문 조회를 목표로 하는 온라인 스토어입니다. 현재 개발 브랜치는 인증·계정 구현과 프런트 와이어프레임 중심입니다. 고객 요청 경로와 Client→Vercel, Server→AWS의 별도 배포 구성을 함께 봅니다.",
        "nodes": [
            ("고객", "브라우저", "스토어 화면·인증 요청", "client"),
            ("프런트엔드", "Vercel · React Router", "페이지 제공·API 경로 rewrite", "front"),
            ("백엔드", "EC2 · Django", "인증 구현·다른 기능 계획", "api"),
            ("데이터", "RDS · PostgreSQL", "DB 연결 검증 별도", "data"),
        ],
        "caption": "브라우저의 페이지 요청은 Vercel에서 처리합니다. /api, /accounts, /_allauth 요청은 Vercel 설정의 DJANGO_ORIGIN을 통해 Django 쪽으로 전달하도록 정의되어 있습니다. Django가 DB를 사용합니다.",
        "status": "스토어·장바구니·주문은 제품 목표이고, 현재 확인한 개발 코드는 인증·계정과 프런트 와이어프레임 중심입니다. Vercel rewrite는 코드에 정의되어 있지만 2026-10-04 관찰 기록에는 API HTTPS가 연결 거부 상태였습니다. 지금의 외부 접속은 다시 확인해야 합니다.",
    },
    {
        "file": "flow-2-access.html",
        "num": "02",
        "kicker": "운영자의 서버 접속",
        "title": "운영자는 개발 EC2에 어떻게 들어갈까?",
        "lead": "운영자가 터미널에서 EC2의 셸을 여는 경로입니다. TRACEBACK의 개발 환경은 Session Manager(SSM)를 사용하도록 준비했습니다.",
        "nodes": [
            ("운영자", "Mac · AWS CLI", "Identity Center 로그인", "client"),
            ("AWS", "Session Manager", "세션 권한 검사·중계", "aws"),
            ("개발 서버", "EC2 · SSM Agent", "AWS 서비스로 연결", "api"),
            ("결과", "EC2의 Linux 셸", "명령 입력·결과 확인", "data"),
        ],
        "caption": "사람은 AWS에 세션을 요청하고, EC2의 Agent는 자신의 IAM 역할과 네트워크 경로로 AWS에 연결합니다. 셸 접속을 위해 EC2의 SSH 22번 포트를 열 필요가 없습니다.",
        "status": "2026-10-04 문서 기록에는 개발 EC2의 SSM Agent Online과 인바운드 22 차단이 확인되어 있습니다. 콘솔 상태는 바뀔 수 있으므로 접속 시 다시 확인합니다.",
    },
    {
        "file": "flow-3-deploy.html",
        "num": "03",
        "kicker": "Client와 Server의 별도 배포",
        "title": "Client는 Vercel에, Server는 AWS에 어떻게 배포할까?",
        "lead": "두 저장소의 배포 경로를 나란히 봅니다. 백엔드 development는 Actions·ECR·SSM·EC2로, 프런트 development는 별도 Vercel 프로젝트로 향합니다. 각 환경변수를 어디에 저장하고 누가 읽는지도 표시합니다.",
        "nodes": [
            ("소스", "GitHub development", "push 또는 PR", "client"),
            ("검증", "Actions · CI", "품질·테스트", "front"),
            ("이미지", "Amazon ECR", "SHA 이미지·digest", "aws"),
            ("서버", "SSM → 개발 EC2", "pull·migration·healthcheck", "api"),
        ],
        "caption": "이 첫 줄은 Server→AWS의 경로입니다. 아래에는 Client→Vercel 경로와 두 배포의 설정 저장 위치를 나란히 그렸습니다.",
        "status": "workflow와 GitHub development 변수는 확인했습니다. 실제 배포 완료 여부와 외부 HTTPS·DB 연결은 CI 설정만으로 증명되지 않습니다. production Environment는 2026-10-08 확인 시 변수와 보호 규칙이 없어 운영 배포 준비가 완료되지 않았습니다.",
    },
    {
        "file": "flow-4-address.html",
        "num": "04",
        "kicker": "API 서버의 이름과 주소",
        "title": "Vercel은 개발 API 서버를 어떤 주소로 찾을까?",
        "lead": "개발 API는 도메인 이름을 통해 EC2의 고정 공인 IP에 연결하도록 설정했습니다. 이름을 찾는 것과 HTTPS 요청에 성공하는 것은 서로 다른 단계입니다.",
        "nodes": [
            ("프런트 설정", "DJANGO_ORIGIN", "https://api.dev-traceback.com", "front"),
            ("이름", "Route 53 · A 레코드", "api.dev-traceback.com", "aws"),
            ("주소", "Elastic IP", "3.34.78.140", "api"),
            ("대상", "개발 EC2", "Nginx → Django 예정", "data"),
        ],
        "caption": "Vercel의 rewrite가 API origin을 사용합니다. DNS는 도메인의 IP를 알려주고, Elastic IP는 개발 EC2에 붙습니다. 그 다음 HTTPS/TLS와 API 앱이 준비되어야 응답이 돌아옵니다.",
        "status": "2026-10-04 관찰 기록에는 도메인·A 레코드·EIP와 HTTP 80 경로가 확인됐고, TLS 443과 API 연결은 대기 중이었습니다. 현재 AWS·Vercel 콘솔 상태는 재확인이 필요합니다.",
    },
    {
        "file": "flow-5-dns.html",
        "num": "05",
        "kicker": "이름을 찾은 뒤 웹 연결",
        "title": "api.dev-traceback.com을 열면 어떤 순서로 연결될까?",
        "lead": "도메인 조회는 접속할 IP를 찾는 단계입니다. 그 답을 받은 다음에야 브라우저 또는 Vercel이 EC2의 HTTPS 서비스에 연결을 시도합니다.",
        "nodes": [
            ("요청자", "Vercel 또는 브라우저", "API 도메인 조회", "client"),
            ("주소 찾기", "DNS · Route 53", "A 레코드 → EIP", "aws"),
            ("암호화 연결", "EC2 · TLS 443", "인증서·Nginx 필요", "api"),
            ("응답", "Django → RDS", "API·DB 동작 확인", "data"),
        ],
        "caption": "Route 53이 웹 요청을 전달하는 것은 아닙니다. DNS가 IP를 알려준 뒤 요청자가 그 IP의 443번 포트에 새 연결을 만듭니다. 서버와 DB까지 정상이어야 API 응답이 완성됩니다.",
        "status": "2026-10-04에는 DNS 답은 확인됐지만 HTTPS 연결은 실패했습니다. DNS 성공을 서비스 배포 완료로 읽지 않습니다. 최신 상태는 TLS, Nginx, Django, RDS를 순서대로 검증해야 합니다.",
    },
]


STYLE = """
  :root{font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;color:#173042;background:#f4f7f8;line-height:1.6}
  *{box-sizing:border-box}body{margin:0}main{max-width:1110px;margin:auto;padding:24px clamp(16px,4vw,44px) 90px}
  a{color:#075c83}a:focus-visible,button:focus-visible{outline:3px solid #e39a36;outline-offset:3px}
  .top{display:flex;justify-content:space-between;gap:12px;align-items:center}.top a{font-weight:700}.top button{border:1px solid #9bb7c6;border-radius:8px;background:white;padding:8px 12px;font:inherit;cursor:pointer}
  .hero{padding:clamp(22px,5vw,50px) 0 30px}.eyebrow{color:#096a8e;font-size:.78rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  h1{font-size:clamp(2rem,5.5vw,3.8rem);line-height:1.16;letter-spacing:-.045em;max-width:17ch;margin:10px 0 18px;word-break:keep-all}
  .lead{max-width:77ch;font-size:1.08rem;color:#4b6270}h2{font-size:1.3rem;margin:0 0 8px}.panel{background:white;border:1px solid #cad9e1;border-radius:16px;padding:clamp(18px,3vw,30px);margin:15px 0}
  .flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;list-style:none;padding:0;margin:24px 0}.flow li{position:relative;min-width:0;border:2px solid #7eaebd;border-radius:12px;padding:15px;background:#edf7f9}
  .flow li:not(:last-child)::after{content:'→';position:absolute;right:-19px;top:42%;color:#096a8e;font-size:1.3rem;font-weight:900}.flow small{display:block;font-weight:800;color:#096a8e}.flow strong{display:block;margin:4px 0;font-size:1.08rem;line-height:1.25}.flow span{display:block;color:#536977;font-size:.82rem}.flow .api{border-color:#9b8ccd;background:#f5f2fc}.flow .data{border-color:#7aaa8d;background:#f0f8f2}
  .caption{margin:0;color:#405768}.status{border-left:4px solid #b47822;background:#fff8eb;padding:14px 18px;color:#5d472d}.links{display:flex;flex-wrap:wrap;gap:10px;list-style:none;margin:15px 0 0;padding:0}.links a{display:block;border:1px solid #b9d0dc;border-radius:9px;background:#f1f8fb;padding:10px 12px;text-decoration:none;font-weight:650;font-size:.9rem}.links a:hover{background:#e2f1f7}
  .next{display:flex;justify-content:space-between;gap:12px;margin-top:25px;font-weight:750}.source-note{font-size:.78rem;color:#637481;margin-top:14px}
  @media(max-width:700px){.flow{grid-template-columns:1fr;gap:21px}.flow li:not(:last-child)::after{content:'↓';left:50%;right:auto;top:auto;bottom:-25px}.next{flex-direction:column}.top{align-items:start}.top button{flex:none}}
  @media print{body{background:white}.top,button,.next{display:none!important}.panel,.flow li{break-inside:avoid}.flow{grid-template-columns:repeat(4,minmax(0,1fr))}a{color:inherit}}
  .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.facts article{background:#f1f7f9;border:1px solid #c8dce6;border-radius:10px;padding:14px}.facts h3{font-size:1rem;margin:0 0 7px}.facts p{font-size:.9rem;color:#435b69;margin:0}
  @media(max-width:700px){.facts{grid-template-columns:1fr}}
  .config-head{margin:38px 0 10px}.config-head p{color:#526977;margin:0}.lanes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.lane{border:1px solid #bdd2dc;border-radius:14px;background:#fff;padding:20px;min-width:0}.lane.frontend{border-top:5px solid #23769a}.lane.backend{border-top:5px solid #7262a4}.lane h3{margin:0 0 14px;font-size:1.1rem}.lane ol{padding-left:23px;margin:0}.lane li{padding:0 0 14px 5px}.lane li:last-child{padding-bottom:0}.lane li::marker{font-weight:800;color:#137090}.lane strong{display:block}.lane small{display:block;color:#526977;line-height:1.45}.config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.config-card{border:1px solid #c8d8e0;border-radius:12px;background:#fff;padding:18px;min-width:0}.config-card h3{margin:0 0 8px;font-size:1.04rem}.config-card p{margin:8px 0;color:#405768}.config-card ul{margin:8px 0 0;padding-left:20px}.config-card li{margin:4px 0}.config-card code,.lane code{overflow-wrap:anywhere;background:#edf4f7;padding:1px 3px;border-radius:3px}.config-card a,.lane a{overflow-wrap:anywhere}.badge{display:inline-block;padding:2px 7px;border-radius:5px;font-size:.75rem;font-weight:800;background:#e9f3e9;color:#236541}.badge.observed{background:#fff1d6;color:#805719}.badge.pending{background:#fce9e9;color:#a03333}.config-note{border-left:4px solid #8a659d;background:#f7f3fa;padding:13px 16px;margin:15px 0;color:#443a55}.config-note p{margin:0}.config-note p+p{margin-top:7px}.source-ref{font-size:.82rem;color:#546a78;margin-top:8px}
  @media(max-width:700px){.lanes,.config-grid{grid-template-columns:1fr}.config-head{margin-top:28px}}
  @media print{.lane,.config-card{break-inside:avoid}.lanes,.config-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .tabs{display:flex;gap:8px;border-bottom:2px solid #bfd1db;margin:24px 0 0}.tabs button{border:1px solid #a7c0cf;border-bottom:0;border-radius:10px 10px 0 0;padding:11px 17px;background:#e9f2f6;color:#284b60;font:inherit;font-weight:750;cursor:pointer}.tabs button[aria-selected=true]{background:#fff;color:#0b577d;border-color:#729fb5;box-shadow:inset 0 3px #0b779d}.tab-panel{background:#fff;border:1px solid #bfd1db;border-top:0;border-radius:0 0 15px 15px;padding:clamp(18px,3vw,30px)}.tab-panel[hidden]{display:none}.tab-panel h2{margin:4px 0 15px}.tab-panel h3{margin:0 0 8px}.branch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.branch{border:1px solid #c5d4dd;border-radius:12px;padding:17px;background:#f8fbfc}.branch.chosen{border:2px solid #166d8e;background:#eaf7fa}.branch p{margin:8px 0;color:#435b69;font-size:.91rem}.branch .term{margin:10px 0 0}.steps{list-style:none;counter-reset:step;padding:0;margin:0}.steps>li{counter-increment:step;border-left:3px solid #8eb8c8;padding:0 0 22px 24px;position:relative}.steps>li:last-child{padding-bottom:0}.steps>li::before{content:counter(step);position:absolute;left:-15px;top:0;border-radius:50%;width:26px;height:26px;text-align:center;background:#0d6b8b;color:#fff;font-weight:800}.steps h3{margin:0 0 5px}.steps p{margin:6px 0;color:#405768}.term{border-left:3px solid #8a659d;background:#f7f3fa;padding:9px 12px;font-size:.88rem;color:#463d57}.term b{color:#4f3a67}.term.network{border-color:#bc8d37;background:#fff8e8;color:#5a4728}.term.network b{color:#795614}.cmd{overflow-x:auto;background:#152b3a;color:#f5fafb;border-radius:9px;padding:13px 15px;font-size:.83rem;line-height:1.5;margin:9px 0}.cmd code{white-space:pre}.access-meta{font-size:.86rem;color:#557080}.tab-panel a{overflow-wrap:anywhere}
  @media(max-width:700px){.tabs button{flex:1;font-size:.86rem;padding:10px 7px}.branch-grid{grid-template-columns:1fr}}
  @media print{.tabs{display:none}.tab-panel[hidden]{display:block}.tab-panel{border:1px solid #bfd1db;border-radius:12px;margin:15px 0}.branch,.steps>li{break-inside:avoid}}
  .study{margin-top:26px}.study h2{margin:0 0 12px}.study details{background:#fff;border:1px solid #c8d8e0;border-radius:11px;padding:14px 17px;margin:10px 0}.study summary{cursor:pointer;font-weight:800;color:#185d7b}.study details p{color:#405768;margin:9px 0}.study figure{margin:17px 0;border:1px solid #d0dee4;border-radius:10px;overflow:hidden}.study img{display:block;width:100%;height:auto}.study figcaption{padding:9px 12px;color:#576d78;font-size:.82rem}.study pre{overflow-x:auto;background:#172e3b;color:white;padding:12px;border-radius:8px;font-size:.83rem}.study code{overflow-wrap:anywhere}.terms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.terms article{border:1px solid #cbd9e0;border-radius:10px;padding:15px;background:#fff}.terms .aws{border-top:4px solid #8463a3}.terms .general{border-top:4px solid #bb8b35}.terms h3{font-size:1rem;margin:0 0 7px}.terms p{margin:7px 0;color:#405768;font-size:.9rem}@media(max-width:700px){.terms{grid-template-columns:1fr}}@media print{.study details:not([open])>*:not(summary){display:block}.study details summary{display:none}.study details,.terms article{break-inside:avoid}}
  details.study{background:#fff;border:1px solid #c8d8e0;border-radius:11px;padding:14px 17px;margin:24px 0}details.study>summary{cursor:pointer;font-weight:800;color:#185d7b}@media print{details.study:not([open])>*:not(summary){display:block}details.study>summary{display:none}}
"""


def project_configuration(index: int) -> str:
    """Show observed and code-defined configuration on the main maps."""
    backend = lambda path, lines, label: source("traceback", BACKEND, path, lines, label)
    client = lambda path, lines, label: source("traceback-client", CLIENT, path, lines, label)
    if index == 0:
        return f'''<section class="config-head"><h2>실제 구성: 프런트와 서버는 따로 배포됩니다</h2><p>아래는 설정의 전체 연결입니다. 각 번호에서 같은 자원을 더 자세히 봅니다.</p></section>
<div class="lanes">
 <section class="lane frontend"><h3>Client → Vercel · 개발 경로</h3><ol>
  <li><strong><code>traceback-client</code> development</strong><small>React Router SSR 화면과 <code>vercel.ts</code> rewrite 정의</small></li>
  <li><strong>Vercel 개발 프로젝트</strong><small>Production Branch는 <code>development</code>; 공개 URL <code>traceback-client-nine.vercel.app</code>. 2026-09-26 SSR <code>/</code>와 <code>/auth/login</code>의 200 응답 기록.</small></li>
  <li><strong>Vercel 프로젝트 환경변수</strong><small>Production 범위의 <code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>을 읽어 <code>/_allauth/*</code>, <code>/accounts/*</code>, <code>/api/*</code>를 API로 전달. 2026-10-04 rewrite 적용 관찰, API는 502.</small></li>
 </ol><p class="source-ref">{client("docs/vercel-deployment.md", "1-L57", "Vercel 개발·운영 분리 근거")} · {client("vercel.ts", "1-L37", "rewrite 코드")}</p></section>
 <section class="lane backend"><h3>Server → AWS · 개발 경로</h3><ol>
  <li><strong><code>traceback</code> development → Actions</strong><small>quality·test 성공 뒤 development 배포 workflow 호출.</small></li>
  <li><strong>GitHub Environment <code>development</code> → AWS OIDC</strong><small>배포 role과 서울 리전, ECR repository, EC2 instance ID를 읽음. 실제 확인된 값은 03에 표시.</small></li>
  <li><strong>ECR → SSM → 개발 EC2</strong><small>commit SHA 태그 이미지의 digest로 배포하도록 정의. EC2의 <code>/opt/traceback/.env</code>와 private RDS는 별도 실행 설정.</small></li>
 </ol><p class="source-ref">{backend(".github/workflows/ci.yml", "120-L137", "CI 배포 분기")} · {backend(".github/workflows/deploy-development.yml", "14-L87", "AWS 배포 workflow")}</p></section>
</div><section class="config-head"><h2>서비스 기능이 붙는 지점</h2><p>현재 코드에 있는 기능과 설계만 있는 기능을 같은 인프라 위에서 구분합니다.</p></section><div class="config-grid">
 <article class="config-card"><h3>브라우저 ↔ Django 인증</h3><span class="badge">development 코드 확인</span><p>Vercel은 <code>/_allauth/*</code>, <code>/accounts/*</code>, <code>/api/*</code>를 백엔드로 보냅니다. Django에는 allauth Headless, 세션·CSRF 미들웨어, Kakao provider, <code>accounts</code> 앱이 정의되어 있습니다. 브라우저 화면에는 로그인·계정·스토어·장바구니·체크아웃·주문 경로가 있으나 후자의 제품 기능은 와이어프레임 단계입니다.</p><p>{backend("config/settings/base.py", "22-L49", "인증 앱·미들웨어")} · {client("app/routes.ts", "8-L32", "화면 경로")}</p></article>
 <article class="config-card"><h3>Django → RDS · 메일 · Kakao</h3><span class="badge pending">외부 연결 검증 전</span><p>Django의 <code>TRACEBACK_DATABASE_URL</code>은 PostgreSQL 연결, <code>FRONTEND_BASE_URL</code>은 확인·비밀번호 링크, <code>EMAIL_*</code>은 SES SMTP 587/STARTTLS, <code>KAKAO_*</code>는 소셜 인증에 사용됩니다. 개발 EC2의 실제 값과 외부 성공은 별도로 확인해야 합니다.</p><p>{backend("config/settings/base.py", "70-L75", "DB 설정")} · {backend("config/settings/base.py", "101-L119", "SMTP 설정")} · {backend("config/settings/base.py", "135-L177", "프런트·Kakao·allauth 설정")}</p></article>
 <article class="config-card"><h3>파일 → S3</h3><span class="badge observed">2026-10-04 인프라 관찰</span><p>개발용 private S3 버킷은 배포 준비 기록에 있습니다. 업로드 기능의 코드 연결·파일 왕복은 아직 구현/검증 상태로 표시하지 않습니다. 프런트 SSR은 S3 정적 사이트가 아니라 Vercel에 있습니다.</p><p>{backend("docs/system.md", "69-L83", "환경과 S3 설계")}</p></article>
 <article class="config-card"><h3>도메인 → API 서버</h3><span class="badge observed">2026-10-04 DNS 관찰</span><p><code>api.dev-traceback.com</code> A 레코드 → EIP <code>3.34.78.140</code> → 개발 EC2. 당시 HTTP 80/ACME는 확인됐지만 HTTPS 443·Nginx 프록시·Django 앱·RDS까지 이어지는 외부 요청은 완료되지 않았습니다.</p></article>
</div><div class="config-note"><p><b>실제 요청의 연결:</b> 고객 브라우저 → Vercel SSR/동일 origin API 경로 → <code>DJANGO_ORIGIN</code> → Route 53 A 레코드 → EIP <code>3.34.78.140</code> → 개발 EC2의 443/Nginx → Django → private RDS. DNS/EIP와 HTTP 80은 2026-10-04 관찰됐지만, 443·앱·DB까지 통과한 요청은 확인되지 않았습니다.</p><p><b>운영 환경:</b> 백엔드에는 <code>main</code> 배포 workflow가 정의되어 있고 별도 Vercel 프로젝트를 계획했습니다. 운영 Vercel·EC2·RDS 연결을 완료한 상태로 표시하지 않습니다.</p></div>'''
    if index == 2:
        return f'''<section class="config-head"><h2>Client 배포와 Server 배포</h2><p>두 저장소는 배포 대상과 설정 저장 위치가 다릅니다. <b>Vercel의 Production 범위</b>는 현재 개발 프로젝트의 브랜치 범위이며 TRACEBACK 운영 환경을 뜻하지 않습니다.</p></section>
<div class="lanes"><section class="lane frontend"><h3>Client → Vercel 개발 프로젝트</h3><ol>
 <li><strong><code>traceback-client</code>의 development</strong><small>Vercel 개발 프로젝트의 Production Branch로 지정. 2026-09-26 SSR 페이지 200 기록.</small></li>
 <li><strong>Vercel Environment Variables · Production 범위</strong><small><code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>. <code>vercel.ts</code>가 빌드/배포 시 HTTPS origin을 검사하고 인증·API 경로를 rewrite합니다. 2026-10-04 설정·재배포 기록은 있으나 API 응답은 502였습니다.</small></li>
 <li><strong>브라우저 origin</strong><small><code>https://traceback-client-nine.vercel.app</code>. <code>FRONTEND_ORIGIN</code>은 클라이언트 문서의 환경별 형식 설명이고 로컬 <code>.env.example</code>은 Vercel에 자동 업로드되지 않습니다.</small></li>
 </ol><p class="source-ref">{client("docs/vercel-deployment.md", "14-L58", "Vercel 설정 문서")} · {client("vercel.ts", "1-L37", "실제 rewrite")}</p></section>
 <section class="lane backend"><h3>Server → AWS 개발 EC2</h3><ol>
 <li><strong><code>traceback</code> development push</strong><small>Actions <code>quality</code>·<code>test</code> 성공이 배포 선행 조건. PR에는 검사만 하고 push는 개발 배포를 호출합니다.</small></li>
 <li><strong>GitHub Environment <code>development</code></strong><small><code>AWS_DEPLOY_ROLE_ARN</code>으로 OIDC role 인수, <code>AWS_REGION</code>·<code>ECR_REPOSITORY</code>·<code>DEVELOPMENT_INSTANCE_ID</code>를 읽습니다.</small></li>
 <li><strong>ECR → SSM → EC2</strong><small>Docker image를 SHA 태그로 저장하고 digest로 고정. SSM은 EC2에서 Compose config → migration → 앱 재시작/health를 실행하도록 정의합니다.</small></li>
 </ol><p class="source-ref">{backend(".github/workflows/ci.yml", "120-L137", "CI 분기")} · {backend(".github/workflows/deploy-development.yml", "14-L87", "개발 배포")} · {backend(".github/scripts/deploy-common.sh", "19-L36", "EC2 실행 단계")}</p></section></div>
<details class="study"><summary>개발·운영 환경변수의 실제 위치와 값 펼치기</summary><section class="config-head"><h2>값은 어디에 들어가나요?</h2><p>코드에 있는 예시 파일과 실제 서비스 설정을 구분합니다.</p></section><div class="config-grid">
 <article class="config-card"><h3>GitHub Environment · development</h3><span class="badge observed">2026-10-08 GitHub API 확인</span><ul><li><code>AWS_DEPLOY_ROLE_ARN=arn:aws:iam::968579693658:role/traceback-development-deploy</code></li><li><code>AWS_REGION=ap-northeast-2</code></li><li><code>ECR_REPOSITORY=traceback</code></li><li><code>DEVELOPMENT_INSTANCE_ID=i-051f85a1ac4e64a2c</code></li></ul><p>Actions가 AWS에 배포할 때 쓰는 비밀이 아닌 변수입니다. 서버의 Django secret이나 DB 비밀번호를 이 값으로 채우지 않습니다.</p></article>
 <article class="config-card"><h3>개발 EC2 · <code>/opt/traceback/.env</code></h3><span class="badge pending">실제 파일 미확인</span><p>각 EC2에서 Django가 읽을 런타임 설정 위치입니다. 템플릿에는 <code>DJANGO_SECRET_KEY</code>, allowed hosts·CSRF origins, <code>TRACEBACK_DATABASE_URL</code>, <code>FRONTEND_BASE_URL</code>, SES SMTP, Kakao 키가 있습니다. GitHub Environment와 자동 동기화되지 않습니다.</p><p>{backend("config/server.env.example", "1-L21", "EC2 환경 파일 템플릿")} · {backend(".github/scripts/deploy-common.sh", "1-L36", "EC2에서 .env 사용")}</p></article>
 <article class="config-card"><h3>GitHub Environment · production</h3><span class="badge pending">2026-10-08 변수 0개 확인</span><p><code>main</code> push 후 개발에서 성공한 같은 image digest를 운영 EC2에 승격하도록 workflow가 작성됐습니다. 그러나 현재 production Environment에는 배포 변수도 보호 규칙도 확인되지 않았고 운영 EC2/RDS 배포도 검증되지 않았습니다. 저장소의 <code>.env.prod.git</code>는 자리표시자 템플릿입니다.</p><p>{backend(".github/workflows/deploy-production.yml", "16-L79", "운영 승격 조건·대상")} · {backend(".env.prod.git", "1-L10", "운영 변수 템플릿")}</p></article>
 <article class="config-card"><h3>Vercel · 운영 프로젝트</h3><span class="badge pending">미구성</span><p>운영은 개발 Vercel 프로젝트와 별도 프로젝트, 별도 도메인, 별도 <code>DJANGO_ORIGIN</code>을 사용할 설계입니다. 현재 클라이언트 문서에는 운영 프로젝트가 아직 배포·설정되지 않았다고 명시합니다. 개발 프로젝트의 Production 범위를 운영 설정으로 재사용하지 않습니다.</p><p>{client("docs/vercel-deployment.md", "1-L20", "환경 분리")} · {client("docs/vercel-deployment.md", "57-L58", "운영 미설정")}</p></article>
</div></details><div class="config-note"><p><b>설정 파일을 읽는 주체:</b> GitHub Environment 변수는 Actions runner, Vercel 변수는 Vercel 배포의 <code>vercel.ts</code>, EC2 <code>.env</code>는 Docker Compose/Django입니다. <code>.env.dev.git</code>·<code>.env.prod.git</code>와 <code>server.env.example</code>은 작성 양식이며 실제 서버 비밀값의 증거가 아닙니다.</p><p><b>검증 상태:</b> workflow와 GitHub development 변수는 확인했습니다. ECR 이미지의 현재 존재·SSM 배포 성공·EC2 런타임·RDS 연결·외부 HTTPS는 별도 확인이 필요합니다.</p></div>'''
    if index == 3:
        return f'''<section class="config-head"><h2>개발 주소에 실제로 입력한 값</h2><p>2026-10-03~04 AWS/Vercel 관찰 기록이며 현재 콘솔 상태는 재확인이 필요합니다.</p></section><div class="config-grid">
 <article class="config-card"><h3>Route 53 · 도메인과 레코드</h3><span class="badge observed">당시 DNS 응답 확인</span><p>등록 도메인 <code>dev-traceback.com</code>. Public hosted zone의 <code>api.dev-traceback.com</code> A 레코드가 <code>3.34.78.140</code>을 반환하고 TTL은 300초였습니다. 등록 네임서버와 hosted zone의 네임서버도 일치한 기록입니다.</p></article>
 <article class="config-card"><h3>AWS EC2 · Elastic IP</h3><span class="badge observed">당시 연결 확인</span><p>EIP <code>3.34.78.140</code>을 개발 EC2 <code>i-051f85a1ac4e64a2c</code>에 연결했습니다. 서버가 다시 시작되어도 DNS의 주소를 유지하려는 설정입니다. EIP는 사용 여부와 관계없이 공인 IPv4 비용 대상입니다.</p></article>
 <article class="config-card"><h3>Vercel · API origin</h3><span class="badge observed">2026-10-04 재배포 기록</span><p>개발 Vercel 프로젝트의 Production 범위에 <code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>. <code>vercel.ts</code>는 HTTPS origin만 허용하며 <code>/_allauth/*</code>, <code>/accounts/*</code>, <code>/api/*</code>를 해당 origin으로 전달합니다.</p><p>{client("vercel.ts", "1-L37", "검사·rewrite 코드")}</p></article>
 <article class="config-card"><h3>EC2 · HTTP와 HTTPS</h3><span class="badge pending">443 연결 대기</span><p>보안 그룹 인바운드 80/443 허용, 22 닫힘. HTTP 80의 Nginx·ACME 경로는 관찰됐습니다. 2026-10-04 HTTPS 443은 연결 거부, API 경로는 502였습니다. 인증서 발급, 443 프록시, Django image 실행이 남아 있었습니다.</p></article>
</div><div class="config-note"><p><b>연결 경계:</b> Vercel에 origin을 저장하고 Route 53 A 레코드가 답하는 것만으로 EC2의 443과 Django가 열리는 것은 아닙니다. 실제 API 요청은 DNS 이후 EC2 보안 그룹 → TLS/Nginx → Django 순서로 통과해야 합니다.</p></div>'''
    return f'''<section class="config-head"><h2>TRACEBACK API 요청의 실제 체크포인트</h2><p>2026-10-04 관찰값과 다음 연결 단계입니다. DNS·HTTP 용어는 이 화면 아래에서 설명합니다.</p></section><div class="config-grid">
 <article class="config-card"><h3>① Vercel rewrite</h3><span class="badge observed">설정·재배포 기록</span><p>브라우저가 개발 프런트 주소의 <code>/api/*</code> 또는 인증 경로를 요청합니다. Vercel은 <code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>을 목적지로 사용합니다.</p><p>{client("vercel.ts", "1-L37", "rewrite 세 경로")}</p></article>
 <article class="config-card"><h3>② DNS 답과 EC2 주소</h3><span class="badge observed">당시 조회 확인</span><p><code>api.dev-traceback.com</code> A / TTL 300 → <code>3.34.78.140</code> → 개발 EC2. Route 53은 주소를 알려주며 HTTPS 요청 자체는 요청자가 새로 연결합니다.</p></article>
 <article class="config-card"><h3>③ 보안 그룹 → TLS/Nginx</h3><span class="badge pending">첫 연결 실패 지점</span><p>EC2 보안 그룹에는 443이 허용되어 있었지만 2026-10-04 외부 HTTPS 연결은 거부됐습니다. HTTP 80·ACME 경로 다음으로 인증서와 Nginx 443 reverse proxy를 준비해야 했습니다.</p></article>
 <article class="config-card"><h3>④ Django → private RDS → 응답</h3><span class="badge pending">끝까지 검증 전</span><p>EC2의 <code>/opt/traceback/.env</code>에는 allowed hosts·CSRF origins·DB URL·프런트 URL·메일/Kakao 값이 환경별로 필요합니다. RDS 5432는 EC2 보안 그룹에서만 허용한 기록입니다. 앱 이미지 배포와 migration, 외부 인증/API 응답은 확인되지 않았습니다.</p><p>{backend("config/server.env.example", "1-L21", "런타임 변수 위치")}</p></article>
</div><div class="config-note"><p><b>개발과 운영의 구분:</b> 이 도메인·IP·Vercel origin은 개발 환경의 값입니다. 운영 도메인·운영 Vercel·운영 EC2/RDS 연결은 확인되지 않았으므로 개발 값을 운영 경로에 복사하지 않습니다.</p></div>'''


def embedded_learning(index: int) -> str:
    """Keep choices, setup evidence, and just-in-time theory on each guide."""
    if index == 0:
        return '''<section class="study"><h2>이 구성에서 선택한 배치</h2>
<details><summary>프런트까지 EC2에 두는 방법과 왜 분리했는지</summary><p>프런트 SSR과 Django를 한 EC2에서 함께 운영할 수도 있습니다. TRACEBACK은 클라이언트의 React Router SSR을 Vercel 프로젝트에, API와 DB를 AWS에 분리했습니다. 프런트 배포와 서버 배포의 설정·실패 지점이 달라서 각각의 환경변수와 검증이 필요합니다. 인증·이메일의 내부 규칙은 로그인 주제에서 다룹니다.</p></details>
<div class="terms"><article class="aws"><h3>서비스 이름</h3><p><b>EC2:</b> Django가 실행될 AWS 가상 컴퓨터. <b>RDS:</b> PostgreSQL을 운영할 관리형 DB. <b>S3:</b> 추후 업로드 파일을 둘 object storage. <b>Vercel:</b> 클라이언트 SSR 배포 대상입니다.</p></article><article class="general"><h3>일반 구조 용어</h3><p><b>클라이언트/서버:</b> 사용자 화면과 요청을 처리하는 API의 역할. <b>SSR:</b> 페이지 HTML을 서버에서 렌더링해 보내는 방식. <b>rewrite:</b> 브라우저의 경로를 다른 origin의 API로 전달하는 라우팅 설정입니다.</p></article></div></section>'''
    if index == 2:
        return '''<section class="study"><h2>선택 이유와 실제 설정 순서</h2>
<details><summary>배포 대안을 어떻게 나눴고 왜 이 구성을 택했나?</summary><p>프런트와 백엔드를 한 EC2에서 함께 운영하면 대상이 하나지만 SSR 빌드·API·DB·TLS를 그 서버에서 함께 관리해야 합니다. TRACEBACK은 클라이언트 SSR은 Vercel, Django와 private RDS는 AWS로 분리했습니다. 백엔드 이미지는 ECR에 고정하고 SSM으로 EC2에 배포합니다. 더 관리형인 컨테이너 서비스나 로드 밸런서를 둘 수도 있지만 현재 작은 개발 환경은 EC2 한 대와 비용·운영 범위를 기준으로 설계했습니다. 운영 환경은 아직 준비되지 않았습니다.</p></details>
<details><summary>Client · Vercel 개발 프로젝트에서 한 설정</summary><p>Vercel 개발 프로젝트를 <code>traceback-client</code> 저장소에 연결하고 Production Branch를 <code>development</code>로 지정했습니다. 이 프로젝트의 Environment Variables 중 Production 범위에 <code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>을 저장하고 재배포했습니다. 이 범위 이름은 Vercel 프로젝트 안의 배포 범위이며 TRACEBACK의 production 인프라가 아닙니다. 2026-10-04 기록에서 rewrite는 적용됐고 API는 502였습니다.</p><p><b>코드 연결:</b> <code>vercel.ts</code> 1행이 <code>process.env.DJANGO_ORIGIN</code>을 읽고, 8–15행이 HTTPS origin 형식을 검사하며, 20–37행이 인증·API 세 경로의 rewrite를 만듭니다. <a href="https://github.com/traceback-team/traceback-client/blob/afd7664ce2e1b5d58f8f259b73b352878bdbf0e8/vercel.ts#L1-L37">client development · 원문</a></p></details>
<details><summary>Server · GitHub Environment와 AWS 대상에서 한 설정·캡처</summary><p>GitHub 저장소 Settings → Environments → <code>development</code>에서 배포 브랜치를 <code>development</code>로 제한하고, 네 변수를 입력했습니다. Actions는 OIDC로 <code>traceback-development-deploy</code> role을 맡아 <code>traceback</code> ECR repository에 이미지를 저장하고 SSM으로 EC2를 지정합니다. 개발 EC2 자체에는 별도 <code>/opt/traceback/.env</code>가 필요하며 그 실제 내용은 확인되지 않았습니다.</p><figure><img src="images/github-development-environment.png" loading="lazy" alt="GitHub Environments development 화면: development 브랜치 제한과 네 개의 배포 변수"><figcaption>2026-10-03 캡처 · GitHub Environment development의 브랜치 제한과 AWS_ROLE·REGION·INSTANCE_ID·ECR 변수. 현재 변수 값은 위의 2026-10-08 API 확인값을 기준으로 읽으세요.</figcaption></figure><figure><img src="images/aws-ecr-traceback.png" loading="lazy" alt="AWS ECR private repository traceback과 immutable tag 설정을 보여 주는 콘솔 화면"><figcaption>2026-10-03 캡처 · 서울 리전 private ECR repository <code>traceback</code>. 이 화면은 이미지가 배포됐다는 증거가 아닙니다.</figcaption></figure></details>
<div class="terms"><article class="aws"><h3>AWS·GitHub 용어</h3><p><b>GitHub Environment:</b> Actions job이 읽는 환경별 변수와 배포 규칙의 장소. <b>OIDC/IAM role:</b> GitHub job이 장기 AWS 키 없이 일시적인 AWS 권한을 받는 연결. <b>ECR:</b> 컨테이너 이미지를 저장하는 AWS registry. <b>SSM:</b> EC2에 원격 명령을 보내는 배포 경로입니다.</p></article><article class="general"><h3>일반 배포·코드 용어</h3><p><b>CI/CD:</b> 변경 검사와 배포 자동화. <b>이미지 digest:</b> 내용으로 고정한 이미지 식별자. <b>환경변수:</b> 실행 환경이 프로그램에 주는 설정값. Vercel 변수, Actions 변수, EC2 <code>.env</code>는 서로 다른 프로그램이 읽습니다. <b>migration:</b> DB 구조를 코드 변경에 맞추는 단계입니다.</p></article></div></section>'''
    if index == 3:
        return '''<section class="study"><h2>주소를 실제로 설정한 순서</h2>
<details><summary>고정 주소를 쓰는 선택과 대안</summary><p>EC2의 기본 공인 IPv4가 바뀌면 A 레코드를 갱신해야 합니다. 로드 밸런서를 앞에 둘 수도 있지만 현재 개발 환경에는 별도 장치와 비용이 늘어납니다. TRACEBACK은 EIP <code>3.34.78.140</code>을 개발 EC2에 연결하고 Route 53 A 레코드를 그 주소로 고정했습니다. 공인 IPv4 요금은 계속 확인해야 합니다.</p></details>
<details><summary>AWS·Vercel 콘솔에서 한 설정</summary><p>Route 53에서 <code>dev-traceback.com</code>을 등록하고 public hosted zone의 네임서버가 등록 도메인의 네임서버와 일치하는지 확인했습니다. EC2 → Elastic IPs에서 서울 리전 EIP를 할당하고 개발 EC2에 연결했습니다. Route 53 hosted zone에는 <code>api.dev-traceback.com</code> A 레코드 값 <code>3.34.78.140</code>, TTL <code>300</code>을 넣었습니다. Vercel 개발 프로젝트 Production 범위에는 <code>DJANGO_ORIGIN=https://api.dev-traceback.com</code>을 넣고 재배포했습니다. 2026-10-04에는 DNS 답과 HTTP 80만 확인됐습니다.</p></details>
<div class="terms"><article class="aws"><h3>AWS 용어</h3><p><b>Route 53:</b> 도메인 등록과 DNS 레코드를 관리하는 서비스. <b>Hosted zone:</b> 한 도메인에 대한 권한 DNS 레코드 묶음. <b>Elastic IP:</b> AWS 계정에 할당한 고정 공인 IPv4입니다.</p></article><article class="general"><h3>일반 네트워크 용어</h3><p><b>도메인/IP:</b> 사람이 쓰는 이름과 연결 대상의 숫자 주소. <b>A 레코드:</b> 이름에 IPv4 주소를 답하는 DNS 기록. <b>TTL:</b> resolver가 답을 캐시할 수 있는 시간. 이름이 IP를 찾았어도 HTTPS 서버가 동작한다는 뜻은 아닙니다.</p></article></div></section>'''
    return '''<section class="study"><h2>이름을 찾은 다음의 연결</h2>
<details><summary>TLS를 어디서 처리할 수 있고 TRACEBACK은 무엇을 준비했나?</summary><p>인증서와 TLS 종료를 로드 밸런서에서 처리할 수도 있고 EC2의 Nginx에서 처리할 수도 있습니다. 현재 개발 구성은 별도 로드 밸런서 없이 EC2 Nginx가 80의 ACME 확인 경로를 받고, 다음으로 인증서와 443 reverse proxy를 준비하는 방식입니다. 2026-10-04에는 443 연결이 거부되어 이 선택의 완성 상태를 주장하지 않습니다.</p></details>
<details><summary>2026-10-04 확인과 남은 설정을 순서대로 보기</summary><p>① Route 53 A/TTL 300 → EIP <code>3.34.78.140</code>은 DNS 응답으로 확인했습니다. ② EC2 보안 그룹은 inbound 80/443을 허용했지만 443에서 응답하는 TLS 서비스는 없었습니다. ③ HTTP 80 Nginx·ACME 경로 다음으로 인증서를 발급하고 Nginx 443에서 Django 앱으로 proxy를 설정해야 했습니다. ④ EC2의 Django <code>.env</code>, 앱 이미지, migration, private RDS 5432 연결을 확인한 뒤 Vercel 인증/API 요청을 다시 검증해야 합니다.</p><p>확인 명령의 예: <code>dig api.dev-traceback.com A</code>는 DNS 답을, <code>curl -I https://api.dev-traceback.com</code>은 그 뒤 HTTPS 응답을 따로 검사합니다. 이 문서 작성 중 최신 외부 요청을 재실행하지 않았습니다.</p></details>
<div class="terms"><article class="aws"><h3>AWS 용어</h3><p><b>Route 53:</b> DNS 응답을 관리합니다. <b>Security Group:</b> EC2로 들어오는 새 연결을 허용할지 정합니다. <b>RDS:</b> 앱이 private 5432로 연결하는 PostgreSQL 대상입니다.</p></article><article class="general"><h3>일반 네트워크·웹 용어</h3><p><b>DNS:</b> 도메인에 대한 IP를 찾는 과정. <b>TCP 443/TLS:</b> 서버와 암호화 연결을 만드는 단계. <b>HTTP:</b> 연결 위에서 요청과 응답을 교환하는 규칙. <b>reverse proxy:</b> Nginx가 받은 요청을 Django에 전달하는 역할입니다.</p></article></div></section>'''


def render(page: dict, index: int) -> str:
    nodes = "".join(
        f'<li class="{kind}"><small>{escape(owner)}</small><strong>{escape(name)}</strong><span>{escape(role)}</span></li>'
        for owner, name, role, kind in page["nodes"]
    )
    prev_link = f'<a href="{PAGES[index-1]["file"]}">← {PAGES[index-1]["num"]} 이전 흐름</a>' if index else '<a href="index.html">← 전체 구조</a>'
    next_link = f'<a href="{PAGES[index+1]["file"]}">{PAGES[index+1]["num"]} 다음 흐름 →</a>' if index < len(PAGES)-1 else '<a href="index.html">다른 주제 →</a>'
    if index == 2:
        overview = '''<section class="panel" aria-labelledby="flow-title"><h2 id="flow-title">두 배포 경로</h2><div class="lanes">
<div class="lane frontend"><h3>Client → Vercel</h3><ol><li><strong>traceback-client · development</strong></li><li><strong>Vercel 개발 프로젝트</strong></li><li><strong>traceback-client-nine.vercel.app</strong></li></ol></div>
<div class="lane backend"><h3>Server → AWS</h3><ol><li><strong>traceback · development → Actions</strong></li><li><strong>GitHub Environment → OIDC → ECR</strong></li><li><strong>SSM → 개발 EC2 → private RDS</strong></li></ol></div>
</div><p class="caption">각 경로의 실제 설정 위치, 값, 상태는 바로 아래에 있습니다.</p></section>'''
    else:
        overview = f'<section class="panel" aria-labelledby="flow-title"><h2 id="flow-title">한눈에 보는 경로</h2><ol class="flow" aria-label="{escape(page["caption"])}">{nodes}</ol><p class="caption">{escape(page["caption"])}</p></section>'
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(page["num"] + " · " + page["title"])} · TRACEBACK</title><style>{STYLE}</style></head>
<body><main><nav class="top" aria-label="문서 탐색"><a href="index.html">← TRACEBACK 전체 구조</a><button type="button" onclick="window.print()">PDF로 저장</button></nav>
<header class="hero"><p class="eyebrow">TRACEBACK 설계·구현 · {page["num"]} / 05 · {escape(page["kicker"])}</p><h1>{escape(page["title"])}</h1><p class="lead">{escape(page["lead"])}</p></header>
{overview}
{project_configuration(index)}
{embedded_learning(index)}
<section class="panel" aria-labelledby="status-title"><h2 id="status-title">현재 확인 범위</h2><p class="status">{escape(page["status"])}</p></section>
<p class="source-note">코드 확인 기준: backend 배포 PR #12 <code>phase-0-development-deployment</code> {BACKEND[:12]} · client development {CLIENT[:12]}. 설정 근거는 해당 단계 바로 옆에 표시했습니다. AWS·Vercel 콘솔 관찰값에는 날짜를 붙였습니다.</p>
<nav class="next" aria-label="앞뒤 흐름">{prev_link}{next_link}</nav></main><script src="feedback.js" defer></script></body></html>
'''


if __name__ == "__main__":
    for index, page in enumerate(PAGES):
        if index in (0, 1):
            # System and access guides are authored in place for their detailed layouts.
            continue
        (ROOT / page["file"]).write_text(render(page, index), encoding="utf-8")
