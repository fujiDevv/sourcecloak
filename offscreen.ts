// @ts-ignore - transformers v4 currently has broken type exports for pipeline
import { pipeline, env } from '@huggingface/transformers';
import { classifyWithRules, mergeClassificationResults } from './src/classifier';
import { classifyWithGeminiNano } from './src/ai';
import { isMarkdownDocumentation } from './src/markdown-doc';
import type { ClassificationResult, SourceCloakSettings } from './src/types';
import { extensionApi, getRuntimeUrl } from './src/platform';

const wasmConfig = (env as Record<string, unknown> & {
  backends?: { onnx?: { wasm?: { wasmPaths?: string; proxy?: boolean } } };
}).backends?.onnx?.wasm;

if (wasmConfig) {
  wasmConfig.wasmPaths = getRuntimeUrl('wasm/');
  wasmConfig.proxy = false;
}
env.allowLocalModels = false;

interface TextClassificationResult {
  label: string;
  score: number;
}

type ClassifierPipeline = (text: string) => Promise<TextClassificationResult[]>;

let classifier: ClassifierPipeline | null = null;
let classifierPromise: Promise<ClassifierPipeline> | null = null;
let modelLoadingState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
let modelDownloadProgress = 0;

function reportModelProgress(state: typeof modelLoadingState, progress: number): void {
  extensionApi.runtime.sendMessage({ type: 'update-model-progress', state, progress }).catch(() => {});
}

async function getClassifier(): Promise<ClassifierPipeline> {
  if (classifier) return classifier;
  if (classifierPromise) return classifierPromise;

  modelLoadingState = 'loading';
  modelDownloadProgress = 0;
  reportModelProgress(modelLoadingState, modelDownloadProgress);

  classifierPromise = (async () => {
    try {
      const pipelineInstance = await pipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        {
          progress_callback: (data: { status?: string; progress?: number }) => {
            if (data.status === 'progress' && typeof data.progress === 'number') {
              modelDownloadProgress = Math.round(data.progress);
              reportModelProgress('loading', modelDownloadProgress);
            } else if (data.status === 'ready') {
              modelDownloadProgress = 100;
              reportModelProgress('ready', 100);
            }
          }
        }
      );
      classifier = pipelineInstance as unknown as ClassifierPipeline;
      modelLoadingState = 'ready';
      reportModelProgress('ready', 100);
      return classifier;
    } catch (err) {
      modelLoadingState = 'error';
      reportModelProgress('error', 0);
      classifierPromise = null;
      throw err;
    }
  })();

  return classifierPromise;
}

async function runOnnxHeuristic(text: string, settings: SourceCloakSettings): Promise<ClassificationResult | null> {
  if (!settings.useOnnxClassifier || text.length < 24) return null;
  if (isMarkdownDocumentation(text)) return null;

  try {
    const pipelineInstance = await getClassifier();
    const sample = text.slice(0, 512);
    const results = await pipelineInstance(sample);
    const top = results?.[0];
    if (!top) return null;

    const codeDensity = (sample.match(/[{}();=<>]/g) ?? []).length / sample.length;
    const looksSensitive = codeDensity > 0.03 && sample.length > 80;

    if (!looksSensitive) return null;

    return {
      blocked: top.score > 0.82,
      score: top.score * 0.35,
      matches: [{
        category: 'proprietary_code',
        label: 'ONNX Structural Heuristic',
        confidence: Math.min(top.score, 0.75),
        tier: 'onnx'
      }],
      processingMs: 0
    };
  } catch {
    return null;
  }
}

async function runFullClassification(text: string, settings: SourceCloakSettings): Promise<ClassificationResult> {
  const started = performance.now();
  let result = classifyWithRules(text, settings);

  const onnxResult = await runOnnxHeuristic(text, settings);
  if (onnxResult) {
    result = mergeClassificationResults(result, onnxResult);
  }

  if (settings.useGeminiNano && text.length >= 48 && (result.score >= 0.45 || result.matches.length > 0)) {
    const gemini = await classifyWithGeminiNano(text);
    if (!gemini) {
      extensionApi.runtime.sendMessage({ type: 'log-gemini-fallback' }).catch(() => {});
    }
    if (gemini) {
      const threshold = 0.9 - (settings.sensitivity / 100) * 0.45;
      const geminiResult: ClassificationResult = {
        blocked: gemini.blocked && gemini.confidence >= threshold,
        score: gemini.confidence,
        matches: gemini.blocked ? [{
          category: 'proprietary_code',
          label: gemini.reason || 'Gemini Nano Semantic Block',
          confidence: gemini.confidence,
          tier: 'gemini'
        }] : [],
        processingMs: 0
      };
      result = mergeClassificationResults(result, geminiResult);
    }
  }

  result.processingMs = performance.now() - started;
  return result;
}

extensionApi.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
  if (message.type === 'run-offscreen-classification') {
    const { text, settings } = message as { text: string; settings: SourceCloakSettings };

    if (settings.useOnnxClassifier && modelLoadingState === 'idle') {
      getClassifier().catch(() => {});
    }

    runFullClassification(text, settings)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'check-offscreen-model-status') {
    if (modelLoadingState === 'idle') {
      getClassifier().catch(() => {});
    }
    sendResponse({ success: true, state: modelLoadingState, progress: modelDownloadProgress });
    return false;
  }
});