import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
export function model() {
  if (!process.env.OPENAI_API_KEY || !process.env.SFQA_MODEL)
    throw Error("Live mode requires OPENAI_API_KEY and SFQA_MODEL");
  return new ChatOpenAI({
    model: process.env.SFQA_MODEL,
    timeout: 90000,
    maxRetries: 1,
    configuration: process.env.SFQA_API_BASE
      ? { baseURL: process.env.SFQA_API_BASE }
      : undefined,
  });
}
export function embeddings() {
  return new OpenAIEmbeddings({
    model: process.env.SFQA_EMBED_MODEL || "text-embedding-3-small",
    configuration: process.env.SFQA_API_BASE
      ? { baseURL: process.env.SFQA_API_BASE }
      : undefined,
  });
}
