import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
  type EncodedPacket,
  type InputAudioTrack,
  type InputVideoTrack,
} from "mediabunny";

import type { MatchDetail, MatchRecord, MatchScoreEventRecord, MomentRecord } from "@/lib/domain";
import {
  buildClipFileName,
  exportMomentClip as exportMomentClipLegacy,
  sanitizeFileName,
  type ExportQuality,
} from "@/lib/video-export";

type MatchForExport = Pick<MatchDetail, "title" | "opponentName" | "competition">;

export type SmartExportMode = "direct" | "webcodecs" | "compatibility";

export type SmartExportResult = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  mode: SmartExportMode;
};

type ExportMomentInput = {
  match: MatchForExport;
  moment: MomentRecord;
  quality?: ExportQuality;
  onStatus?: (status: string) => void;
  sourceUrlFallback?: string;
  includeAudio?: boolean;
};

type ExportFullMatchInput = {
  match: MatchRecord & { scoreEvents: MatchScoreEventRecord[] };
  quality?: ExportQuality;
  includeAudio?: boolean;
  onStatus?: (status: string) => void;
};

// Only remux when the saved mark is effectively on the keyframe. Otherwise an
// exact WebCodecs trim is safer than silently moving a football event boundary.
const DIRECT_CUT_TOLERANCE_SECONDS = 0.04;
const WEBCODECS_STALL_TIMEOUT_MS = 45_000;
const WEBCODECS_CANCEL_GRACE_MS = 5_000;
const WEBCODECS_MIN_TOTAL_TIMEOUT_MS = 90_000;
const WEBCODECS_MAX_TOTAL_TIMEOUT_MS = 5 * 60_000;

const transcodeSettings: Record<ExportQuality, { videoBitrate: number; audioBitrate: number }> = {
  original: { videoBitrate: 30_000_000, audioBitrate: 256_000 },
  high: { videoBitrate: 18_000_000, audioBitrate: 192_000 },
  standard: { videoBitrate: 9_000_000, audioBitrate: 160_000 },
};

export class SmartVideoExportSession {
  private readonly source: File | string;
  private readonly input: Input;
  private videoTrackPromise: Promise<InputVideoTrack | null> | null = null;
  private audioTrackPromise: Promise<InputAudioTrack | null> | null = null;

  constructor(source: File | string) {
    this.source = source;
    this.input = this.createInput();
  }

  private createInput() {
    return new Input({
      formats: ALL_FORMATS,
      source: typeof this.source === "string"
        ? new UrlSource(this.source, { maxCacheSize: 64 * 1024 * 1024, parallelism: 2 })
        : new BlobSource(this.source),
    });
  }

  async validate() {
    if (!(await this.input.canRead())) {
      throw new Error("The selected video format is not supported by the fast exporter.");
    }

    const videoTrack = await this.getVideoTrack();
    if (!videoTrack) {
      throw new Error("The selected file does not contain a video track.");
    }
  }

  async exportMoment({
    match,
    moment,
    quality = "high",
    onStatus,
    sourceUrlFallback,
    includeAudio = false,
  }: ExportMomentInput): Promise<SmartExportResult> {
    await this.validate();

    onStatus?.("Checking whether the clip can be copied without re-encoding...");
    try {
      const direct = await this.tryDirectExport(match, moment, onStatus, includeAudio);
      if (direct) {
        return direct;
      }
    } catch (error) {
      console.info("Direct video export was not possible. Trying WebCodecs.", error);
    }

    onStatus?.("Encoding an exact cut with WebCodecs...");
    try {
      return await this.exportWithWebCodecs(match, moment, quality, onStatus, "no-preference", includeAudio);
    } catch (error) {
      if (error instanceof WebCodecsStallError) {
        onStatus?.("The exact exporter stopped responding. Retrying with software encoding...");
        try {
          return await this.exportWithWebCodecs(match, moment, quality, onStatus, "prefer-software", includeAudio);
        } catch (retryError) {
          console.info("The software WebCodecs retry was not possible. Trying compatibility mode.", retryError);
        }
      }
      console.info("WebCodecs export was not possible. Trying compatibility mode.", error);
      if (!sourceUrlFallback) {
        throw normalizeExportError(error);
      }
    }

    onStatus?.("Using browser compatibility mode...");
    const legacy = await exportMomentClipLegacy({
      sourceUrl: sourceUrlFallback,
      match,
      moment,
      quality,
      onStatus,
      includeAudio,
    });
    return { ...legacy, mode: "compatibility" };
  }

