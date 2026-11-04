# RAG, chunks, vectors, Chroma and OKF

Your understanding is correct: **each text chunk is converted into a numeric embedding vector, and that vector is stored in the vector database**. Keep the original chunk text and metadata beside it. Embeddings support similarity search; the LLM needs the retrieved text, not just an array of numbers, to answer with evidence.

## Worked Salesforce example

A story says: “Account Name is required. A blank submission displays `Account Name is required` and leaves the dialog open.” An approved runbook describes how to open the Account screen. A reviewed framework lesson explains how to locate rows correctly. They serve different purposes: the story defines expected behavior, the runbook identifies the workflow, and engineering memory guides test implementation.

Ingestion in `src/knowledge.ts` does the following:

1. Read the UTF-8 document. The ingestion command currently accepts text/Markdown/JSON, not binary PDF/Word files. Convert those with a reviewed extraction step before ingestion.
2. Assign a stable source key and project/story scope. Hash the full content with SHA-256. That hash is the source content version.
3. Use LangChain's recursive splitter with a maximum **1,600 characters** and **200-character overlap**. These are character limits, not token counts; sentence/paragraph separators can yield smaller chunks. Overlap retains nearby context but can introduce duplicate evidence. Acceptance criteria should remain understandable within individual chunks.
4. In live mode, call the configured embedding model for each chunk. Its numbers encode a learned representation; vector dimensionality is determined by that model. Use the same embedding provider/model/space for queries.
5. Upsert into Chroma: `id`, `embeddings`, `documents` and `metadatas`. Metadata includes `source`, `project`, `status`, full-content `hash`, chunk index and embedding model ID. The ID incorporates project/source hash, content-version hash and chunk index.
6. Delete stale chunk IDs belonging to that source/project after successful upsert. A shorter new source therefore does not leave obsolete chunks retrievable. Reingesting identical text is idempotent at the chunk-ID level, although this starter still calls the embedding model again.

Example stored row (the real embedding has many more numbers):

```json
{
  "id": "sourcekey:contentversion:0",
  "document": "Account Name is required. A blank submission displays...",
  "embedding": [0.014, -0.023, 0.006],
  "metadata": {
    "source": "knowledge/account-rules.md",
    "project": "SF-101",
    "status": "approved",
    "hash": "full SHA-256 source hash",
    "chunk": 0,
    "embedding": "text-embedding-3-small"
  }
}
```

The collection name hashes the embedding model ID and endpoint identity, separating live embeddings from demo lexical vectors. Rebuild the collection if the provider silently changes a model's embedding space. Do not mix models or dimensions. A production deployment should also record the exact model revision and retrieval configuration as part of a versioned manifest.

## Retrieval and answering

For “What should happen when Account Name is blank?”, embed the query with the same model. Query Chroma for the top five similar chunks **filtered to the requested project and `status: approved`**. Chroma returns matching IDs, text, source metadata and distances. A lower Chroma distance ranks nearer; the JSON demo's cosine score uses the opposite convention. Do not compare those numeric values as equivalent confidence scores.

The planner receives the story, retrieved text, UI observations and engineering memory. The `ask` command sends the retrieved passages to the LLM with instructions to answer only from the evidence, cite chunk IDs and acknowledge missing information. There is no “training the model on Chroma” step. Retrieval happens at question time.

```bash
npm run sfqa -- ingest knowledge/account-rules.md --project SF-101 --mode live --status approved
npm run sfqa -- ask "What happens when Account Name is blank?" --project SF-101 --mode live
npm run sfqa -- remove-source knowledge/account-rules.md --project SF-101 --mode live
```

Use the exact same source string when updating/removing it. Sources are logically scoped by story ID in this starter; tenant/org/persona access-control metadata is not implemented. Before shared multi-org deployment, extend the schema and every ingestion/retrieval filter with those boundaries. Chroma metadata filtering here is an application convention, not a substitute for database authentication/authorization.

`build` ingests the story, reviewed framework memory and Markdown files directly under `knowledge/` as approved input evidence for that story. Put only reviewed input documents in that directory. Generated plans are indexed as **draft**, and draft output is excluded from normal retrieval so a model's earlier proposal cannot silently become the oracle for its own later tests. Generated Markdown/OKF documents are written to disk; the current graph indexes the generated plan's JSON, test plan, cases, data prerequisites, traceability CSV and linked OKF plan as draft. Approving execution does not automatically promote those documents into approved RAG evidence. Explicitly review and ingest any reusable result.

