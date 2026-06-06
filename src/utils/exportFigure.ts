/** Download a canvas element as PNG. */
export function exportCanvasPng(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/** Download a three.js renderer canvas (requires preserveDrawingBuffer: true). */
export function exportRendererPng(
  renderer: { domElement: HTMLCanvasElement } | null,
  filename: string,
) {
  if (!renderer) return;
  exportCanvasPng(renderer.domElement, filename);
}