  async exportFullMatch({ match, quality = "standard", includeAudio = false, onStatus }: ExportFullMatchInput): Promise<SmartExportResult> {
    await this.validate();
    if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") throw new Error("Full match export requires a recent version of Chrome or Edge.");
    const conversionInput = this.createInput();
    const logos = await Promise.all([loadOverlayImage(match.homeClubLogoDataUrl), loadOverlayImage(match.awayClubLogoDataUrl)]);
    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    try {
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
      const settings = transcodeSettings[quality];
      const conversion = await Conversion.init({
        input: conversionInput,
        output,
        tracks: "primary",
        video: {
          codec: "avc",
          bitrate: settings.videoBitrate,
          keyFrameInterval: 2,
          hardwareAcceleration: "no-preference",
          forceTranscode: true,
          process: (sample) => {
            if (!canvas) {
              canvas = document.createElement("canvas");
              canvas.width = sample.displayWidth;
              canvas.height = sample.displayHeight;
              context = canvas.getContext("2d");
            }
            if (!canvas || !context) throw new Error("Could not prepare the scoreboard overlay.");
            sample.draw(context, 0, 0, canvas.width, canvas.height);
            drawBroadcastOverlay(context, canvas.width, canvas.height, match, sample.timestamp, logos);
            return canvas;
          },
        },
        audio: includeAudio ? { codec: "aac", bitrate: settings.audioBitrate } : { discard: true },
        showWarnings: false,
      });
      if (!conversion.isValid) throw new Error("This video cannot be exported with the scoreboard in this browser.");
      await executeLongConversion(conversion, (progress) => onStatus?.(`Exporting full match: ${Math.min(100, Math.round(progress * 100))}%`));
      if (!target.buffer?.byteLength) throw new Error("The full match export finished without video data.");
      return { blob: new Blob([target.buffer], { type: "video/mp4" }), fileName: `${sanitizeFileName(match.title) || "match"}-scoreboard.mp4`, mimeType: "video/mp4", mode: "webcodecs" };
    } finally {
      conversionInput.dispose();
      logos.forEach((logo) => { if (logo && "close" in logo && typeof logo.close === "function") logo.close(); });
    }
  }

  dispose() {
    this.input.dispose();
  }

  private getVideoTrack() {
    this.videoTrackPromise ??= this.input.getPrimaryVideoTrack();
    return this.videoTrackPromise;
  }

  private getAudioTrack() {
    this.audioTrackPromise ??= this.input.getPrimaryAudioTrack();
    return this.audioTrackPromise;
  }

