# Pipeline de edición automática (Remotion)

Genera automáticamente, a partir de tus clips en bruto, un video vertical
9:16 con: subtítulos palabra por palabra estilo karaoke (en español), cortes
automáticos de silencios y muletillas, zoom de gancho + punch zoom en
momentos de énfasis, volumen elevado, SFX (whoosh/ding/impacto) y palabras
clave resaltadas.

Este proyecto corre **en tu máquina** (necesita tu carpeta de videos y un
navegador/GPU para renderizar) — no en la nube.

## 1. Requisitos (una sola vez)

```console
npm i
```

Además de Node, necesitas **ffmpeg completo** instalado y en el PATH (se
usa para detectar silencios y momentos de énfasis; el ffmpeg que trae
Remotion internamente no alcanza para esto):

- macOS: `brew install ffmpeg`
- Windows: `winget install ffmpeg` (o `choco install ffmpeg`)
- Linux: `sudo apt install ffmpeg`

## 2. Importar tus clips

```console
npm run import-clips -- "C:\Users\dylan\Desktop\videos pra editar"
```

Copia todos los `.mp4/.mov/.mkv/.webm` de esa carpeta a `public/videos/`.

## 3. Analizar (transcribir + detectar cortes)

```console
npm run analyze
```

La primera vez descarga Whisper.cpp y el modelo `medium` (~1.5GB) para
transcribir en español con timestamps por palabra. Por cada video en
`public/videos/` genera `public/analysis/<nombre>.json` con:

- `captions`: transcripción palabra por palabra, ya remapeada al timeline
  editado (después de los cortes).
- `segments`: la lista de recortes que arma el jump-cut.
- `emphasisMs`: momentos donde subís el tono de voz (para el punch zoom).
- `removeRanges`: qué se cortó y por qué (`silence` o `filler`).

Para analizar un solo clip primero (recomendado antes de correr todo):

```console
node scripts/analyze.mjs public/videos/clip1.mp4
```

## 4. Previsualizar el resultado

```console
npm run dev
```

En el panel de la izquierda, en la composición **EditedVideo**, cambiá los
`src` / `analysisSrc` de las input props al clip que acabás de analizar
(por ejemplo `videos/clip1.mp4` y `analysis/clip1.json`). Vas a ver los
cortes, el zoom, los subtítulos karaoke y los SFX aplicados en vivo.

**Antes de aplicarlo a todos los clips**, revisá si los cortes te
convencen: abrí `public/analysis/clip1.json` y mirá `removeRanges`. Si algo
se cortó de más (por ejemplo "este" usado como "this" y no como muletilla),
borrá esa entrada de `removeRanges` y de vuelta a Studio (o ajustá la lista
de muletillas en `scripts/filler-words.mjs`) y volvé a correr el análisis
borrando antes el `.json` viejo.

## 5. Renderizar (exportar vertical 9:16, listo para TikTok/IG/YouTube Shorts)

```console
npx remotion render EditedVideo out/clip1.mp4 --props='{"src":"videos/clip1.mp4","analysisSrc":"analysis/clip1.json"}'
```

Repetí por cada clip (o escribí un loop en tu shell) una vez que estés
conforme con el preview del primero.

## Cómo está armado

- `scripts/analyze.mjs` — orquesta todo: extrae audio, transcribe con
  Whisper (es), detecta silencios (`ffmpeg silencedetect`), detecta
  muletillas (`scripts/filler-words.mjs`), detecta momentos de énfasis por
  volumen (`scripts/detect-emphasis.mjs`), arma la lista de cortes
  (`scripts/build-cuts.mjs`) y elige palabras clave + la palabra de gancho
  (`scripts/pick-keywords.mjs`).
- `src/EditedVideo/` — la composición de Remotion: arma el jump-cut
  encadenando `<Sequence>` recortados por segmento, aplica el zoom de
  gancho (primeros 3s) + punch zoom (`zoom.ts`), renderiza los subtítulos
  karaoke con palabra clave en naranja (marca) y la palabra de gancho en
  rojo (`Page.tsx`), y dispara los SFX (`Sfx.tsx`).
- `public/sfx/*.wav` — SFX placeholder generados con
  `npm run generate-sfx` (sintetizados en JS puro, sin ffmpeg). Reemplazalos
  por los tuyos manteniendo el mismo nombre de archivo.
- El volumen se sube a **180%** vía el prop `volume` del video
  (`VOLUME_BOOST` en `src/EditedVideo/index.tsx`, ajustable entre 1.5–2.0).

## Configurar Whisper.cpp

`whisper-config.mjs` controla el modelo e idioma (ya seteado en español,
modelo `medium`). Para más precisión (más lento) probá `large-v3`; para
algo más rápido en máquinas modestas, `small`.

## Docs

- [Fundamentos de Remotion](https://www.remotion.dev/docs/the-fundamentals)
- [Discord de Remotion](https://remotion.dev/discord)