## Persistence and version history

| Storage | Purpose | History |
|---|---|---|
| Git / source files | Reviewed stories, rules, OKF concepts, framework lessons | Authoritative reviewable history when committed |
| Chroma server `.state/chroma` or Cloud | Search index with text, vectors and metadata | Current source versions; old chunks removed |
| `artifacts/RUN_ID/retrieval.json` | Exact retrieved excerpts/hash references for that run | Runtime audit snapshot |
| `artifacts/RUN_ID/` | Plan, criteria mapping, events, results and proposals | Per-run evidence, ignored by Git |

Source versioning is a content hash plus replacement/deletion of stale chunks. It is **not a full temporal vector archive**. Use Git/document version storage for previous content. Run artifact retention is your responsibility. Snapshot/back up the persistent server directory using Chroma's supported operational process, or use a managed service; copying a live SQLite file casually is not a reliable backup strategy.

## Local Chroma versus demo index

`npm run chroma` runs the native Chroma server from the npm distribution with explicit `127.0.0.1` binding and persistence. The TypeScript client connects to it over HTTP; there is no embedded Python `PersistentClient` in this project. The explicit IPv4 host avoids a startup/connectivity issue found in this runtime with the default hostname.

`npm run demo` uses local JSON persistence and deterministic 512-dimensional lexical hash vectors. It checks orchestration and indexing without an embedding API. `npm run demo:chroma` uses those same demo vectors with an **actual Chroma server**, which must already be running. `npm run check:chroma` manages an isolated actual Chroma server, checks persistence through restart and runs all integration checks. Neither demo measures semantic retrieval quality.

Windows x64 is not supported by the native bindings in the pinned Chroma npm package. The TypeScript HTTP/Cloud client works without launching those bindings. For your Windows laptop use Chroma Cloud/remote persistent server, or a separately approved WSL host. No Docker is required.

## What Google OKF adds

[Google Cloud Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md) packages knowledge as a directory of Markdown concepts with YAML frontmatter and links. `type` is required; title, sources, generated/verified signals and lifecycle metadata help consumers understand provenance and trust. It is a **document format**, not an embedding model, vector database or agent orchestrator.

This framework writes `story.okf.md`, `test-cases.md` and `knowledge.okf.md` with required concept `type`, title, lifecycle status and story ID, plus links to related documents. Those fields satisfy the minimal concept shape. Source provenance/generation metadata is included where the generator has concrete evidence; a `verified` human identity must never be invented. These are simple concepts, not an implementation of OKF attested computations, catalog hosting, freshness enforcement or the entire Google Knowledge Catalog service.

OKF and RAG complement one another: OKF makes the knowledge files structured and portable; chunking/embeddings/Chroma make their contents searchable; retrieval feeds the relevant text to the planner or answering model.

## Evaluation and future improvements

DeepEval can judge whether the generated plan summary/titles are faithful/relevant to supplied story/context and whether the full plan's assertions address explicit criteria. These metrics do not prove application behavior. Playwright executes the actual assertions. The default demo reports judge evaluation as `not_run`; a native DeepEval deterministic metric regression tests SDK execution without claiming an LLM score.

A mature semantic RAG evaluation needs a human-reviewed dataset of questions, expected answers, expected source IDs and acceptable evidence; retrieval recall/precision at k; answer groundedness; conflicting/stale-document cases; and abstention tests. Those datasets/benchmarks are not yet provided. Other extension points are token-aware/section-aware chunking, batch-size limits/retries, embedding caches, hybrid keyword/vector search, reranking, access-control filters, atomic source promotion and freshness enforcement. The current starter uses straightforward vector retrieval without those features.

Concurrent ingestion of the same source should be serialized: this starter's upsert-then-delete sequence is not an atomic multi-version publication protocol. Empty-source ingestion removes old chunks. Store only documentation/test rules approved for your model provider; API requests transmit the selected content to that provider.

Official references: [Chroma clients](https://docs.trychroma.com/docs/run-chroma/clients), [LangChain text splitting](https://docs.langchain.com/oss/javascript/integrations/splitters/recursive_text_splitter), [DeepEval TypeScript](https://github.com/confident-ai/deepeval/tree/main/typescript).
