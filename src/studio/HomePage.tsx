import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { backend } from "./client";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/></>,
    arrow: <><path d="M4 12h16m-7-7 7 7-7 7"/></>,
    play: <><circle cx="12" cy="12" r="10"/><path d="m10 7 7 5-7 5Z" fill="currentColor" stroke="none"/></>,
    cap: <><path d="m2 8 10-5 10 5-10 5Z" fill="currentColor"/><path d="M6 11v6q6 5 12 0v-6M22 9v8"/></>,
    game: <><path d="M7 6h10c4 0 7 13 3 14-2 1-4-4-5-4H9c-1 0-3 5-5 4C0 19 3 6 7 6Z" fill="currentColor" stroke="none"/><path d="M6 10v5m-2.5-2.5h5" stroke="#0780ff"/><circle cx="16" cy="11" r="1" fill="#0780ff"/><circle cx="19" cy="14" r="1" fill="#0780ff"/></>,
    grid: <>{[3,14].flatMap(x=>[3,14].map(y=><rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" fill="currentColor"/>))}</>,
    image: <><rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="8" cy="9" r="2" fill="currentColor" stroke="none"/><path d="m3 19 6-6 4 4 4-7 5 9" fill="currentColor" stroke="none"/></>,
    ppt: <><path d="m3 4 12-2v20L3 20Z" fill="currentColor"/><path d="M15 5h6v14h-6M7 16V8h3a2 2 0 0 1 0 4H7"/><path d="M7 16V8h3a2 2 0 0 1 0 4H7" stroke="#f65166"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Flower() {
  return <svg className="home-flower" viewBox="0 0 42 42" aria-hidden="true">{["#ffae35","#ff7149","#f35b88","#8bc956","#54b776"].map((color,i)=><ellipse key={color} cx="21" cy="12" rx="8" ry="11" fill={color} stroke="#ffffff66" transform={`rotate(${i*72} 21 21)`}/>)}<circle cx="21" cy="21" r="7" fill="#fff8d8"/><circle cx="19" cy="20" r="1" fill="#274771"/><circle cx="24" cy="20" r="1" fill="#274771"/><path d="M19 24q3 3 6-1" fill="none" stroke="#274771" strokeLinecap="round"/></svg>;
}
export function Header() {
  const { session, profile } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") || "").trim();
    navigate(`/library?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  }
  return <header className="eg-header home-header">
    <Link className="eg-brand home-brand" to="/" aria-label="EduGame Studio – Trang chủ"><Flower/><span>EduGame Studio</span></Link>
    <nav aria-label="Điều hướng chính">
      <NavLink to="/" end>Trang chủ</NavLink><a href="/#gioi-thieu">Giới thiệu</a><NavLink to="/library">Mẫu trò chơi</NavLink><NavLink to="/media">Thư viện</NavLink><NavLink to="/help">Hướng dẫn</NavLink>
    </nav>
    <div className="home-account">
      <button className="home-search" aria-label="Tìm kiếm mẫu trò chơi" aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><Icon name="search"/></button>
      <span className="home-divider"/>
      {session ? <><Link className="home-login" to="/dashboard">{profile?.display_name || "Khu giáo viên"}</Link><button className="eg-button" onClick={()=>void backend.auth.signOut()}>Đăng xuất</button></> : <><Link className="home-login" to="/login">Đăng nhập</Link><Link className="eg-button" to="/login?mode=signup">Đăng ký</Link></>}
    </div>
    {searchOpen && <form className="home-search-form" role="search" onSubmit={search}><label htmlFor="home-search-input">Tìm mẫu trò chơi</label><div><input id="home-search-input" name="q" autoFocus placeholder="Tên mẫu trò chơi…" onKeyDown={e=>{if(e.key==="Escape")setSearchOpen(false);}}/><button className="eg-button" type="submit">Tìm kiếm</button></div></form>}
  </header>;
}
const benefits = [
  ["grid", "Nhiều mẫu trò chơi", "Phù hợp nhiều môn học", "orange"],
  ["image", "Dễ sử dụng", "Chỉ cần vài bước", "blue"],
  ["play", "Chơi trên website", "Tương tác trực tuyến", "green"],
  ["ppt", "Tải PowerPoint", "Sử dụng trong lớp học", "pink"],
];
export function Home() {
  return <main className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-copy">
        <p className="home-badge"><Icon name="cap"/>Nền tảng thiết kế trò chơi dạy học</p>
        <h1 id="home-title">Tạo trò chơi dạy học<span><strong>Dễ dàng</strong><i> – </i><strong>Sinh động</strong><i> – </i><strong>Hiệu quả</strong></span></h1>
        <p className="home-subtitle">Dành cho giáo viên Tiểu học – Hỗ trợ nhiều môn học<br/>{" "}Chơi trực tuyến và xuất PowerPoint tương tác</p>
        <div className="home-cta"><Link className="eg-button" to="/library"><Icon name="game"/>Bắt đầu tạo trò chơi<Icon name="arrow"/></Link><Link className="eg-button eg-light" to="/help"><Icon name="play"/>Xem hướng dẫn<Icon name="arrow"/></Link></div>
      </div>
      <img className="home-mobile-child home-mobile-boy" src="/art/explorer.png" alt=""/><img className="home-mobile-child home-mobile-girl" src="/art/explorer-girl.png" alt=""/><div className="home-signpost" aria-label="Hỗ trợ nhiều môn học">{["Toán", "Tiếng Việt", "Tiếng Anh", "Tự nhiên và Xã hội", "Đạo đức", "và nhiều môn khác…"].map(text=><span key={text}>{text}</span>)}</div>
    </section>
    <section id="gioi-thieu" className="home-benefits" aria-label="Lợi ích của EduGame Studio">{benefits.map(([icon,title,description,color])=><article key={title}><span className={`home-benefit-icon ${color}`}><Icon name={icon}/></span><div><h2>{title}</h2><p>{description}</p></div></article>)}</section>
  </main>;
}
