# EduGame Studio V4.1

Nền tảng tạo trò chơi dạy học đa môn bằng React, TypeScript, MariaDB và backend/worker Node.js. Bản local phục vụ kiểm thử/nghiệm thu; học liệu minh họa chưa được duyệt để dạy chính thức.

## Chạy local

Yêu cầu Node.js 22+, Docker Desktop đã cài. Làm tại thư mục gốc; không chạy trong bản sao `duong/`.

```powershell
cd C:\project\duong
npm ci
npm run dev:all
```

- Giao diện: [127.0.0.1:5173](http://127.0.0.1:5173)
- API: [127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)
- Database: [phpMyAdmin – supabase_db_duong](http://localhost:8081/index.php?route=/database/structure&db=supabase_db_duong)
- Hộp thư xác minh/đặt lại mật khẩu: [127.0.0.1:8025](http://127.0.0.1:8025)

`dev:all` tự chờ Docker → MariaDB/Mailpit → API và danh mục → worker/web. Trên Windows, khi Docker đã dừng, launcher lưu thư mục runtime socket cũ sang `run-stale-*` rồi tạo runtime sạch trước khi bật Docker. Không chạm vào runtime khi engine đang chạy. Khi mất kết nối database, launcher thử phục hồi dịch vụ và trang tự tải lại danh mục. Có thể bấm đúp `Chay-du-an.cmd` nếu không dùng terminal; launcher dùng trực tiếp Node nên không cần `npm` trong tiến trình Windows Startup.

Để tự chạy nền sau khi đăng nhập Windows (chỉ cài một lần):

```powershell
npm run local:autostart
```

Mục tự chạy là `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DuongLearningLocal.vbs`. Log tại `data/local-runtime/launcher.log`, khóa tránh chạy trùng tại `data/local-runtime/dev.lock`. Dừng bộ tiến trình nền hiện tại bằng `npm run local:stop` (giữ Docker/database); dùng Ctrl+C nếu chạy trong terminal. Muốn tắt tự chạy ở các lần đăng nhập sau, bỏ riêng mục `DuongLearningLocal.vbs` trong thư mục Startup; không xóa volume/database. Không cần mở trình duyệt tự động. Nếu Docker không thể lên trong 3 phút, xem log và thông báo trong Docker Desktop.

MariaDB mặc định tại `127.0.0.1:3306`, database `supabase_db_duong`. `local:start` dùng container trong `.env` hoặc MariaDB Laradock đang có, khởi động Mailpit; chỉ tạo cấu hình/schema khi thiếu. Những lần mở lại không ghi đè `.env` hoặc chạy lại seed. Dùng `local:env` khi chủ động áp dụng migrations. Cấu hình máy chủ trong `.env`, cấu hình trình duyệt trong `.env.local`; cả hai được Git bỏ qua. Ảnh/PPTX riêng tư lưu tại `data/storage/`. Không đưa thông tin DB hoặc secret ký file vào biến `VITE_*`.

## Sử dụng

1. Đăng ký email và xác minh trong hộp thư local. Mặc định tài khoản trở thành Teacher hoạt động.
2. Chọn mẫu từ `/library` hoặc tạo bản nháp ở `/dashboard`.
3. Hoàn thành wizard: Bắt đầu → Câu hỏi → Tùy chỉnh → Hoàn tất. Bản nháp được phép thiếu nội dung; bản đã lưu tự lưu tiếp khi chỉnh sửa.
4. Ảnh được tải vào vùng tạm, kiểm tra/chuẩn hóa bằng worker rồi mới sử dụng. Kho mặc định chỉ có ảnh được Admin duyệt nguồn và giấy phép.
5. Chơi thử hoặc tạo job PowerPoint. File riêng tư, tải qua URL ngắn hạn và tải lại trong lịch sử xuất trong bảy ngày.
6. Gửi duyệt nếu muốn chia sẻ công khai. Sửa bài hoặc thu hồi chia sẻ làm liên kết cũ mất hiệu lực.

Kho bài cũ giữ tại `/legacy`. Bước Thông tin có sao lưu IndexedDB và nhập JSON cũ; ảnh nhúng đi qua luồng upload của tài khoản hiện tại. JSON mới chỉ tham chiếu ID ảnh; ảnh tài khoản khác cần được thay thế.

## Ba mẫu

| Mẫu             | Web                                                      | PPTX                                                      |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Hành trình      | Bốn chặng, điểm 10/5, hệ số chặng, lượt cá nhân hoặc tổ, timer       | Nhánh đúng/sai/thử lại/chuyển chặng; điểm và giờ thủ công |
| Mảnh ghép       | Lưới 4/6/9, chọn ô tự do, đúng mới mở, đoán sớm tùy chọn | Mở từ trái sang phải, trên xuống dưới                     |
| Vòng quay ô chữ | Tám ô điểm, lượt cá nhân hoặc tổ, tiếng Việt, nhật ký                | Mở chữ theo kịch bản; quay và ghi điểm thủ công           |

Giới hạn: PNG/JPEG/WebP tĩnh, 5 MB/ảnh, 24 megapixel; mặc định 200 MB/tài khoản, hai upload đồng thời, 20 xuất/ngày UTC, một export đang xử lý; PPTX tối đa 60 slide và 50 MB. Quota tính cả ảnh thumbnail, file xuất và phần giữ cho export đang chạy.

## Kiểm tra

```powershell
npm run check:server
npm test
npm run build
npm run test:local
npm run test:e2e
```

Hai lệnh cuối cần MariaDB, Mailpit, API và worker đang chạy. Test tạo tài khoản tạm và dọn sau khi xong. E2E local dùng Edge; CI dùng Chromium. Unit chỉ thu thập `src/tests/**/*.test.ts` tại dự án gốc. Hai file E2E V3 còn giữ làm tài liệu hồi quy của `/legacy`, không nằm trong suite V4.1 mặc định do hành trình trang chủ đã đổi.

Chi tiết vận hành, nghiệm thu và đầu vào còn thiếu: [docs/MARIADB_LOCAL.md](docs/MARIADB_LOCAL.md).

## Chạy production

Yêu cầu Node.js 22+, MariaDB và file `.env` dành riêng cho server.

```sh
npm ci
npm run build
npm run start:api
```

Chạy worker trong tiến trình riêng (PM2/systemd hoặc terminal khác):

```sh
npm run start:worker
```

`npm start` tương đương `npm run start:api`. Cả hai lệnh start tự đặt
`NODE_ENV=production`, không bật watch và chạy TypeScript qua `tsx` (dependency
production). Không cần biên dịch riêng backend. Sau khi build frontend, có thể
chạy `npm prune --omit=dev`; không prune trước khi build.

Giữ `server/`, `src/domain/`, `src/data/`, `public/art/`, `scripts/`, package.json
và lockfile khi triển khai vì backend dùng trực tiếp các nguồn và ảnh này.
Chạy từ thư mục dự án. Nginx phục vụ `dist/`; API nghe ở `127.0.0.1:8787`
(đổi bằng `API_PORT`), phù hợp reverse proxy trên cùng máy. Hai tiến trình cần
truy cập cùng MariaDB và `STORAGE_ROOT` bền vững, ngoài thư mục release.

Cấu hình `FRONTEND_URL`, `API_PUBLIC_URL`, `VITE_API_URL` theo domain thật;
`VITE_API_URL` được áp dụng lúc build. Điền `DB_*`, `STORAGE_SIGNING_SECRET`,
`INTERNAL_WORKER_SECRET` và SMTP thật. Cookie production yêu cầu HTTPS.
Không dùng thông tin production để chạy các bài test local.

### Cấu hình server và hai tiến trình API/worker

Mẫu cấu hình riêng cho Dương Learning nằm tại `deploy/production.env.example`.
Copy file này thành `.env` ở thư mục gốc trên server, điền thông tin database,
hai secret và `SMTP_PASSWORD` bằng mật khẩu ứng dụng Gmail đã cấp.
Mẫu đã đặt `smtp.gmail.com:465`, TLS, tài khoản gửi
`nguyenngoctrunggtvt@gmail.com` và tên hiển thị `Dương Learning`.
Có thể đặt `SMTP_PASSWORD` trực tiếp trong phần Environment Variables của hosting;
biến môi trường sẽ được ưu tiên hơn giá trị trong `.env`. Sau khi đổi cấu hình,
khởi động lại API. File `.env` thật được Git bỏ qua; chỉ file mẫu được đưa lên Git.

Frontend/API nên dùng chung origin HTTPS, ví dụ `https://example.edu.vn`.
Đây là ví dụ; thay domain, đường dẫn và thông tin database bằng giá trị thật.
Không thêm `/api` hoặc dấu `/` cuối vào ba URL dưới đây.

```dotenv
NODE_ENV=production
FRONTEND_URL=https://example.edu.vn
API_PUBLIC_URL=https://example.edu.vn
VITE_API_URL=https://example.edu.vn
API_PORT=8787
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=edugame
DB_USER=edugame_app
DB_PASSWORD=<mat-khau-database-rieng>
STORAGE_ROOT=/srv/edugame/shared/storage
STORAGE_SIGNING_SECRET=<chuoi-ngau-nhien-rieng>
INTERNAL_WORKER_SECRET=<chuoi-ngau-nhien-khac>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
MAIL_FROM="DuongLearning <no-reply@example.edu.vn>"
```

- `VITE_*` là cấu hình công khai được nhúng vào frontend. Không đặt secret trong
  biến có tiền tố này; bỏ `VITE_LOCAL_MAIL_URL` khi build production.
- `.env.local` cũ có thể ghi đè giá trị Vite từ `.env`: kiểm tra trước khi build.
- API/worker dùng chung `.env`, cùng storage và database. Không copy `.env` vào
  `dist/`, không phục vụ thư mục gốc repository qua Nginx.
- SMTP cổng 465 thường dùng `SMTP_SECURE=true`; cổng 587 thường dùng `false`
  và nâng cấp STARTTLS theo nhà cung cấp. Cấu hình DNS email theo yêu cầu của họ.
- Không chạy `local:start` hoặc `local:env` trên server production: lệnh đó dành cho Docker local,
  tạo cấu hình local và có thể ghi lại `.env`.

Ví dụ quản lý bằng PM2 trên Linux: tạo `ecosystem.config.cjs` tại thư mục dự án.
Không chạy thêm `npm run dev:all` hoặc các lệnh start tay đồng thời với PM2.

```js
module.exports = {
  apps: [
    {
      name: 'edugame-api',
      cwd: __dirname,
      script: 'server/api.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'edugame-worker',
      cwd: __dirname,
      script: 'server/worker.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 120000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

```sh
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs edugame-api --lines 50
pm2 logs edugame-worker --lines 50
pm2 save
pm2 startup
```

Cài PM2 riêng trên server; `pm2 startup` in lệnh cần chạy theo hệ điều hành và
user hiện tại. Chạy API/worker bằng tài khoản dịch vụ có quyền đọc code, ghi
storage; không dùng user root cho ứng dụng. Worker chờ công việc đang xử lý kết
thúc khi nhận SIGINT/SIGTERM; nếu job lâu hơn `kill_timeout` thì PM2 vẫn có thể
buộc dừng, hàng đợi sẽ phục hồi theo lease/retry. Dừng worker trước khi sửa code
hoặc thay dependency; có thể có gián đoạn ngắn khi cập nhật.

### Nginx/aaPanel

Sau khi cấp SSL cho domain, thêm các location dưới đây vào server HTTPS hiện có
(giữ nguyên cấu hình chứng chỉ của aaPanel). Thay root bằng đường dẫn thật.

```nginx
root /srv/edugame/current/dist;
index index.html;
client_max_body_size 6m;

location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

`proxy_pass` không thêm `/` sau cổng để giữ nguyên tiền tố `/api/`.
Chuyển HTTP sang HTTPS, kiểm tra `nginx -t` trước khi reload. Không mở công khai
cổng database hoặc 8787; không trỏ Nginx trực tiếp vào storage private. API cấp
URL ngắn hạn để tải ảnh/file. Giới hạn ảnh trong ứng dụng vẫn là 5 MB dù Nginx
cho phép request tới 6 MB.

### Checklist triển khai và cập nhật

1. Backup database **và** `STORAGE_ROOT`; giữ bản code/release trước để rollback.
2. Chuẩn bị database/user riêng và áp dụng các migration trong
   `database/migrations/` đúng thứ tự. Xem kỹ migration trước khi chạy trên DB
   có dữ liệu; không dùng thao tác xóa/tạo lại database để nâng cấp.
3. Chuyển dữ liệu local khi cần: import DB và copy media cùng bộ; chỉ import DB
   sẽ thiếu ảnh. Đổi mật khẩu tài khoản thử nghiệm trước khi công khai.
4. Trong thư mục release mới: `npm ci`, `npm run check:server`, `npm test`,
   `npm run build`. Build với domain production, không dùng cấu hình localhost.
5. Tạo storage bền vững, cấp quyền cho user dịch vụ và điền `.env` production.
   Khởi động API và worker bằng PM2; Nginx phục vụ bản `dist` vừa build.
6. Kiểm tra `/api/health`, tải lại trực tiếp `/dashboard`, đăng nhập và cookie
   30 ngày, email xác minh/khôi phục, upload ảnh, chơi bài, xuất/tải PowerPoint.
7. Khi cập nhật: chờ worker hết job hoặc dừng có kiểm soát, chuyển release,
   restart API/worker rồi kiểm tra log. Với cấu hình dùng thư mục cố định,
   `pm2 restart ecosystem.config.cjs --update-env` nạp lại hai tiến trình.
8. Rollback về code trước chỉ khi tương thích schema hiện tại; nếu migration
   không tương thích, cần kế hoạch khôi phục DB và media đồng bộ. Không xóa
   storage khi xóa một release cũ.

Không chạy `test:local`/`test:auth`/E2E trỏ vào production. Theo dõi dung lượng
storage, job lỗi, log và dung lượng backup; kiểm tra thử phục hồi định kỳ.
Các hiệu ứng PowerPoint cần kiểm tra trên PowerPoint máy sử dụng thực tế.

Tham khảo vận hành: [PM2 ecosystem](https://pm2.keymetrics.io/docs/usage/application-declaration/),
[PM2 shutdown](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/),
[Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

Lưu ý vận hành dữ liệu: dùng tài khoản migration có quyền thay đổi schema;
tài khoản API/worker chỉ cần quyền SELECT/INSERT/UPDATE/DELETE. Để backup nhất
quán, ngừng thao tác ghi và chờ worker hoàn tất trước khi sao lưu.
`npm run local:backup` dùng cấu hình `.env` hiện tại; chuyển bản backup ra ngoài
thư mục release và lưu ở nơi riêng. `local:restore-check` là kiểm thử bằng
Docker/database tạm, không phải lệnh phục hồi trực tiếp production.

Worker không tự chạy cleanup. Nếu lập lịch `npm run local:cleanup`, lưu ý
tác vụ xóa file xuất quá 7 ngày; thống nhất chính sách lưu trữ và sao lưu trước.

## Âm thanh tiếng Việt trên Web

Bộ MP3 Vbee tại `public/audio/vi/` dùng chung cho các mẫu trò chơi, được copy
vào `dist` khi build. Xem [danh sách lời thoại](public/audio/vi/README.md).
Website phát file trực tiếp, không gọi API Vbee lúc chơi và không cần thiết bị
cài giọng Việt. Nội dung động như tên, điểm, câu hỏi/gợi ý vẫn hiển thị trên
màn hình; lời đọc là câu phản hồi chung. Nếu trình duyệt chặn tự phát, bấm
**Nghe lại lời thoại**. Giữ đường dẫn `/audio/vi/` được phục vụ như file tĩnh.
