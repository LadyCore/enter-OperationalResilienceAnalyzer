/** H-010: every feedback report must carry between 1 and 3 screenshots. */

export const MIN_FEEDBACK_SCREENSHOTS = 1;
export const MAX_FEEDBACK_SCREENSHOTS = 3;

export const FEEDBACK_SCREENSHOT_LIMITS = {
  min: MIN_FEEDBACK_SCREENSHOTS,
  max: MAX_FEEDBACK_SCREENSHOTS,
} as const;

/** Max side (px) used when compressing an attached screenshot. */
const MAX_DIMENSION = 1600;
/** JPEG quality used when compressing an attached screenshot. */
const JPEG_QUALITY = 0.72;

/**
 * Read an image File and return it as a downscaled JPEG data URL so attached
 * captures stay small enough to persist with the report.
 */
export function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not read the screenshot.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be read."));
    };
    img.src = url;
  });
}

/**
 * Shared validation applied at the point of submission (api.ts), not only in
 * the UI. Throws when the screenshots list is empty or exceeds the maximum, so
 * a report can never be persisted without an attached capture.
 */
export function assertFeedbackScreenshotsValid(screenshots: string[]): void {
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    throw new Error("Please attach at least one screenshot to send the report.");
  }
  if (screenshots.length > MAX_FEEDBACK_SCREENSHOTS) {
    throw new Error(`A maximum of ${MAX_FEEDBACK_SCREENSHOTS} screenshots is allowed per report.`);
  }
  for (const shot of screenshots) {
    if (typeof shot !== "string" || shot.length === 0) {
      throw new Error("A screenshot could not be read. Please try attaching it again.");
    }
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * H-010: every report requires a reporter email so the confirmation copy can be
 * sent after the report is persisted. Shared by the UI and the submit entry
 * point (api.ts); the backend function enforces the same rule again.
 */
export function assertFeedbackEmailValid(email: string): void {
  const value = typeof email === "string" ? email.trim() : "";
  if (!EMAIL_PATTERN.test(value)) {
    throw new Error("Please provide a valid email to receive the confirmation.");
  }
}

/** True when a stored screenshot entry is a legacy inline data URL. */
export function isLegacyDataUrl(value: string): boolean {
  return typeof value === "string" && value.startsWith("data:");
}