  private async tryDirectExport(
    match: MatchForExport,
    moment: MomentRecord,
    onStatus?: (status: string) => void,
    includeAudio = false,
  ): Promise<SmartExportResult | null> {
    const videoTrack = await this.getVideoTrack();
    if (!videoTrack) return null;

    const audioTrack = includeAudio ? await this.getAudioTrack() : null;
    const format = new Mp4OutputFormat({ fastStart: "in-memory" });
    const videoCodec = await videoTrack.getCodec();
    const audioCodec = await audioTrack?.getCodec();

    if (!videoCodec || !format.getSupportedVideoCodecs().includes(videoCodec)) return null;
    if (audioTrack && (!audioCodec || !format.getSupportedAudioCodecs().includes(audioCodec))) return null;

    const start = Math.max(0, moment.startTimeSeconds);
    const end = Math.max(start + 0.1, moment.endTimeSeconds);
    const videoSink = new EncodedPacketSink(videoTrack);
    const startKeyPacket = await videoSink.getKeyPacket(start, { verifyKeyPackets: true });
    if (!startKeyPacket || start - startKeyPacket.timestamp > DIRECT_CUT_TOLERANCE_SECONDS) {
      return null;
    }

    const endKeyBefore = await videoSink.getKeyPacket(end, { verifyKeyPackets: true });
    if (!endKeyBefore) return null;
    const endKeyAfter = await videoSink.getNextKeyPacket(endKeyBefore, { verifyKeyPackets: true });
    const endKeyPacket = Math.abs(endKeyBefore.timestamp - end) <= DIRECT_CUT_TOLERANCE_SECONDS
      ? endKeyBefore
      : endKeyAfter && Math.abs(endKeyAfter.timestamp - end) <= DIRECT_CUT_TOLERANCE_SECONDS
        ? endKeyAfter
        : null;
    if (!endKeyPacket || endKeyPacket.timestamp <= startKeyPacket.timestamp) return null;

    const directStart = startKeyPacket.timestamp;
    const directEnd = endKeyPacket.timestamp;
    const target = new BufferTarget();
    const output = new Output({ format, target });
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    output.addVideoTrack(videoSource, {
      rotation: await videoTrack.getRotation(),
      languageCode: await videoTrack.getLanguageCode(),
      name: (await videoTrack.getName()) ?? undefined,
      disposition: await videoTrack.getDisposition(),
    });

    let audioSource: EncodedAudioPacketSource | null = null;
    let audioSink: EncodedPacketSink | null = null;
    if (audioTrack && audioCodec) {
      audioSource = new EncodedAudioPacketSource(audioCodec);
      audioSink = new EncodedPacketSink(audioTrack);
      output.addAudioTrack(audioSource, {
        languageCode: await audioTrack.getLanguageCode(),
        name: (await audioTrack.getName()) ?? undefined,
        disposition: await audioTrack.getDisposition(),
      });
    }

    await output.start();
    onStatus?.("Copying the original video data without quality loss...");

    try {
      const videoConfig = await videoTrack.getDecoderConfig();
      const audioConfig = await audioTrack?.getDecoderConfig();
      await Promise.all([
        copyPackets({
          sink: videoSink,
          source: videoSource,
          startPacket: startKeyPacket,
          endPacket: endKeyPacket,
          start: directStart,
          metadata: videoConfig ? { decoderConfig: videoConfig } : undefined,
          onProgress: (time) => onStatus?.(`Direct cut: ${Math.min(100, Math.round(100 * time / (directEnd - directStart)))}%`),
        }),
        audioSource && audioSink
          ? copyAudioPackets({
              sink: audioSink,
              source: audioSource,
              start: directStart,
              end: directEnd,
              metadata: audioConfig ? { decoderConfig: audioConfig } : undefined,
            })
          : Promise.resolve(),
      ]);
      await output.finalize();
    } catch (error) {
      await output.cancel().catch(() => undefined);
      throw error;
    }

    if (!target.buffer || target.buffer.byteLength === 0) {
      throw new Error("The direct cut finished without video data.");
    }

    return {
      blob: new Blob([target.buffer], { type: "video/mp4" }),
      fileName: buildClipFileName(match, moment, "mp4"),
      mimeType: "video/mp4",
      mode: "direct",
    };
  }

  private async exportWithWebCodecs(
    match: MatchForExport,
    moment: MomentRecord,
    quality: ExportQuality,
    onStatus?: (status: string) => void,
    hardwareAcceleration: HardwareAcceleration = "no-preference",
    includeAudio = false,
  ): Promise<SmartExportResult> {
    if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
      throw new Error("WebCodecs is not available in this browser.");
    }

    // A fresh input isolates every exact cut. This prevents a stalled browser
    // decoder/encoder from poisoning the remaining clips in a large batch.
    const conversionInput = this.createInput();
    try {
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
      const settings = transcodeSettings[quality];
      const start = Math.max(0, moment.startTimeSeconds);
      const end = Math.max(start + 0.1, moment.endTimeSeconds);
      const conversion = await Conversion.init({
        input: conversionInput,
        output,
        tracks: "primary",
        trim: { start, end },
        video: {
          codec: "avc",
          bitrate: settings.videoBitrate,
          keyFrameInterval: 2,
          hardwareAcceleration,
        },
        audio: includeAudio ? { codec: "aac", bitrate: settings.audioBitrate } : { discard: true },
        showWarnings: false,
      });

      if (!conversion.isValid) {
        const reasons = [...new Set(conversion.discardedTracks.map((item) => item.reason))].join(", ");
        throw new Error(`WebCodecs cannot export this video${reasons ? ` (${reasons})` : ""}.`);
      }

      await executeConversionWithWatchdog(conversion, end - start, (progress) => {
        onStatus?.(`Exact cut with WebCodecs: ${Math.min(100, Math.round(progress * 100))}%`);
      });

      if (!target.buffer || target.buffer.byteLength === 0) {
        throw new Error("WebCodecs finished without video data.");
      }

      return {
        blob: new Blob([target.buffer], { type: "video/mp4" }),
        fileName: buildClipFileName(match, moment, "mp4"),
        mimeType: "video/mp4",
        mode: "webcodecs",
      };
    } finally {
      conversionInput.dispose();
    }
  }
}

