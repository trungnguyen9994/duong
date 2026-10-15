import type { StudioSpec } from "../domain/studio-spec";

export function PlayerRoster({ spec, active, scores, disabled, onSelect }: {
  spec: StudioSpec; active: number; scores: number[]; disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const individual = spec.settings.playMode === "individual";
  return <aside className="eg-scoreboard eg-roster" aria-label={individual ? "Điểm cá nhân" : "Điểm tổ / đội"}>
    <label>
      {individual ? "Gọi học sinh trả lời" : "Chọn tổ / đội trả lời"}
      <select aria-label={individual ? "Học sinh trả lời" : "Tổ / đội trả lời"} value={active} disabled={disabled} onChange={e=>onSelect(Number(e.target.value))}>
        {spec.settings.teams.map((name,i)=><option key={i} value={i}>{name || `${individual ? "Học sinh" : "Tổ"} ${i+1}`}</option>)}
      </select>
    </label>
    <p className="eg-current-player" role="status">Lượt: <strong>{spec.settings.teams[active]}</strong></p>
    <div className="eg-roster-scores">{spec.settings.teams.map((name,i)=><div key={i} aria-current={active===i ? "true" : undefined}><span>{name}</span><strong>{scores[i]}</strong></div>)}</div>
  </aside>;
}
