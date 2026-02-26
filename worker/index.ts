/**
 * Cloudflare Worker entry point
 */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: {
    fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream<Uint8Array>): {
      transform(options: { width?: number; height?: number; fit?: string }): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  CACHE_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Image optimization via Cloudflare Images binding
    if (url.pathname === "/_vinext/image") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response("Missing url parameter", { status: 400 });
      }

      // Fetch the source image from assets
      const source = await env.ASSETS.fetch(new Request(new URL(imageUrl, request.url)));
      if (!source.ok || !source.body) {
        return new Response("Image not found", { status: 404 });
      }

      // For now, just serve the original image without transformation
      const headers = new Headers(source.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Vary", "Accept");
      return new Response(source.body, { status: 200, headers });
    }

    // Delegate everything else to vinext
    return handler.fetch(request);
  },
};
