import type { InstanceView } from "../types";
import type { SessionControls } from "../useSession";

const SPEEDS = [1, 2, 4];

interface ControlsProps {
  paused: boolean;
  finished: boolean;
  speed: number;
  instances: InstanceView[];
  freeGpus: Record<string, number>;
  controls: SessionControls;
}

export function Controls({ paused, finished, speed, instances, freeGpus, controls }: ControlsProps) {
  const totalFree = Object.values(freeGpus).reduce((a, b) => a + b, 0);

  return (
    <div className="controls">
      <div className="control-group transport">
        <button className="btn" onClick={paused ? controls.play : controls.pause} disabled={finished}>
          {paused ? "▶ Play" : "⏸ Pause"}
        </button>
        <button className="btn" onClick={controls.step} disabled={finished}>
          {"⏭ Step"}
        </button>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={"btn speed" + (s === speed ? " active" : "")}
              onClick={() => controls.setSpeed(s)}
              disabled={finished}
            >
              {s}&times;
            </button>
          ))}
        </div>
      </div>

      <div className="control-group instances">
        <span className="free-gpus">Free GPUs: {totalFree}</span>
        {instances.map((inst) => (
          <div key={inst.instance_id} className="instance-stepper">
            <span className="inst-name">{inst.instance_id}</span>
            <span className="inst-model">{inst.model_name}</span>
            <button
              className="btn step-btn"
              onClick={() => controls.setGpuCount(inst.instance_id, Math.max(0, inst.gpu_count - 1))}
              disabled={finished || inst.gpu_count <= 0}
            >
              &minus;
            </button>
            <span className="inst-count">{inst.gpu_count}</span>
            <button
              className="btn step-btn"
              onClick={() => controls.setGpuCount(inst.instance_id, inst.gpu_count + 1)}
              disabled={finished || totalFree <= 0}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
