import { useEffect, useRef, useState } from 'react';
import { Box, ThemeIcon, Tooltip } from '@mantine/core';

export type Pin = { id: string; x: number; y: number; label?: string };

type Layout = { left: number; top: number; width: number; height: number };

export default function ImagePinBoard({
  src,
  pins,
  onPick,            // (x,y) normalizados 0..1 no espaço DA IMAGEM
  onPinClick,
  height,            // se omitido, ocupa 100% da altura do pai
  measuredSet,       // <<< NOVO: conjunto de cotas já medidas (por id)
}: {
  src?: string | null;
  pins: Pin[];
  onPick?: (x: number, y: number) => void;
  onPinClick?: (pin: Pin) => void;
  height?: number | string;
  measuredSet?: Set<string>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [layout, setLayout] = useState<Layout>({ left: 0, top: 0, width: 0, height: 0 });

  function computeLayout() {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || !natural) return;

    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    const iw = natural.w;
    const ih = natural.h;

    if (!cw || !ch || !iw || !ih) {
      setLayout({ left: 0, top: 0, width: 0, height: 0 });
      return;
    }

    const containerAR = cw / ch;
    const imageAR = iw / ih;

    let renderW: number;
    let renderH: number;
    if (imageAR > containerAR) {
      renderW = cw;
      renderH = cw / imageAR;
    } else {
      renderH = ch;
      renderW = ch * imageAR;
    }

    const left = (cw - renderW) / 2;
    const top = (ch - renderH) / 2;
    setLayout({ left, top, width: renderW, height: renderH });
  }

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    setNatural({ w, h });
  }

  useEffect(() => { computeLayout(); }, [natural, src]);
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver(() => computeLayout());
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  function clickStage(e: React.MouseEvent) {
    if (!onPick) return;
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // para dentro do bbox da imagem (sem letterbox)
    const ix = (px - layout.left) / layout.width;
    const iy = (py - layout.top) / layout.height;

    if (ix >= 0 && ix <= 1 && iy >= 0 && iy <= 1) {
      onPick(Math.min(1, Math.max(0, ix)), Math.min(1, Math.max(0, iy)));
    }
  }

  return (
    <Box
      pos="relative"
      style={{
        height: height ?? '100%',
        background: '#0b0f14',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div ref={stageRef} style={{ position: 'absolute', inset: 0 }} onClick={clickStage}>
        <img
          ref={imgRef}
          src={src ?? 'https://placehold.co/800x600?text=Sem+Imagem'}
          alt=""
          onLoad={onImgLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {pins.map((p) => {
          const left = layout.left + p.x * layout.width;
          const top = layout.top + p.y * layout.height;

          const labelFull = (p.label ?? '').trim();
          const letter = labelFull ? labelFull[0]!.toUpperCase() : '•';
          const size = 26;

          const isMeasured = measuredSet?.has(p.id);

          // estilos diferentes quando já medido
          const baseShadow =
            '0 6px 14px rgba(34,139,230,.25), inset 0 0 0 2px rgba(255,255,255,.25)';
          const hoverShadow =
            '0 8px 16px rgba(34,139,230,.34), inset 0 0 0 2px rgba(255,255,255,.32)';

          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onPinClick?.(p);
              }}
            >
              <Tooltip label={labelFull || p.id} withArrow>
                <ThemeIcon
                  size={size}
                  radius="xl"
                  variant={isMeasured ? 'filled' : 'gradient'}
                  color={isMeasured ? 'gray' : undefined}
                  gradient={!isMeasured ? { from: 'blue.4', to: 'blue.7', deg: 180 } : undefined}
                  style={{
                    boxShadow: isMeasured ? 'none' : baseShadow,
                    border: isMeasured ? '1px solid rgba(0,0,0,.25)' : '2px solid rgba(0,0,0,.35)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'transform .12s ease, box-shadow .12s ease, opacity .12s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: Math.round(size * 0.5),
                    lineHeight: 1,
                    opacity: isMeasured ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (isMeasured) return;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = hoverShadow;
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (isMeasured) return;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = baseShadow;
                    (e.currentTarget as HTMLDivElement).style.transform = 'none';
                  }}
                >
                  {letter}
                </ThemeIcon>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
