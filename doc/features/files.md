# Feature: Files (文件)

## Summary

A simple Google Drive replacement: a folder tree per department, an org-wide shared area, and a private "My files" area per user. Files are stored in Convex file storage.

## Spaces

| Space | Scope value | Who can read | Who can upload | Who can manage folders |
| --- | --- | --- | --- | --- |
| 全体共享 Org shared | `org` | All approved users | Presidium | Presidium |
| 部门文件 Department | `department` | Department members, presidium | Department members, presidium | Department leads, presidium |
| 我的文件 My files | `personal` | Owner; overseers via oversight (logged) | Owner | Owner |

The files home page (`/files`) shows the spaces the viewer can access: Org shared, each of their departments, and My files. Presidium also sees every department.

## Layout

```text
文件 Files  >  活动部  >  2026 迎新晚会
[Upload] [New folder]                        [Search files...] [List|Grid]
---------------------------------------------------------------------------
Name                     Uploaded by     Modified        Size
[dir]  海报素材             Alice           Oct 12          -
[xlsx] 预算表.xlsx          Bob             Oct 15          48 KB
[png]  场地平面图.png        Carol           Oct 16          2.1 MB
```

- Breadcrumb navigation; the URL holds the folder ID.
- List view by default, grid view optional (image thumbnails).
- Drag and drop to upload, with a progress indicator per file.
- Row menu: Download, Rename, Move, Copy link, Delete (only items the viewer may act on).

## Uploads

- Flow: `generateUploadUrl`, then direct `POST` to Convex storage, then `saveFile`. See [01-architecture.md](../01-architecture.md#uploading-a-file).
- Max file size: **25 MB** per file (configurable constant `MAX_FILE_BYTES`). The client checks first; the server checks again using the size from storage metadata (`ctx.db.system.get(storageId)`).
- Allowed types: everything except executables (`.exe`, `.bat`, `.sh`, `.app`, `.msi`, `.dmg`). Block by extension and content type.
- Name conflicts in the same folder: append " (1)", " (2)", and so on.
- If `saveFile` fails after the upload, delete the orphaned storage object (`ctx.storage.delete`). A daily cron also cleans storage objects not referenced by any file, message, or assignment after 24 hours.

## Previews

- Images (`image/*`): inline preview and lightbox.
- PDF: open in a new tab using the signed URL (browser viewer).
- Video and audio: native `<video>` and `<audio>` players.
- Office files and others: download only in v1.

## Folder operations

- Create, rename, move (within the same space only), delete.
- Delete is soft (`deletedAt`) for both folders and files. Deleting a folder soft-deletes its contents.
- A "回收站 / Trash" view for department leads and presidium lists soft-deleted items for 30 days with Restore. A daily cron permanently deletes items older than 30 days (row and storage object).

## Linking files elsewhere

- Chat attachments and assignment attachments are stored the same way, but are owned by the message or assignment, not by a folder.
- "Save to Files" on a chat attachment copies its metadata into a chosen folder (same `storageId`, new `files` row). Storage cleanup must check every reference before deleting a blob.

## Search

- v1: search file names across the spaces the viewer can read, using the `search_name` search index, then filter results with `canReadFile`.

## Convex functions

| Function | Type | Notes |
| --- | --- | --- |
| `folders.listSpaces` | query | Roots the viewer can access |
| `folders.get`, `folders.listChildren` | query | Includes breadcrumb |
| `folders.create`, `rename`, `move`, `remove`, `restore` | mutation | |
| `files.generateUploadUrl` | mutation | Requires write access to target folder or channel |
| `files.saveFile` | mutation | Validates size and type |
| `files.getDownloadUrl` | mutation | Mutation (not query) so oversight access can be logged |
| `files.rename`, `move`, `remove`, `restore` | mutation | |
| `files.search` | query | |
| `files.listTrash` | query | Leads (own departments) and presidium |

## Acceptance criteria

- [ ] Members can browse and upload only in departments they belong to.
- [ ] A user's "My files" are invisible to other members; overseer access is logged.
- [ ] Files over 25 MB or with blocked types are rejected on the server.
- [ ] Deleted items can be restored within 30 days and are purged afterwards.
- [ ] Download URLs are only returned after a permission check.
