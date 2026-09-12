import { useEffect, useRef, useState } from "react";
import { loadAudio } from "./audio.ts";
import type { WaveBin } from "./audio.ts";
import type { Recording, Side } from "./domain/types.ts";

type Status =
  | "loading"
  | "ready"
  | "starting"
  | "playing"
  | "paused"
  | "ended"
  | "error";

function Waveform({
  bins,
  recording,
  time,
}: {
  bins: WaveBin[];
  recording: Recording;
  time: number;
}) {
  const peak = Math.max(
    ...bins.map((bin) => Math.max(Math.abs(bin.min), bin.max)),
    0.001,
  );
  const path = bins
    .map((bin, i) => {
      const x = 12 + (i / Math.max(1, bins.length - 1)) * 576;
      return `M${x.toFixed(2)},${(62 - (bin.max / peak) * 40).toFixed(2)}V${(62 - (bin.min / peak) * 40).toFixed(2)}`;
    })
    .join(" ");
  const x = (seconds: number) =>
    12 + (seconds / recording.audio.durationSeconds) * 576;
  return (
    <svg
      className="waveform"
      viewBox="0 0 600 136"
      role="img"
      aria-label={`Waveform of ${recording.label}, derived from decoded audio. Dashed lines mark estimated clicks.`}
    >
      <line className="baseline" x1="12" y1="62" x2="588" y2="62" />
      <path className="wave-path" d={path} />
      {recording.annotation.clickTimesSeconds.map((t, i) => (
        <g key={t}>
          <line className="click-guide" x1={x(t)} x2={x(t)} y1="10" y2="112" />
          <text className="click-number" x={x(t)} y="132" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      <line className="playhead" x1={x(time)} x2={x(time)} y1="4" y2="114" />
    </svg>
  );
}

export default function AudioCard({
  side,
  recording,
  recordings,
  onSelect,
  onPlay,
  registerAudio,
  onMake,
}: {
  side: Side;
  recording: Recording;
  recordings: Recording[];
  onSelect: (id: string) => void;
  onPlay: (element: HTMLAudioElement) => void;
  registerAudio: (side: Side, element: HTMLAudioElement | null) => void;
  onMake: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mounted = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [bins, setBins] = useState<WaveBin[]>([]);
  const [time, setTime] = useState(0);
  const [volume, setVolume] = useState(0.25);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const element = audioRef.current!;
    registerAudio(side, element);
    const controller = new AbortController();
    let objectUrl: string | undefined;
    element.volume = 0.25;
    element.playbackRate = 1;
    setStatus("loading");
    setError("");
    setBins([]);
    setTime(0);
    setVolume(0.25);
    void loadAudio(recording, controller.signal)
      .then(({ blob, bins: nextBins }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setBins(nextBins);
        element.src = objectUrl;
        element.load();
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "Audio could not be loaded.",
        );
        setStatus("error");
      });
    return () => {
      mounted.current = false;
      controller.abort();
      element.pause();
      element.removeAttribute("src");
      element.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      registerAudio(side, null);
    };
  }, [recording, side, retry, registerAudio]);

  async function togglePlayback() {
    const element = audioRef.current!;
    if (!element.paused) {
      element.pause();
      return;
    }
    if (element.ended) element.currentTime = 0;
    onPlay(element);
    setStatus("starting");
    try {
      await element.play();
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setStatus("paused");
        return;
      }
      setError("Playback could not start. Try again or use another browser.");
      setStatus("error");
    }
  }

  const playable = !["loading", "error"].includes(status);
  const playing = status === "playing" || status === "starting";
  return (
    <section
      className={`audio-card side-${side.toLowerCase()}`}
      aria-label={`Recording ${side}`}
      data-testid={`recording-${side}`}
    >
      <div className="card-heading">
        <span className="side-badge">{side}</span>
        <label className="source-picker">
          Recording {side}
          <select
            aria-label={`Select recording ${side}`}
            value={recording.id}
            onChange={(event) => onSelect(event.target.value)}
          >
            {recordings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <span className="count-badge">
          {recording.annotation.clickTimesSeconds.length} estimated clicks
        </span>
      </div>
      <div className="wave-area">
        {bins.length > 0 ? (
          <Waveform bins={bins} recording={recording} time={time} />
        ) : (
          <div className="wave-placeholder">
            {status === "error"
              ? "Waveform unavailable"
              : "Decoding original audio…"}
          </div>
        )}
      </div>
      <audio
        ref={audioRef}
        preload="auto"
        aria-label={`Audio for recording ${side}`}
        onCanPlay={() =>
          setStatus((current) => (current === "loading" ? "ready" : current))
        }
        onPlaying={() => setStatus("playing")}
        onPause={() => {
          if (mounted.current)
            setStatus((current) => (current === "error" ? current : "paused"));
        }}
        onEnded={() => setStatus("ended")}
        onTimeUpdate={() => setTime(audioRef.current?.currentTime ?? 0)}
        onError={() => {
          if (mounted.current && audioRef.current?.getAttribute("src")) {
            setStatus("error");
            setError("The audio player could not read this recording.");
          }
        }}
      />
      <div className="playback-row">
        <button
          className="play-button"
          disabled={!playable}
          aria-label={`${playing ? "Pause" : "Play"} recording ${side}`}
          onClick={() => void togglePlayback()}
        >
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>{" "}
          {playing ? "Pause" : "Play"}
        </button>
        <div className="seek-control">
          <label className="sr-only" htmlFor={`seek-${side}`}>
            Seek recording {side}
          </label>
          <input
            id={`seek-${side}`}
            type="range"
            min="0"
            max={recording.audio.durationSeconds}
            step="0.01"
            value={time}
            disabled={!playable}
            aria-valuetext={`${time.toFixed(2)} seconds`}
            onChange={(event) => {
              const next = Number(event.target.value);
              audioRef.current!.currentTime = next;
              setTime(next);
            }}
          />
          <div className="time-label">
            <span>{time.toFixed(2)} s</span>
            <span>
              {recording.audio.durationSeconds.toFixed(3)} s recording
            </span>
          </div>
        </div>
      </div>
      <div className="audio-meta">
        <span role="status" aria-label={`Playback status ${side}`}>
          {
            {
              loading: "Loading audio…",
              ready: "Ready · source bytes checked",
              starting: "Starting…",
              playing: "Playing",
              paused: "Paused",
              ended: "Finished",
              error: "Audio unavailable",
            }[status]
          }
        </span>
        <label className="volume-control">
          Volume{" "}
          <input
            aria-label={`Volume recording ${side}`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              audioRef.current!.volume = next;
            }}
          />
          <span>{Math.round(volume * 100)}%</span>
        </label>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}{" "}
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry audio {side}
          </button>
        </div>
      )}
      <div className="annotation-note">
        <span className="estimate-dot" aria-hidden="true" /> Machine-estimated
        markers · no human review
      </div>
      <button className="make-button" onClick={onMake}>
        Make my version · {recording.source.filename}
      </button>
      <details className="source-details">
        <summary>Source & annotation details</summary>
        <p>
          {recording.source.attribution}{" "}
          <a href={recording.source.licenseUrl}>{recording.source.license}</a>.
        </p>
        <dl>
          <dt>Original file</dt>
          <dd>
            <a href={recording.source.url}>{recording.source.filename}</a> ·{" "}
            {recording.audio.sampleRateHz.toLocaleString("en-US")} Hz · mono
            PCM16
          </dd>
          <dt>Selected interval</dt>
          <dd>
            0–{recording.audio.durationSeconds.toFixed(6)} s, original file
            start. Entire clip; coda boundaries unverified.
          </dd>
          <dt>Method</dt>
          <dd>
            {recording.annotation.method} v{recording.annotation.version}. 2 ms
            peak envelope, 18% threshold, 70 ms grouping gap.
          </dd>
          <dt>Transformations</dt>
          <dd>
            None to the stored audio. Waveform display scaled per recording;
            playback starts at 25% volume and original speed.
          </dd>
          <dt>Revision</dt>
          <dd>
            <code>{recording.source.revision}</code>
          </dd>
          <dt>SHA-256</dt>
          <dd>
            <code>{recording.audio.sha256}</code>
          </dd>
        </dl>
        <p>
          <a href={recording.source.datasetCardUrl}>Pinned dataset card</a> ·{" "}
          <a href={recording.source.paperUrl}>Associated paper</a>
        </p>
        <p>{recording.source.citation}</p>
        <p>
          Peak timestamps are estimates, not verified onsets or coda classes.
          Echoes and unrelated transients may be included.
        </p>
      </details>
    </section>
  );
}
