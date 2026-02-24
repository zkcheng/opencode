import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import path from "path"
import { HTTPException } from "hono/http-exception"
import { File } from "../../file"
import { Ripgrep } from "../../file/ripgrep"
import { LSP } from "../../lsp"
import { Instance } from "../../project/instance"
import { lazy } from "../../util/lazy"

export const FileRoutes = lazy(() =>
  new Hono()
    .get(
      "/find",
      describeRoute({
        summary: "Find text",
        description: "Search for text patterns across files in the project using ripgrep.",
        operationId: "find.text",
        responses: {
          200: {
            description: "Matches",
            content: {
              "application/json": {
                schema: resolver(Ripgrep.Match.shape.data.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          pattern: z.string(),
        }),
      ),
      async (c) => {
        const pattern = c.req.valid("query").pattern
        const result = await Ripgrep.search({
          cwd: Instance.directory,
          pattern,
          limit: 10,
        })
        return c.json(result)
      },
    )
    .get(
      "/find/file",
      describeRoute({
        summary: "Find files",
        description: "Search for files or directories by name or pattern in the project directory.",
        operationId: "find.files",
        responses: {
          200: {
            description: "File paths",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
          dirs: z.enum(["true", "false"]).optional(),
          type: z.enum(["file", "directory"]).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query").query
        const dirs = c.req.valid("query").dirs
        const type = c.req.valid("query").type
        const limit = c.req.valid("query").limit
        const results = await File.search({
          query,
          limit: limit ?? 10,
          dirs: dirs !== "false",
          type,
        })
        return c.json(results)
      },
    )
    .get(
      "/find/symbol",
      describeRoute({
        summary: "Find symbols",
        description: "Search for workspace symbols like functions, classes, and variables using LSP.",
        operationId: "find.symbols",
        responses: {
          200: {
            description: "Symbols",
            content: {
              "application/json": {
                schema: resolver(LSP.Symbol.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
        }),
      ),
      async (c) => {
        /*
      const query = c.req.valid("query").query
      const result = await LSP.workspaceSymbol(query)
      return c.json(result)
      */
        return c.json([])
      },
    )
    .get(
      "/file",
      describeRoute({
        summary: "List files",
        description: "List files and directories in a specified path.",
        operationId: "file.list",
        responses: {
          200: {
            description: "Files and directories",
            content: {
              "application/json": {
                schema: resolver(File.Node.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.list(path)
        return c.json(content)
      },
    )
    .get(
      "/file/content",
      describeRoute({
        summary: "Read file",
        description: "Read the content of a specified file.",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.read(path)
        return c.json(content)
      },
    )
    .get(
      "/file/status",
      describeRoute({
        summary: "Get file status",
        description: "Get the git status of all files in the project.",
        operationId: "file.status",
        responses: {
          200: {
            description: "File status",
            content: {
              "application/json": {
                schema: resolver(File.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const content = await File.status()
        return c.json(content)
      },
    )
    .post(
      "/file/upload",
      describeRoute({
        summary: "Upload file",
        description: "Upload a file to a specific directory.",
        operationId: "file.upload",
        responses: {
          200: {
            description: "File uploaded",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const dirPath = c.req.valid("query").path
        const body = await c.req.parseBody()
        const file = body["file"]

        if (!(file instanceof globalThis.File)) {
          throw new HTTPException(400, { message: "No file provided" })
        }

        const fullPath = path.join(Instance.directory, dirPath, file.name)

        if (!Instance.containsPath(fullPath)) {
          throw new HTTPException(403, { message: "Access denied" })
        }

        await Bun.write(fullPath, file)
        return c.json({ success: true })
      },
    )
    .get(
      "/file/download",
      describeRoute({
        summary: "Download file",
        description: "Download a file from the project.",
        operationId: "file.download",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.union([z.string(), z.array(z.string())]),
        }),
      ),
      async (c) => {
        const rawPath = c.req.valid("query").path
        const paths = Array.isArray(rawPath) ? rawPath : [rawPath]
        
        if (paths.length === 0) {
            throw new HTTPException(400, { message: "No path provided" })
        }

        const enc5987 = (s: string) =>
          encodeURIComponent(s).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
        const ascii = (s: string) => {
          const x = s.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_")
          return x.length ? x : "download"
        }
        const dispo = (name: string) => {
          const a = ascii(name)
          const e = enc5987(name)
          return `attachment; filename="${a}"; filename*=UTF-8''${e}`
        }

        // Single path handling (backward compatibility + optimization)
        if (paths.length === 1) {
            const filePath = paths[0]
            const fullPath = path.join(Instance.directory, filePath)

            if (!Instance.containsPath(fullPath)) {
            throw new HTTPException(403, { message: "Access denied" })
            }

            const file = Bun.file(fullPath)
            const exists = await file.exists()
            
            // Check if it is a directory
            const stats = await import("node:fs/promises").then(fs => fs.stat(fullPath)).catch(() => null)
            
            if (!exists && !stats) {
            throw new HTTPException(404, { message: "File not found" })
            }

            if (stats && stats.isDirectory()) {
                const filename = path.basename(filePath) || "root"
                const proc = Bun.spawn(["zip", "-r", "-", "."], {
                    cwd: fullPath,
                    stderr: "ignore",
                })
                
                return c.body(proc.stdout, 200, {
                    "Content-Type": "application/zip",
                    "Content-Disposition": dispo(`${filename}.zip`),
                })
            }

            return c.body(file.stream(), 200, {
            "Content-Type": file.type || "application/octet-stream",
            "Content-Disposition": dispo(path.basename(filePath)),
            })
        }

        // Multiple paths handling
        const zipArgs = ["zip", "-r", "-"]
        for (const p of paths) {
            const fullPath = path.join(Instance.directory, p)
            if (!Instance.containsPath(fullPath)) {
                throw new HTTPException(403, { message: "Access denied" })
            }
            // Use relative path for zip to maintain structure or just names?
            // Using relative path from Instance.directory is safest
            zipArgs.push(p)
        }

        const proc = Bun.spawn(zipArgs, {
            cwd: Instance.directory,
            stderr: "ignore",
        })

        return c.body(proc.stdout, 200, {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="download.zip"`,
        })
      },
    ),
)
