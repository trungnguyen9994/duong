import { Link } from "react-router-dom";
import { templateRegistry, type TemplateType } from "../domain/studio-spec";
import "./about-page.css";

const templates = [
  {
    type: "forest_rescue",
    tag: "Trả lời câu hỏi, giải cứu con vật",
    description: "Khám phá rừng xanh, chọn con vật và vượt qua câu hỏi để mở lồng giải cứu. Giáo viên điều hành và cùng cả lớp kiểm tra đáp án.",
    example: "Gợi ý sử dụng: tìm hiểu động vật, giáo dục bảo vệ thiên nhiên, ôn tập kiến thức.",
  },
  {
    type: "boat_rescue",
    tag: "Đưa thuyền vào bờ tránh bão",
    description: "Chọn thuyền và trả lời câu hỏi với ba phương án. Mỗi câu trả lời đúng giúp một chiếc thuyền trở về bờ an toàn.",
    example: "Gợi ý sử dụng: luyện tính nhẩm, củng cố kiến thức, thi đua giữa các tổ.",
  },
  {
    type: "football",
    tag: "Chọn đáp án, ghi bàn thắng",
    description: "Thử sức với những cú sút qua câu hỏi có bốn phương án. Chọn đáp án đúng để ghi bàn và theo dõi kết quả của từng lượt chơi.",
    example: "Gợi ý sử dụng: luyện từ vựng Tiếng Anh, kiểm tra nhanh, ôn tập cuối bài.",
  },
  {
    type: "clever_frog",
    image: "frog/image1",
    name: "Ếch xanh mưu trí",
    tag: "Chọn ếch, khám phá câu hỏi",
    description:
      "Chọn chú ếch bất kỳ trên ao, trả lời miệng rồi cùng hiện đáp án. Giáo viên chấm điểm và gọi học sinh tiếp theo.",
    example:
      "Gợi ý sử dụng: hỏi đáp đầu giờ, luyện tính nhẩm, ôn tập cuối bài.",
  },
  {
    type: "journey",
    image: "forest",
    name: "Hành trình tri thức",
    tag: "Khám phá qua từng chặng",
    description:
      "Dẫn cả lớp qua bốn chặng thử thách. Mỗi câu hỏi là một bước tiến, có thời gian suy nghĩ, gợi ý và điểm thưởng.",
    example: "Gợi ý sử dụng: ôn tập phép tính, củng cố kiến thức cuối bài.",
  },
  {
    type: "picture_reveal",
    image: "mountain",
    name: "Mảnh ghép bí mật",
    tag: "Mở ô, tìm điều bất ngờ",
    description:
      "Trả lời câu hỏi để mở từng phần của bức tranh. Giáo viên chọn lưới 4, 6 hoặc 9 ô và có thể cho học sinh đoán tranh sớm.",
    example:
      "Gợi ý sử dụng: khám phá thiên nhiên, nhận biết sự vật, mở đầu chủ đề.",
  },
  {
    type: "word_wheel",
    image: "castle",
    name: "Vòng quay ô chữ",
    tag: "Đoán chữ, khám phá từ khóa",
    description:
      "Quay vòng điểm, chọn chữ cái và giải cụm từ tiếng Việt. Lượt chơi cùng bảng điểm giúp giáo viên tổ chức phần thi rõ ràng.",
    example:
      "Gợi ý sử dụng: luyện từ, ôn chủ đề Tiếng Việt, tìm từ khóa bài học.",
  },
] satisfies { type: TemplateType; tag: string; description: string; example: string; image?: string; name?: string }[];
const benefits = [
  [
    "01",
    "Nội dung do thầy cô quyết định",
    "Tự nhập câu hỏi, đáp án, gợi ý và lời giải thích; thêm câu từ ngân hàng để tái sử dụng trong nhiều bài.",
  ],
  [
    "02",
    "Linh hoạt với từng lớp học",
    "Chọn chơi theo cá nhân hoặc tổ, gọi người trả lời và điều chỉnh thời gian, điểm số cho hoạt động của lớp.",
  ],
  [
    "03",
    "Hình ảnh gần gũi với học sinh",
    "Dùng ảnh từ thư viện hoặc tải ảnh của bạn lên để chọn bối cảnh, nhân vật và hình minh họa phù hợp bài học.",
  ],
  [
    "04",
    "Soạn một lần, sử dụng nhiều cách",
    "Chơi trực tiếp trên website, lưu bản nháp để chỉnh sửa và xuất PowerPoint theo khả năng của từng mẫu.",
  ],
];
const steps = [
  ["Bắt đầu", "Chọn mẫu, đặt tên bài, môn và khối lớp."],
  ["Câu hỏi", "Soạn từng câu và đánh dấu đáp án đúng."],
  ["Tùy chỉnh", "Chọn cách chơi; bổ sung hình ảnh, thời gian khi cần."],
  ["Hoàn tất", "Chơi thử, kiểm tra và xuất PowerPoint."],
];

