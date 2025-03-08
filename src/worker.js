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
        if (!this.asr_instance) {
            this.asr_instance = await createPipeline('automatic-speech-recognition', this.asr_model_id, {
                ...PER_DEVICE_CONFIG[device],
                progress_callback,
                chunk_length_s: 30,
                stride_length_s: 5,
                quantized: true, // Use quantized model to reduce memory
            });
        }

        if (!this.segmentation_processor) {
            this.segmentation_processor = await AutoProcessor.from_pretrained(this.segmentation_model_id, {
                progress_callback,
            });
        }

        if (!this.segmentation_instance) {
            this.segmentation_instance = await AutoModelForAudioFrameClassification.from_pretrained(
                this.segmentation_model_id,
                {
                    device: 'wasm',
                    dtype: 'fp32',
                    progress_callback,
                    quantized: true, // Use quantized model to reduce memory
                }
            );
        }

        return [this.asr_instance, this.segmentation_processor, this.segmentation_instance];
    }

    static cleanup() {
        if (this.asr_instance) {
            this.asr_instance.dispose?.();
            this.asr_instance = null;
        }
        if (this.segmentation_instance) {
            this.segmentation_instance.dispose?.();
            this.segmentation_instance = null;
        }
        if (this.segmentation_processor) {
            this.segmentation_processor = null;
        }
    }
}

let transcriber = null;
let segmentation_processor = null;
let segmentation_model = null;
let audioBuffer = [];
const CHUNK_SIZE = 4096 * 8; // Process 2 seconds of audio at once
const MAX_BUFFER_SIZE = CHUNK_SIZE * 2; // Keep max 4 seconds worth of data
let lastKnownSpeaker = null;

async function load({ device }) {
    // Cleanup any existing instances
    PipelineSingleton.cleanup();
    
    self.postMessage({
        status: 'loading',
        data: `Loading models (${device})...`
    });

    const [asr, seg_processor, seg_model] = await PipelineSingleton.getInstance(x => {
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

        // Smaller warmup size
        await transcriber(new Float32Array(8_000), {
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

        // Check audio levels
        const maxLevel = Math.max(...Array.from(floatData).map(Math.abs));
        if (maxLevel < 0.01) {
            return { transcript: '', segments: [] };
        }

        // Run transcription and segmentation in parallel
        const [transcription, segments] = await Promise.all([
            transcriber(floatData, {
                language,
                return_timestamps: 'word',
                chunk_length_s: 2,
                stride_length_s: 0.5,
            }).catch(e => {
                console.error('❌ Transcription error:', e);
                return { text: '', chunks: [] };
            }),
            segment(segmentation_processor, segmentation_model, floatData).catch(e => {
                console.error('❌ Segmentation error:', e);
                return [];
            })
        ]);

        // Clean up the float data
        floatData.fill(0);

        // First, merge speaker segments that are close together
        const mergedSpeakerSegments = [];
        let currentSegment = null;

        for (const seg of segments) {
            if (!currentSegment) {
                currentSegment = { ...seg };
                continue;
            }

            // If same speaker and gap is less than 1 second, merge segments
            if (seg.label === currentSegment.label && 
                (seg.start - currentSegment.end) < 1.0) {
                currentSegment.end = seg.end;
            } else {
                mergedSpeakerSegments.push(currentSegment);
                currentSegment = { ...seg };
            }
        }
        if (currentSegment) {
            mergedSpeakerSegments.push(currentSegment);
        }

        // Now assign transcribed text to speaker segments
        const processedSegments = [];
        if (transcription.text) {
            let speakerToUse = 'NO_SPEAKER';
            
            if (mergedSpeakerSegments.length > 0) {
                // Calculate speaker durations and confidence
                const speakerDurations = {};
                mergedSpeakerSegments.forEach(seg => {
                    const duration = seg.end - seg.start;
                    speakerDurations[seg.label] = (speakerDurations[seg.label] || 0) + duration;
                });

                // Find the dominant speaker
                const [dominantSpeaker, duration] = Object.entries(speakerDurations)
                    .reduce((a, b) => a[1] > b[1] ? a : b);

                // If the dominant speaker has significant duration, use it
                if (duration > 0.5) { // More than 0.5 seconds of speech
                    speakerToUse = dominantSpeaker;
                    lastKnownSpeaker = dominantSpeaker;
                } else if (lastKnownSpeaker && transcription.text.trim() && 
                         !transcription.text.includes('[BLANK_AUDIO]')) {
                    // Use last known speaker if we have actual speech
                    speakerToUse = lastKnownSpeaker;
                }
            } else if (lastKnownSpeaker && transcription.text.trim() && 
                      !transcription.text.includes('[BLANK_AUDIO]')) {
                // Use last known speaker if we have actual speech
                speakerToUse = lastKnownSpeaker;
            }

            // Create a segment with the full transcription
            processedSegments.push({
                start: 0,
                end: chunk.length / 16000,
                label: speakerToUse,
                text: transcription.text
            });
        }

        const result = {
            transcript: transcription.text || '',
            segments: processedSegments
        };

        if (result.transcript) {
            self.postMessage({
                type: 'chunk_complete',
                result: {
                    transcript: result.transcript,
                    segments: result.segments || []
                }
            });
        }

        return result;
    } catch (error) {
        console.error('❌ Error processing audio chunk:', error);
        return { transcript: '', segments: [] };
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
                audioBuffer = audioBuffer.concat(Array.from(data.chunk));
                
                // Process when we have enough data
                if (audioBuffer.length >= CHUNK_SIZE) {
                    const audioToProcess = new Int16Array(audioBuffer.slice(0, CHUNK_SIZE));
                    audioBuffer = audioBuffer.slice(CHUNK_SIZE);
                    await processAudioChunk(audioToProcess, data.language);
                    audioToProcess.fill(0);
                }
                
                // Limit buffer size
                if (audioBuffer.length > MAX_BUFFER_SIZE) {
                    audioBuffer = audioBuffer.slice(-MAX_BUFFER_SIZE);
                }
                break;

            case 'run':
                await run(data);
                break;

            case 'cleanup':
                PipelineSingleton.cleanup();
                audioBuffer = [];
                lastKnownSpeaker = null;
                break;

            default:
                console.warn('⚠️ Unknown message type:', type);
        }
    } catch (error) {
        console.error('❌ Worker error:', error);
        self.postMessage({ 
            status: 'error', 
            error: error.message 
        });
    }
});
