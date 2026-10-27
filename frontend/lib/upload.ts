function send(method: "POST" | "PUT", url: string, blob: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) reject(new Error(`upload ${xhr.status}`));
      else resolve(xhr.responseText);
    };
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.send(blob);
  });
}

/** Uploads a blob to a Convex upload URL, reporting progress from 0 to 1. Returns the storage id. */
export async function uploadWithProgress(url: string, blob: Blob, onProgress?: (fraction: number) => void) {
  return (JSON.parse(await send("POST", url, blob, onProgress)) as { storageId: string }).storageId;
}

/** Uploads a blob to a Google Drive resumable session URL. Returns the Drive file id. */
export async function uploadToDrive(url: string, blob: Blob, onProgress?: (fraction: number) => void) {
  return (JSON.parse(await send("PUT", url, blob, onProgress)) as { id: string }).id;
}
