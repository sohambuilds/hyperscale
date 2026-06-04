import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

// Options minus the size fields — the Chart owns sizing via ResizeObserver.
export type ChartOptions = Omit<uPlot.Options, "width" | "height">;

interface ChartProps {
  options: ChartOptions;
  data: uPlot.AlignedData;
}

function sizeOf(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
}

/**
 * Thin React wrapper around uPlot: create the plot once, push new data via
 * setData on each change, and track the container size with a ResizeObserver.
 * Options are read once at mount (callers pass stable, module-level options).
 */
export function Chart({ options, data }: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const optionsRef = useRef<ChartOptions>(options);
  const dataRef = useRef<uPlot.AlignedData>(data);
  optionsRef.current = options;
  dataRef.current = data;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = sizeOf(el);
    const u = new uPlot(
      { ...optionsRef.current, width, height } as uPlot.Options,
      dataRef.current,
      el,
    );
    plotRef.current = u;

    const ro = new ResizeObserver(() => u.setSize(sizeOf(el)));
    ro.observe(el);

    return () => {
      ro.disconnect();
      u.destroy();
      plotRef.current = null;
    };
  }, []);

  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  return <div ref={containerRef} className="chart" />;
}
