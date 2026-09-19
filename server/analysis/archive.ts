import yauzl from "yauzl";
import { assertSafeSourcePath } from "../security";
import { TRPCError } from "@trpc/server";
import { archiveExtractionsTotal } from "../_core/metrics";

const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10 MiB
const MAX_FILE_SIZE = 750 * 1024; // 750 KiB
const MAX_FILES = 100;

export async function extractZipSafely(buffer: Buffer): Promise<Array<{ path: string; content: string }>> {
  return new Promise((resolve, reject) => {
    const extractedFiles: Array<{ path: string; content: string }> = [];
    let totalSize = 0;
    let fileCount = 0;

    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(new TRPCError({ code: "BAD_REQUEST", message: `Invalid ZIP archive: ${err.message}` }));
      if (!zipfile) return reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to open ZIP" }));

      zipfile.readEntry();

      zipfile.on("entry", (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          zipfile.readEntry();
        } else {
          fileCount++;
          if (fileCount > MAX_FILES) {
            zipfile.close();
            archiveExtractionsTotal.inc({ status: "bomb_rejected" });
            return reject(new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `Archive bomb detected: too many files (max ${MAX_FILES})` }));
          }

          try {
            assertSafeSourcePath(entry.fileName);
          } catch (e) {
            zipfile.close();
            archiveExtractionsTotal.inc({ status: "invalid_archive" });
            return reject(new TRPCError({ code: "BAD_REQUEST", message: `Invalid path in ZIP: ${entry.fileName}` }));
          }

          if (entry.uncompressedSize > MAX_FILE_SIZE) {
            zipfile.close();
            archiveExtractionsTotal.inc({ status: "bomb_rejected" });
            return reject(new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `Archive bomb detected: file exceeds ${MAX_FILE_SIZE / 1024}KiB limit (${entry.fileName})` }));
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              archiveExtractionsTotal.inc({ status: "invalid_archive" });
              return reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to read ${entry.fileName}` }));
            }
            if (!readStream) {
               zipfile.close();
               archiveExtractionsTotal.inc({ status: "invalid_archive" });
               return reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Empty read stream for ${entry.fileName}` }));
            }

            const chunks: Buffer[] = [];
            let currentFileSize = 0;

            readStream.on("data", (chunk: Buffer) => {
              currentFileSize += chunk.length;
              totalSize += chunk.length;

              if (currentFileSize > MAX_FILE_SIZE) {
                readStream.destroy();
                zipfile.close();
                archiveExtractionsTotal.inc({ status: "bomb_rejected" });
                return reject(new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `Archive bomb detected: file exceeds limit while streaming (${entry.fileName})` }));
              }

              if (totalSize > MAX_TOTAL_SIZE) {
                readStream.destroy();
                zipfile.close();
                archiveExtractionsTotal.inc({ status: "bomb_rejected" });
                return reject(new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `Archive bomb detected: total extracted size exceeds 10 MiB limit` }));
              }

              chunks.push(chunk);
            });

            readStream.on("end", () => {
              extractedFiles.push({
                path: entry.fileName,
                content: Buffer.concat(chunks).toString("utf-8")
              });
              zipfile.readEntry();
            });

            readStream.on("error", (streamErr) => {
              zipfile.close();
              archiveExtractionsTotal.inc({ status: "invalid_archive" });
              reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: streamErr.message }));
            });
          });
        }
      });

      zipfile.on("end", () => {
        archiveExtractionsTotal.inc({ status: "success" });
        resolve(extractedFiles);
      });

      zipfile.on("error", (zipErr) => {
        archiveExtractionsTotal.inc({ status: "invalid_archive" });
        reject(new TRPCError({ code: "BAD_REQUEST", message: `ZIP processing error: ${zipErr.message}` }));
      });
    });
  });
}
