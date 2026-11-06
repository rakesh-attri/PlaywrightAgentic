import fs from "node:fs";
import path from "node:path";
import { ChromaClient, CloudClient, type Where } from "chromadb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { root, hash, json, write } from "./files.js";
import { embeddings } from "./llm.js";
import type { Mode } from "./models.js";
export type Chunk = {
  id: string;
  text: string;
  vector: number[];
  metadata: {
    source: string;
    project: string;
    status: "approved" | "draft";
    hash: string;
    chunk: number;
    embedding: string;
  };
};
export function demoEmbed(text: string) {
  const v = Array(512).fill(0) as number[];
  for (const word of text.toLowerCase().match(/[a-z0-9_]+/g) || [])
    v[parseInt(hash(word).slice(0, 8), 16) % 512]++;
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}
export class Knowledge {
  file = path.join(root, ".state/demo-vectors.json");
  constructor(public mode: Mode) {}
  usesChroma() {
    return this.mode === "live" || process.env.SFQA_VECTOR_BACKEND === "chroma";
  }
  async collection() {
    const client = process.env.CHROMA_API_KEY
      ? new CloudClient({
          apiKey: process.env.CHROMA_API_KEY,
          tenant: process.env.CHROMA_TENANT,
          database: process.env.CHROMA_DATABASE,
        })
      : new ChromaClient({
          host: process.env.CHROMA_HOST || "localhost",
          port: Number(process.env.CHROMA_PORT || 8000),
          ssl: process.env.CHROMA_SSL === "true",
          tenant: process.env.CHROMA_TENANT || "default_tenant",
          database: process.env.CHROMA_DATABASE || "default_database",
        });
    const identity =
      this.mode === "demo"
        ? "lexical-hash-512-v1"
        : process.env.SFQA_EMBED_MODEL || "text-embedding-3-small";
    const name =
      "sfqa_" + hash(identity + (process.env.SFQA_API_BASE || "")).slice(0, 12);
    return client.getOrCreateCollection({ name, embeddingFunction: null });
  }
  async ingest(
    source: string,
    text: string,
    project: string,
    status: "approved" | "draft" = "draft",
  ) {
    const split = new RecursiveCharacterTextSplitter({
      chunkSize: 1600,
      chunkOverlap: 200,
    });
    const texts = await split.splitText(text);
    const digest = hash(text),
      modelId =
        this.mode === "demo"
          ? "lexical-hash-512-v1"
          : process.env.SFQA_EMBED_MODEL || "text-embedding-3-small";
    const vectors =
      this.mode === "demo"
        ? texts.map(demoEmbed)
        : await embeddings().embedDocuments(texts);
    const rows = texts.map((text, i): Chunk => ({
      id: `${hash(project + ":" + source).slice(0, 16)}:${digest.slice(0, 12)}:${i}`,
      text,
      vector: vectors[i],
      metadata: {
        source,
        project,
        status,
        hash: digest,
        chunk: i,
        embedding: modelId,
      },
    }));
    if (!this.usesChroma()) {
      const old: Chunk[] = fs.existsSync(this.file) ? json(this.file) : [];
      write(this.file, [
        ...old.filter(
          (r) => r.metadata.project !== project || r.metadata.source !== source,
        ),
        ...rows,
      ]);
    } else {
      const c = await this.collection();
      const where: Where = { $and: [{ source }, { project }] };
      const old = await c.get({ where });
      if (rows.length)
        await c.upsert({
          ids: rows.map((r) => r.id),
          documents: texts,
          embeddings: vectors,
          metadatas: rows.map((r) => r.metadata),
        });
      const stale = old.ids.filter((id) => !rows.some((r) => r.id === id));
      if (stale.length) await c.delete({ ids: stale });
    }
    return rows.length;
  }
  async search(question: string, project: string, k = 5) {
    if (!this.usesChroma()) {
      const rows: Chunk[] = fs.existsSync(this.file) ? json(this.file) : [];
      const v = demoEmbed(question);
      return rows
        .filter(
          (r) =>
            r.metadata.project === project && r.metadata.status === "approved",
        )
        .map((r) => ({
          id: r.id,
          text: r.text,
          metadata: r.metadata,
          score: r.vector.reduce((n, x, i) => n + x * v[i], 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    }
    const c = await this.collection();
    const vector =
      this.mode === "demo"
        ? demoEmbed(question)
        : await embeddings().embedQuery(question);
    const result = await c.query({
      queryEmbeddings: [vector],
      nResults: k,
      where: { $and: [{ project }, { status: "approved" }] },
    });
    return result.ids[0].map((id, i) => ({
      id,
      text: result.documents[0][i] || "",
      metadata: result.metadatas[0][i],
      score: result.distances?.[0]?.[i] ?? null,
    }));
  }
  async remove(source: string, project: string) {
    if (this.usesChroma())
      await (
        await this.collection()
      ).delete({ where: { $and: [{ source }, { project }] } });
    else {
      const rows: Chunk[] = fs.existsSync(this.file) ? json(this.file) : [];
      write(
        this.file,
        rows.filter(
          (r) => r.metadata.project !== project || r.metadata.source !== source,
        ),
      );
    }
  }
}