class WebCodecsStallError extends Error {
  constructor() {
    super("WebCodecs stopped making progress.");
    this.name = "WebCodecsStallError";
  }
}

async function executeConversionWithWatchdog(
  conversion: Conversion,
  clipDurationSeconds: number,
  onProgress: (progress: number) => void,
) {
  let stallTimeout: ReturnType<typeof setTimeout> | null = null;
  let totalTimeout: ReturnType<typeof setTimeout> | null = null;
  let rejectStall: ((error: Error) => void) | null = null;
  let lastVisiblePercent = -1;

  const stalled = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  const armWatchdog = () => {
    if (stallTimeout) clearTimeout(stallTimeout);
    stallTimeout = setTimeout(() => rejectStall?.(new WebCodecsStallError()), WEBCODECS_STALL_TIMEOUT_MS);
  };

  conversion.onProgress = (progress) => {
    const visiblePercent = Math.min(100, Math.round(progress * 100));
    // Tiny internal timestamp changes can keep firing while the percentage the
    // user sees remains frozen. Only visible progress extends the stall timer.
    if (visiblePercent > lastVisiblePercent) {
      lastVisiblePercent = visiblePercent;
      armWatchdog();
    }
    onProgress(progress);
  };
  armWatchdog();
  const totalTimeoutMs = Math.min(
    WEBCODECS_MAX_TOTAL_TIMEOUT_MS,
    Math.max(WEBCODECS_MIN_TOTAL_TIMEOUT_MS, Math.ceil(clipDurationSeconds * 8_000)),
  );
  totalTimeout = setTimeout(() => rejectStall?.(new WebCodecsStallError()), totalTimeoutMs);

  const execution = conversion.execute();
  try {
    await Promise.race([execution, stalled]);
  } catch (error) {
    // Do not let a browser encoder that stopped responding block the full
    // export. Give Mediabunny a short window to release its resources.
    await Promise.race([
      conversion.cancel().catch(() => undefined),
      wait(WEBCODECS_CANCEL_GRACE_MS),
    ]);
    void execution.catch(() => undefined);
    throw error;
  } finally {
    if (stallTimeout) clearTimeout(stallTimeout);
    if (totalTimeout) clearTimeout(totalTimeout);
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

type PacketCopyInput = {
  sink: EncodedPacketSink;
  source: EncodedVideoPacketSource;
  startPacket: EncodedPacket;
  endPacket: EncodedPacket;
  start: number;
  metadata?: EncodedVideoChunkMetadata;
  onProgress?: (time: number) => void;
};

async function copyPackets({ sink, source, startPacket, endPacket, start, metadata, onProgress }: PacketCopyInput) {
  let first = true;
  try {
    for await (const packet of sink.packets(startPacket, endPacket)) {
      const shifted = packet.clone({ timestamp: Math.max(0, packet.timestamp - start) });
      await source.add(shifted, first ? metadata : undefined);
      first = false;
      onProgress?.(packet.timestamp + packet.duration - start);
    }
  } finally {
    source.close();
  }
}

type AudioPacketCopyInput = {
  sink: EncodedPacketSink;
  source: EncodedAudioPacketSource;
  start: number;
  end: number;
  metadata?: EncodedAudioChunkMetadata;
};

async function copyAudioPackets({ sink, source, start, end, metadata }: AudioPacketCopyInput) {
  const startPacket = await sink.getPacket(start);
  if (!startPacket) {
    source.close();
    return;
  }

  let first = true;
  try {
    for await (const packet of sink.packets(startPacket)) {
      if (packet.timestamp >= end) break;
      const duration = Math.max(0, Math.min(packet.duration, end - packet.timestamp));
      const shifted = packet.clone({ timestamp: Math.max(0, packet.timestamp - start), duration });
      await source.add(shifted, first ? metadata : undefined);
      first = false;
    }
  } finally {
    source.close();
  }
}

function normalizeExportError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error("Could not export the video with the new engine.");
}

async function executeLongConversion(conversion: Conversion, onProgress: (progress: number) => void) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let rejectStall: ((error: Error) => void) | null = null;
  const stalled = new Promise<never>((_, reject) => { rejectStall = reject; });
  const arm = () => { if (timeout) clearTimeout(timeout); timeout = setTimeout(() => rejectStall?.(new WebCodecsStallError()), WEBCODECS_STALL_TIMEOUT_MS); };
  conversion.onProgress = (progress) => { arm(); onProgress(progress); };
  arm();
  const execution = conversion.execute();
  try { await Promise.race([execution, stalled]); }
  catch (error) { await conversion.cancel().catch(() => undefined); void execution.catch(() => undefined); throw error; }
  finally { if (timeout) clearTimeout(timeout); }
}

