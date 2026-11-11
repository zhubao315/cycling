import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useId,
  type ReactNode,
} from 'react';
import type { Activity } from '@/utils/utils';
import { sceneHashOf } from '@/vert/scenes';

// Only this import pulls in Vert, and with it three.js: a chunk of its own, loaded on demand.
const VertTerrain = lazy(() => import('@/vert/VertTerrain'));
// The 2D profile reads the same baked scene, so it survives a browser that
// cannot give the 3D view a WebGL context.
const ElevationPanel = lazy(() => import('@/vert/ElevationPanel'));

/** Shows `fallback` instead of a child that threw (no WebGL, a lost context, a bug). */
class TerrainBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
}> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const Fallback = ({ message }: { message?: string }) => (
  <div className="flex aspect-video w-full items-center justify-center rounded border border-[#333] bg-[#0f0f0f] text-sm text-[#8a8a8a]">
    {message}
  </div>
);

interface TerrainCardProps {
  run: Activity;
  /** Closes the 3D view and puts the map back to the whole scope. */
  onClose: () => void;
}

/**
 * The 3D terrain card for the selected run, only when a scene was baked for it. The card keeps
 * the same 16:9 box in every state (loading, loaded, failed) so the page does not jump.
 *
 * The elevation profile below the terrain is drawn from the same baked scene
 * and needs no WebGL: on a device that cannot render the terrain it stays,
 * because the climb profile is the record for a ride as much as the terrain is.
 */
const TerrainCard = ({ run, onClose }: TerrainCardProps) => {
  const id = useId();
  const hash = sceneHashOf(run.run_id);

  // Escape closes the panel, like every other overlay on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (hash === undefined) return null;

  return (
    <section
      className="mt-6 rounded-lg border border-[#333] bg-[#141414] p-4"
      aria-labelledby={id}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-xl font-bold text-[#e0ed5e]">
          3D 地形 · {run.name || 'Untitled'}
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#8a8a8a]">
            {new Date(run.start_date_local).toLocaleDateString('zh-CN')} ·{' '}
            {(run.distance / 1000).toFixed(2)} km
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭 3D 视图"
            className="rounded-full p-1.5 text-[#8a8a8a] transition-colors hover:bg-[#262626] hover:text-white"
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
      </div>
      <TerrainBoundary
        fallback={<Fallback message="该浏览器无法显示 3D 地形。" />}
      >
        <Suspense fallback={<Fallback message="地形加载中…" />}>
          <VertTerrain
            key={String(run.run_id)}
            sceneId={String(run.run_id)}
            hash={hash}
            title={run.name || 'Untitled'}
          />
        </Suspense>
      </TerrainBoundary>
      <Suspense fallback={null}>
        <div className="mt-3">
          <ElevationPanel sceneId={String(run.run_id)} hash={hash} />
        </div>
      </Suspense>
      <p className="mt-2 text-right text-xs text-[#777]">
        在浏览器本地渲染，赛道坐标不会上传
      </p>
    </section>
  );
};

export default TerrainCard;
