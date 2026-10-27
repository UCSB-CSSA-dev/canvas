"use client";

import { useAction, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import { api, LIMITS, type Id } from "@/lib/api";
import { errorCode } from "@/lib/errors";
import { thumbnail } from "@/lib/image";
import { uploadToDrive, uploadWithProgress } from "@/lib/upload";

const THUMBNAIL_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

export type UploadTarget =
  | { space: string; folderId?: Id<"folders">; assignmentId?: undefined }
  | { assignmentId: Id<"assignments">; space?: undefined; folderId?: undefined };

export type UploadItem = {
  key: string;
  name: string;
  size: number;
  progress: number;
  /** Going to Google Drive (too big for Convex, or the space is full). */
  drive?: boolean;
  fileId?: Id<"files">;
  error?: string;
};

type Result = { ok: true; fileId: Id<"files"> } | { ok: false; code: string; message: string };

/**
 * Uploads files into a space folder or a task's folder, tracking progress per file.
 * Files over LIMITS.fileBytes, or that don't fit the space's quota, go to the CSSA Google Drive.
 * Errors are shown as toasts; the returned ids are the files that made it.
 */
export function useFileUpload() {
  const t = useTranslations("files");
  const tErrors = useTranslations("errors");
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const save = useMutation(api.files.save);
  const startDrive = useAction(api.drive.startUpload);
  const finishDrive = useAction(api.drive.finishUpload);
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = (key: string, value: Partial<UploadItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...value } : item)));

  const messageFor = useCallback(
    (code: string, name: string, detail?: string) => {
      if (code === "FILE_TOO_LARGE") return t("tooLarge", { name, max: formatBytes(LIMITS.driveFileBytes) });
      if (code === "FILE_TYPE_BLOCKED") return t("typeBlocked", { name });
      if (code === "QUOTA_EXCEEDED") return t("quotaExceeded", { name, left: formatBytes(Number(detail ?? 0)) });
      if (code === "DRIVE_NOT_CONFIGURED") return t("driveNotConfigured", { name });
      if (code === "DRIVE_FAILED") return t("driveFailed", { name });
      return tErrors(code as "UNKNOWN");
    },
    [t, tErrors],
  );

  const toConvex = useCallback(
    async (file: File, target: UploadTarget, onProgress: (p: number) => void): Promise<Result> => {
      const uploadArgs = target.assignmentId ? { assignmentId: target.assignmentId } : { space: target.space };
      const storageId = await uploadWithProgress(await generateUploadUrl(uploadArgs), file, onProgress);
      let thumbStorageId: string | undefined;
      if (THUMBNAIL_TYPES.has(file.type)) {
        try {
          thumbStorageId = await uploadWithProgress(await generateUploadUrl(uploadArgs), await thumbnail(file));
        } catch {
          thumbStorageId = undefined;
        }
      }
      return await save({
        ...(target.assignmentId ? { assignmentId: target.assignmentId } : { space: target.space, folderId: target.folderId }),
        storageId: storageId as Id<"_storage">,
        thumbStorageId: thumbStorageId as Id<"_storage"> | undefined,
        name: file.name,
      });
    },
    [generateUploadUrl, save],
  );

  const toDrive = useCallback(
    async (file: File, target: UploadTarget, onProgress: (p: number) => void): Promise<Result> => {
      const { uploadId, uploadUrl } = await startDrive({
        ...(target.assignmentId ? { assignmentId: target.assignmentId } : { space: target.space, folderId: target.folderId }),
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
      let driveFileId: string;
      try {
        driveFileId = await uploadToDrive(uploadUrl, file, onProgress);
      } catch {
        return { ok: false, code: "DRIVE_FAILED", message: "upload" };
      }
      return await finishDrive({ uploadId, driveFileId });
    },
    [startDrive, finishDrive],
  );

  const uploadOne = useCallback(
    async (file: File, target: UploadTarget): Promise<Id<"files"> | null> => {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const big = file.size > LIMITS.fileBytes;
      setItems((list) => [...list, { key, name: file.name, size: file.size, progress: 0, drive: big }]);
      const fail = (message: string) => {
        patch(key, { error: message });
        toast.error(message, { duration: 8000 });
        return null;
      };
      if (file.size > LIMITS.driveFileBytes) return fail(messageFor("FILE_TOO_LARGE", file.name));
      const progress = (p: number) => patch(key, { progress: p * 0.95 });
      try {
        let result = big ? await toDrive(file, target, progress) : await toConvex(file, target, progress);
        if (!result.ok && result.code === "QUOTA_EXCEEDED" && !big) {
          patch(key, { drive: true, progress: 0 });
          result = await toDrive(file, target, progress);
        }
        if (!result.ok) return fail(messageFor(result.code, file.name, result.message));
        patch(key, { progress: 1, fileId: result.fileId });
        return result.fileId;
      } catch (error) {
        return fail(messageFor(errorCode(error), file.name));
      }
    },
    [toConvex, toDrive, messageFor],
  );

  const upload = useCallback(
    async (files: File[], target: UploadTarget) => {
      const ids: Id<"files">[] = [];
      for (const file of files) {
        const id = await uploadOne(file, target);
        if (id) ids.push(id);
      }
      return ids;
    },
    [uploadOne],
  );

  const clearDone = useCallback(() => setItems((list) => list.filter((i) => !i.fileId && !i.error && i.progress < 1)), []);
  const dismiss = useCallback((key: string) => setItems((list) => list.filter((i) => i.key !== key)), []);
  const busy = items.some((i) => !i.fileId && !i.error);

  return { upload, items, busy, clearDone, dismiss };
}
