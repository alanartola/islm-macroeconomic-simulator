/**
 * Client-side exporters (no server, no external service): CSV, JSON, SVG and
 * PNG downloads. Charts reference CSS custom properties, so the SVG is cloned
 * and every var(--x) is replaced by its computed value before serialising.
 */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
  downloadBlob(filename, new Blob([text], { type }));
}

/** RFC 4180 CSV with a UTF-8 BOM so spreadsheet software detects the encoding (accents). */
export function toCSV(rows: (string | number | null)[][], separator = ','): string {
  const cell = (v: string | number | null) => {
    if (v === null) return '';
    const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : v;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(separator)).join('\r\n');
}

const VAR_RE = /var\((--[\w-]+)\)/g;

/** Returns a standalone SVG string with CSS variables resolved and a solid background. */
export function serializeSvg(svg: SVGSVGElement): string {
  const styles = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(VAR_RE, (_, name: string) => styles.getPropertyValue(name).trim() || '#000');
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const all = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes('var(')) el.setAttribute(attr.name, resolve(attr.value));
    }
  }
  const font = getComputedStyle(document.body).fontFamily;
  clone.setAttribute('style', `font-family:${font};`);
  const vb = clone.viewBox.baseVal;
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(vb?.x ?? 0));
  bg.setAttribute('y', String(vb?.y ?? 0));
  bg.setAttribute('width', String(vb?.width ?? svg.clientWidth));
  bg.setAttribute('height', String(vb?.height ?? svg.clientHeight));
  bg.setAttribute('fill', styles.getPropertyValue('--page').trim() || '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, filename: string): void {
  downloadText(filename, serializeSvg(svg), 'image/svg+xml;charset=utf-8');
}

/** Rasterises the SVG at 2× for crisp PNG output. */
export function exportPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const text = serializeSvg(svg);
  const vb = svg.viewBox.baseVal;
  const w = vb?.width || svg.clientWidth;
  const h = vb?.height || svg.clientHeight;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(filename, blob);
          resolve();
        } else reject(new Error('PNG encoding failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG could not be rasterised'));
    };
    img.src = url;
  });
}

/** File-name friendly slug. */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
