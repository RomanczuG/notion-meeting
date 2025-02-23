import { pipeline as createPipeline, AutoProcessor, AutoModelForAudioFrameClassification } from '@huggingface/transformers';

const PER_DEVICE_CONFIG = {
    webgpu: {
        dtype: {
            encoder_model: 'fp32',
            decoder_model_merged: 'q4',
        },
        device: 'webgpu',
    },
    wasm: {
        dtype: 'q8',
        device: 'wasm',
    },
};

/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class PipelineSingleton {
    static asr_model_id = 'onnx-community/whisper-base_timestamped';
    static asr_instance = null;

    static segmentation_model_id = 'onnx-community/pyannote-segmentation-3.0';
    static segmentation_instance = null;
    static segmentation_processor = null;

    static async getInstance(progress_callback = null, device = 'webgpu') {
        this.asr_instance ??= createPipeline('automatic-speech-recognition', this.asr_model_id, {
            ...PER_DEVICE_CONFIG[device],
            progress_callback,
            chunk_length_s: 30,
            stride_length_s: 5,
        });

        this.segmentation_processor ??= AutoProcessor.from_pretrained(this.segmentation_model_id, {
            progress_callback,
        });
        this.segmentation_instance ??= AutoModelForAudioFrameClassification.from_pretrained(this.segmentation_model_id, {
            // NOTE: WebGPU is not currently supported for this model
            // See https://github.com/microsoft/onnxruntime/issues/21386
            device: 'wasm',
            dtype: 'fp32',
            progress_callback,
        });

        return Promise.all([this.asr_instance, this.segmentation_processor, this.segmentation_instance]);
    }
}

let transcriber = null;
let segmentation_processor = null;
let segmentation_model = null;
let audioBuffer = [];
const CHUNK_SIZE = 16000; // Process 1 second of audio at 16kHz

async function load({ device }) {
    self.postMessage({
        status: 'loading',
        data: `Loading models (${device})...`
    });

    // Load the pipeline and save it for future use.
    const [asr, seg_processor, seg_model] = await PipelineSingleton.getInstance(x => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage(x);
    }, device);

    transcriber = asr;
    segmentation_processor = seg_processor;
    segmentation_model = seg_model;

    if (device === 'webgpu') {
        self.postMessage({
            status: 'loading',
            data: 'Compiling shaders and warming up model...'
        });

        await transcriber(new Float32Array(16_000), {
            language: 'en',
            return_timestamps: 'word',
        });
    }

    self.postMessage({ status: 'loaded' });
}

async function segment(processor, model, audio) {
    const inputs = await processor(audio);
    const { logits } = await model(inputs);
    const segments = processor.post_process_speaker_diarization(logits, audio.length)[0];

    // Attach labels
    for (const segment of segments) {
        segment.label = model.config.id2label[segment.id];
    }

    return segments;
}

async function processAudioChunk(chunk, language) {
    try {
        // Convert Int16Array to Float32Array for processing
        const floatData = new Float32Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
            floatData[i] = chunk[i] / 32767.0;
        }

        // Run transcription and segmentation in parallel
        const [transcription, segments] = await Promise.all([
            transcriber(floatData, {
                language,
                return_timestamps: 'word',
                chunk_length_s: 1,
                stride_length_s: 0.5,
            }),
            segment(segmentation_processor, segmentation_model, floatData)
        ]);

        return {
            text: transcription.text,
            chunks: segments.map(seg => ({
                ...seg,
                text: transcription.chunks.find(c => 
                    c.timestamp[0] >= seg.start && c.timestamp[1] <= seg.end
                )?.text || ''
            }))
        };
    } catch (error) {
        console.error('Error processing audio chunk:', error);
        throw error;
    }
}

async function run({ audio, language }) {
    const start = performance.now();

    // Run transcription and segmentation in parallel
    const [transcript, segments] = await Promise.all([
        transcriber(audio, {
            language,
            return_timestamps: 'word',
            chunk_length_s: 30,
        }),
        segment(segmentation_processor, segmentation_model, audio)
    ]);

    const end = performance.now();
    self.postMessage({ 
        status: 'complete', 
        result: { 
            transcript: transcript.text, 
            segments: segments.map(seg => ({
                ...seg,
                text: transcript.chunks.find(c => 
                    c.timestamp[0] >= seg.start && c.timestamp[1] <= seg.end
                )?.text || ''
            }))
        }, 
        time: end - start 
    });
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'load':
                await load(data);
                break;

            case 'audioChunk':
                // Handle incoming audio chunk
                audioBuffer = audioBuffer.concat(Array.from(data.chunk));
                
                // Process when we have enough data
                if (audioBuffer.length >= CHUNK_SIZE) {
                    const audioToProcess = new Int16Array(audioBuffer.slice(0, CHUNK_SIZE));
                    audioBuffer = audioBuffer.slice(CHUNK_SIZE);
                    
                    const result = await processAudioChunk(audioToProcess, data.language);
                    self.postMessage({
                        status: 'chunk_complete',
                        result
                    });
                }
                break;

            case 'run':
                await run(data);
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({ 
            status: 'error', 
            error: error.message 
        });
    }
});
