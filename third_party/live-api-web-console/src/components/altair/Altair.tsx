/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

type VegaEmbed = (
  element: HTMLElement,
  spec: unknown,
  options?: unknown
) => Promise<unknown>;

declare global {
  interface Window {
    vegaEmbed?: VegaEmbed;
  }
}

const VEGA_EMBED_SRC =
  "https://cdn.jsdelivr.net/npm/vega-embed@6/build/vega-embed.min.js";

let vegaEmbedLoader: Promise<VegaEmbed | null> | null = null;

const loadVegaEmbed = async (): Promise<VegaEmbed | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.vegaEmbed) {
    return window.vegaEmbed;
  }

  if (!vegaEmbedLoader) {
    vegaEmbedLoader = new Promise<VegaEmbed | null>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        "script[data-vega-embed]"
      );

      if (existingScript && window.vegaEmbed) {
        resolve(window.vegaEmbed);
        return;
      }

      const script = existingScript ?? document.createElement("script");
      script.src = VEGA_EMBED_SRC;
      script.async = true;
      script.dataset.vegaEmbed = "true";
      script.onload = () => {
        resolve(window.vegaEmbed ?? null);
      };
      script.onerror = () => {
        reject(new Error("Failed to load vega-embed script"));
      };

      if (!existingScript) {
        document.head.appendChild(script);
      }
    }).catch((error) => {
      console.error(error);
      vegaEmbedLoader = null;
      return null;
    });
  }

  return vegaEmbedLoader;
};

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      json_graph: {
        type: Type.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    setModel("models/gemini-2.0-flash-exp");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      systemInstruction: {
        parts: [
          {
            text: 'You are my helpful assistant. Any time I ask you for a graph call the "render_altair" function I have provided you. Dont ask for additional information just make your best judgement.',
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
                name: fc.name,
              })),
            }),
          200
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = embedRef.current;

    if (!element) {
      return;
    }

    element.innerHTML = "";

    if (!jsonString) {
      setError(null);
      return;
    }

    let cancelled = false;

    setError(null);

    loadVegaEmbed()
      .then((embed) => {
        if (!embed || cancelled) {
          if (!cancelled) {
            setError("Altair rendering is unavailable.");
          }
          return;
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(jsonString);
        } catch (parseError) {
          console.error(parseError);
          if (!cancelled) {
            setError("Unable to parse Altair chart specification.");
          }
          return;
        }

        embed(element, parsed).catch((embedError) => {
          console.error(embedError);
          if (!cancelled) {
            setError("Unable to render Altair chart.");
          }
        });
      })
      .catch((loaderError) => {
        console.error(loaderError);
        if (!cancelled) {
          setError("Unable to load chart renderer.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jsonString]);

  return (
    <div className="vega-embed" aria-live="polite">
      {error ? <p>{error}</p> : null}
      <div ref={embedRef} />
    </div>
  );
}

export const Altair = memo(AltairComponent);
