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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { LiveClientOptions } from "./types";
import {
  extractSymbolsFromVideo,
  type SymbolExtractionResult,
} from "./lib/symbol-extraction";
import { createLatexRecognizer } from "./lib/latex-recognizer";

type SymbolStatus = "pending" | "success" | "error";

type SymbolResult = {
  id: string;
  latex: string;
  status: SymbolStatus;
};

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const apiOptions: LiveClientOptions = {
  apiKey: API_KEY,
};

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [symbolResults, setSymbolResults] = useState<SymbolResult[]>([]);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [isExtractingSymbols, setIsExtractingSymbols] = useState(false);
  const extractionTaskRef = useRef(0);

  const recognizeLatex = useMemo(
    () =>
      createLatexRecognizer({
        apiKey: API_KEY,
        model: "gemini-2.5-flash",
        prompt:
          "Recognize the isolated mathematical symbol in this image and return only its LaTeX representation.",
      }),
    []
  );

  const clearSymbols = useCallback(() => {
    extractionTaskRef.current += 1;
    setIsExtractingSymbols(false);
    setSymbolResults([]);
    setSymbolError(null);
  }, []);

  const handleSymbolExtraction = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      setSymbolError("No active video element is available.");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setSymbolError("The video stream is still loading. Try again in a moment.");
      return;
    }

    const capture: SymbolExtractionResult = extractSymbolsFromVideo(video, {
      maxSymbols: 12,
      padding: 6,
    });

    if (!capture.symbolDataUrls.length) {
      setSymbolResults([]);
      setSymbolError("No symbols detected in the current frame.");
      return;
    }

    setSymbolError(null);
    setIsExtractingSymbols(true);
    const taskId = extractionTaskRef.current + 1;
    extractionTaskRef.current = taskId;

    const initialResults: SymbolResult[] = capture.symbolDataUrls.map((_, index) => ({
      id: `${taskId}-${index}`,
      latex: "",
      status: "pending",
    }));
    setSymbolResults(initialResults);

    let encounteredError = false;

    try {
      for (let index = 0; index < capture.symbolDataUrls.length; index += 1) {
        const dataUrl = capture.symbolDataUrls[index];
        if (!dataUrl) {
          encounteredError = true;
          setSymbolResults((prev) => {
            const next = [...prev];
            if (!next[index]) {
              return prev;
            }
            next[index] = { ...next[index], latex: "", status: "error" };
            return next;
          });
          continue;
        }

        try {
          const latex = await recognizeLatex(dataUrl);
          if (extractionTaskRef.current !== taskId) {
            return;
          }
          setSymbolResults((prev) => {
            const next = [...prev];
            if (!next[index]) {
              return prev;
            }
            const normalizedLatex = latex.trim();
            next[index] = {
              ...next[index],
              latex: normalizedLatex,
              status: normalizedLatex ? "success" : "error",
            };
            return next;
          });
          if (!latex.trim()) {
            encounteredError = true;
          }
        } catch (error) {
          console.error("Failed to transcribe symbol", error);
          encounteredError = true;
          if (extractionTaskRef.current !== taskId) {
            return;
          }
          setSymbolResults((prev) => {
            const next = [...prev];
            if (!next[index]) {
              return prev;
            }
            next[index] = { ...next[index], latex: "", status: "error" };
            return next;
          });
        }
      }

      if (extractionTaskRef.current !== taskId) {
        return;
      }

      if (encounteredError) {
        setSymbolError(
          "Some symbols could not be transcribed. Try capturing the frame again for a clearer result."
        );
      }
    } finally {
      if (extractionTaskRef.current === taskId) {
        setIsExtractingSymbols(false);
      }
    }
  }, [recognizeLatex]);

  useEffect(() => {
    clearSymbols();
  }, [videoStream, clearSymbols]);

  return (
    <div className="App">
      <LiveAPIProvider options={apiOptions}>
        <div className="streaming-console">
          <SidePanel />
          <main>
            <div className="main-app-area">
              {/* APP goes here */}
              <Altair />
              <div className="stream-wrapper">
                <video
                  className={cn("stream", {
                    hidden: !videoRef.current || !videoStream,
                  })}
                  ref={videoRef}
                  autoPlay
                  playsInline
                />
                <div className="symbol-results-panel">
                  <header className="symbol-results-header">Detected LaTeX Symbols</header>
                  {isExtractingSymbols && (
                    <p className="symbol-results-status">Segmenting frame and transcribing symbols…</p>
                  )}
                  {symbolError && <p className="symbol-results-error">{symbolError}</p>}
                  {symbolResults.length > 0 ? (
                    <ul className="symbol-results-list">
                      {symbolResults.map((result) => (
                        <li key={result.id} className={cn("symbol-results-item", result.status)}>
                          {result.status === "pending" && (
                            <span className="material-symbols-outlined">hourglass_empty</span>
                          )}
                          {result.status === "error" && (
                            <span className="material-symbols-outlined">error</span>
                          )}
                          {result.status === "success" && (
                            <span className="material-symbols-outlined">check_circle</span>
                          )}
                          <code>
                            {result.status === "pending"
                              ? "Processing…"
                              : result.latex || "No output"}
                          </code>
                        </li>
                      ))}
                    </ul>
                  ) : !isExtractingSymbols && !symbolError ? (
                    <p className="symbol-results-empty">
                      Capture the current frame to populate the list of detected symbols.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <ControlTray
              videoRef={videoRef}
              supportsVideo={true}
              onVideoStreamChange={setVideoStream}
              enableEditingSettings={true}
            >
              <button
                type="button"
                className={cn("action-button", {
                  disabled: !videoStream || isExtractingSymbols,
                })}
                onClick={handleSymbolExtraction}
                disabled={!videoStream || isExtractingSymbols}
                title="Capture the current frame and extract LaTeX symbols"
              >
                <span className="material-symbols-outlined">
                  {isExtractingSymbols ? "hourglass_top" : "screenshot_monitor"}
                </span>
              </button>
            </ControlTray>
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