export function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <p className="about-eyebrow">VỀ EDUGAME STUDIO</p>
          <h1 id="about-title">
            Biến bài học thành
            <br />
            <span>một cuộc khám phá.</span>
          </h1>
          <p className="about-lead">
            Một không gian để giáo viên Tiểu học tự thiết kế trò chơi dạy học,
            mang câu hỏi và ý tưởng của mình vào những hoạt động sinh động trên
            lớp.
          </p>
          <p className="about-hero-detail">
            Thầy cô tập trung vào nội dung và cách tổ chức tiết học. EduGame
            Studio hỗ trợ phần thiết kế, lượt chơi, đồng hồ và hình ảnh.
          </p>
          <div className="about-actions">
            <Link className="eg-button" to="/library">
              Khám phá mẫu trò chơi <span aria-hidden="true">→</span>
            </Link>
            <Link className="about-guide-link" to="/help">
              Xem cách bắt đầu <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="about-illustration">
          <img className="about-landscape" src="/art/mountain.png" alt="" />
          <span className="about-art-label">
            Mỗi bài học, một hành trình mới
          </span>
          <img
            className="about-explorer"
            src="/art/explorer.png"
            alt="Bạn nhỏ khám phá đồng hành cùng bài học"
          />
          <div className="about-art-note">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>
                Thầy cô sáng tạo.
                <br />
                Học sinh cùng khám phá.
              </strong>
              <p>Chơi Web · Xuất PowerPoint</p>
            </div>
          </div>
        </div>
      </section>

      <div className="about-highlights" aria-label="Đặc điểm nền tảng">
        <p>
          <strong>Đa môn học</strong>
          <span>Nội dung linh hoạt theo tiết dạy</span>
        </p>
        <p>
          <strong>{templates.length} mẫu trò chơi</strong>
          <span>Nhiều cách tổ chức hoạt động</span>
        </p>
        <p>
          <strong>Cá nhân hoặc tổ</strong>
          <span>Phù hợp cách điều hành của giáo viên</span>
        </p>
        <p>
          <strong>Web & PowerPoint</strong>
          <span>Lựa chọn hình thức sử dụng</span>
        </p>
      </div>

      <section className="about-section" aria-labelledby="about-purpose">
        <div className="about-section-heading">
          <p className="about-eyebrow">THÊM Ý TƯỞNG CHO MỖI TIẾT HỌC</p>
          <h2 id="about-purpose">Công cụ hỗ trợ, thầy cô làm chủ</h2>
          <p>
            Khởi động đầu giờ, luyện tập giữa tiết hay ôn tập cuối bài — bắt đầu
            từ mục tiêu học tập, rồi chọn cách chơi phù hợp với học sinh.
          </p>
        </div>
        <div className="about-benefit-grid">
          {benefits.map(([number, title, description]) => (
            <article key={number}>
              <span className="about-number">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="about-template-section"
        aria-labelledby="about-templates"
      >
        <div className="about-section-heading">
          <p className="about-eyebrow">HỌC QUA NHỮNG TRẢI NGHIỆM</p>
          <h2 id="about-templates">{templates.length} mẫu trò chơi, nhiều ý tưởng dạy học</h2>
          <p>
            Dùng cho Toán, Tiếng Việt, Tự nhiên và Xã hội hoặc môn học khác. Câu
            hỏi và hình ảnh do giáo viên lựa chọn.
          </p>
        </div>
        <div className="about-template-grid">
          {templates.map((template) => (
            <article key={template.type}>
              <img src={templateRegistry[template.type].image} alt="" loading="lazy" />
              <div className="about-template-copy">
                <span>{template.tag}</span>
                <h3>{templateRegistry[template.type].name}</h3>
                <p>{template.description}</p>
                <p className="about-example">{template.example}</p>
                <Link
                  to={`/demo/${template.type}`}
                  aria-label={`Chơi thử ${templateRegistry[template.type].name}`}
                >
                  Chơi thử mẫu <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-how">
        <div className="about-section-heading">
          <p className="about-eyebrow">TỪ Ý TƯỞNG ĐẾN GIỜ HỌC</p>
          <h2 id="about-how">Tạo trò chơi qua bốn bước</h2>
          <p>
            Không cần biết lập trình. Có thể lưu nháp và quay lại chỉnh sửa
            trước khi mang bài vào lớp.
          </p>
        </div>
        <ol className="about-steps">
          {steps.map(([title, description], index) => (
            <li key={title}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="about-teacher-note">
          <strong>Học liệu phù hợp bắt đầu từ giáo viên.</strong>
          <p>
            Thầy cô kiểm tra kiến thức, đáp án, độ khó và quyền sử dụng hình ảnh
            trước khi dạy. Nội dung mẫu dùng để trải nghiệm, cần được giáo viên
            duyệt trước khi sử dụng chính thức.
          </p>
        </div>
      </section>

      <section className="about-faq-section" aria-labelledby="about-faq">
        <div>
          <p className="about-eyebrow">GIẢI ĐÁP NHANH</p>
          <h2 id="about-faq">Thầy cô có thể muốn biết</h2>
          <p>Một vài thông tin trước khi tạo trò chơi đầu tiên.</p>
        </div>
        <div className="about-faq-list">
          <details>
            <summary>Có thể gọi từng học sinh trả lời không?</summary>
            <p>
              Có. Chọn chế độ cá nhân trong bước Luật chơi, nhập danh sách và
              chọn tên học sinh khi điều hành. Điểm được tính riêng cho từng em.
              Thầy cô cũng có thể chọn chơi theo tổ.
            </p>
          </details>
          <details>
            <summary>PowerPoint có chơi giống bản Web không?</summary>
            <p>
              Mỗi mẫu có cách xuất riêng: Hành trình có liên kết đúng/sai/thử
              lại; Mảnh ghép mở theo thứ tự cố định; Vòng quay ô chữ xuất theo
              kịch bản hướng dẫn. Giáo viên quản lý thời gian và ghi điểm thủ
              công trên PowerPoint, đồng thời nên mở thử file trên máy dùng để
              dạy.
            </p>
          </details>
          <details>
            <summary>Tôi có thể sử dụng ảnh của mình không?</summary>
            <p>
              Có. Tải ảnh PNG, JPEG hoặc WebP tĩnh lên thư viện cá nhân, sau đó
              chọn và điều chỉnh trong bài. Mỗi ảnh tối đa 5 MB. Hãy dùng ảnh do
              bạn sở hữu hoặc đã được cho phép sử dụng.
            </p>
          </details>
          <details>
            <summary>Trò chơi của tôi có tự động công khai không?</summary>
            <p>
              Không. Bản nháp và ảnh cá nhân mặc định riêng tư. Khi muốn chia sẻ
              bài công khai, giáo viên gửi duyệt; nội dung chỉ được công bố sau
              khi quản trị viên chấp thuận.
            </p>
          </details>
        </div>
      </section>

      <section className="about-author" id="author" aria-labelledby="about-author-title">
        <img src="/art/author-thuy-duong.png" alt="Đỗ Thị Thùy Dương" loading="lazy" />
        <div>
          <p className="about-eyebrow">TÁC GIẢ</p>
          <h2 id="about-author-title">Đỗ Thị Thùy Dương</h2>
          <dl>
            <div><dt>Ngày sinh</dt><dd><time dateTime="1994-09-29">29/09/1994</time></dd></div>
            <div><dt>Đơn vị công tác</dt><dd>Trường Tiểu Học Thạch Bàn (Phân Hiệu)</dd></div>
          </dl>
        </div>
      </section>

      <section className="about-final-cta">
        <div>
          <p className="about-eyebrow">BẮT ĐẦU TỪ MỘT Ý TƯỞNG NHỎ</p>
          <h2>Cùng tạo một tiết học đáng nhớ.</h2>
          <p>
            Chọn một mẫu, thêm nội dung của thầy cô và thử cách học mới cùng cả
            lớp.
          </p>
        </div>
        <Link className="eg-button" to="/library">
          Bắt đầu tạo trò chơi <span aria-hidden="true">→</span>
        </Link>
      </section>
      <footer className="about-footer">
        <Link to="/">EduGame Studio</Link>
        <p>Thầy cô sáng tạo · Học sinh khám phá</p>
        <Link to="/help">Hướng dẫn sử dụng</Link>
      </footer>
    </main>
  );
}