async function loadOverlayImage(dataUrl: string | null) {
  if (!dataUrl) return null;
  try { return await createImageBitmap(await (await fetch(dataUrl)).blob()); }
  catch { return null; }
}

function scoreForOverlay(events: MatchScoreEventRecord[], time: number) {
  let homeScore = 0; let awayScore = 0;
  for (const event of [...events].sort((a, b) => a.timeSeconds - b.timeSeconds || a.createdAt.localeCompare(b.createdAt))) {
    if (event.timeSeconds > time + .05) break;
    homeScore = event.homeScore; awayScore = event.awayScore;
  }
  return { homeScore, awayScore };
}

function clockForOverlay(match: MatchRecord, time: number) {
  const firstStart = match.firstHalfStartSeconds;
  if (firstStart === null || time < firstStart) return 0;
  if (match.secondHalfStartSeconds !== null && time >= match.secondHalfStartSeconds) {
    const effective = match.secondHalfEndSeconds !== null ? Math.min(time, match.secondHalfEndSeconds) : time;
    return 45 * 60 + Math.max(0, effective - match.secondHalfStartSeconds);
  }
  if (match.firstHalfEndSeconds !== null && time >= match.firstHalfEndSeconds) return 45 * 60;
  return Math.max(0, time - firstStart);
}

function drawBroadcastOverlay(context: CanvasRenderingContext2D, width: number, height: number, match: MatchRecord & { scoreEvents: MatchScoreEventRecord[] }, time: number, logos: (ImageBitmap | null)[]) {
  const scale = Math.max(.6, width / 1920);
  const panelWidth = Math.round(430 * scale); const rowHeight = Math.round(58 * scale); const clockHeight = Math.round(30 * scale); const margin = Math.round(28 * scale);
  const x = width - panelWidth - margin; const y = margin; const score = scoreForOverlay(match.scoreEvents, time);
  context.save(); context.fillStyle = "rgba(2, 6, 23, .91)"; context.fillRect(x, y, panelWidth, rowHeight * 2 + clockHeight);
  context.fillStyle = "#67e8f9"; context.fillRect(x, y, panelWidth, clockHeight);
  const clock = Math.floor(clockForOverlay(match, time)); context.fillStyle = "#082f49"; context.font = `700 ${Math.round(20 * scale)}px ui-monospace, monospace`; context.textAlign = "right"; context.textBaseline = "middle"; context.fillText(`${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`, x + panelWidth - Math.round(16 * scale), y + clockHeight / 2);
  const teams = [match.homeClubShortName || match.homeClubName || match.teamName || "HOME", match.awayClubShortName || match.awayClubName || match.opponentName || "AWAY"];
  const scores = [score.homeScore, score.awayScore];
  for (let index = 0; index < 2; index += 1) {
    const rowY = y + clockHeight + index * rowHeight; const logoSize = Math.round(38 * scale); const logoX = x + Math.round(12 * scale); const logoY = rowY + (rowHeight - logoSize) / 2;
    context.fillStyle = "rgba(255,255,255,.08)"; context.fillRect(logoX, logoY, logoSize, logoSize);
    if (logos[index]) context.drawImage(logos[index]!, logoX, logoY, logoSize, logoSize);
    else { context.fillStyle = "#cbd5e1"; context.font = `800 ${Math.round(13 * scale)}px system-ui, sans-serif`; context.textAlign = "center"; context.fillText(teams[index].slice(0, 2).toUpperCase(), logoX + logoSize / 2, logoY + logoSize / 2); }
    context.fillStyle = "#f8fafc"; context.font = `700 ${Math.round(22 * scale)}px system-ui, sans-serif`; context.textAlign = "left"; context.fillText(teams[index].slice(0, 18), logoX + logoSize + Math.round(12 * scale), rowY + rowHeight / 2);
    context.font = `900 ${Math.round(30 * scale)}px system-ui, sans-serif`; context.textAlign = "right"; context.fillText(String(scores[index]), x + panelWidth - Math.round(18 * scale), rowY + rowHeight / 2);
  }
  context.restore();
}
