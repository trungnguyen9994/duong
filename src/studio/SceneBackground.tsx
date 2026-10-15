import type { StudioSpec } from "../domain/studio-spec";
export function SceneBackground({
  spec,
  url,
}: {
  spec: StudioSpec;
  url?: string;
}) {
  if (!url) return null;
  return (
    <div className="eg-scene-background" aria-hidden="true">
      <img
        src={url}
        alt=""
        style={{
          objectFit: spec.media.fit,
          objectPosition: `${spec.media.x}% ${spec.media.y}%`,
          transform: `scale(${spec.media.zoom})`,
          transformOrigin: `${spec.media.x}% ${spec.media.y}%`,
          opacity: spec.media.opacity,
        }}
      />
    </div>
  );
}
