import { useEffect, useState, useRef, forwardRef } from 'react';

const MicrophoneInput = forwardRef(({ onAudioChunk, isRecording }, ref) => {
    const [permission, setPermission] = useState(false);
    const [volume, setVolume] = useState(0);
    const mediaRecorder = useRef(null);
    const audioContext = useRef(null);
    const audioStream = useRef(null);
    const chunkCounter = useRef(0);
    const animationFrame = useRef(null);
    const audioBuffer = useRef([]);

    useEffect(() => {
        console.log('🎤 Requesting microphone permission...');
        navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 16000
            } 
        })
        .then(stream => {
            console.log('✅ Microphone permission granted');
            setPermission(true);
            audioStream.current = stream;
            audioContext.current = new AudioContext({
                sampleRate: 16000,
                channelCount: 1,
                latencyHint: 'interactive'
            });
            console.log('🔊 Audio context sample rate:', audioContext.current.sampleRate);
        })
        .catch(err => {
            console.error("❌ Microphone permission denied:", err);
            setPermission(false);
        });

        return () => {
            if (audioStream.current) {
                console.log('🎤 Stopping audio stream');
                audioStream.current.getTracks().forEach(track => track.stop());
            }
            if (audioContext.current) {
                console.log('🔊 Closing audio context');
                audioContext.current.close();
            }
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!permission || !audioStream.current) return;

        if (isRecording) {
            console.log('🎙️ Starting audio processing');
            const source = audioContext.current.createMediaStreamSource(audioStream.current);
            const processor = audioContext.current.createScriptProcessor(4096, 1, 1);
            const analyser = audioContext.current.createAnalyser();
            analyser.fftSize = 1024;
            
            source.connect(analyser);
            source.connect(processor);
            processor.connect(audioContext.current.destination);

            const updateVolume = () => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setVolume(average);
                animationFrame.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert float32 to int16
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = inputData[i] * 32767;
                }
                
                // Accumulate audio data
                audioBuffer.current = audioBuffer.current.concat(Array.from(pcmData));
                
                // Send larger chunks less frequently
                if (audioBuffer.current.length >= 4096 * 8) { // 2 seconds of audio
                    const chunk = new Int16Array(audioBuffer.current);
                    audioBuffer.current = [];
                    
                    chunkCounter.current++;
                    // console.log(`🎙️ Sending ${(chunk.length / 16000).toFixed(2)}s of audio`);
                    
                    // Log audio levels
                    const maxLevel = Math.max(...Array.from(chunk).map(Math.abs));
                    // console.log(`📊 Microphone level: ${maxLevel}`);
                    
                    onAudioChunk(chunk);
                }
            };

            mediaRecorder.current = { processor, source, analyser };
            // console.log('✅ Audio processing pipeline setup complete');
        } else if (mediaRecorder.current) {
            console.log('⏹️ Stopping audio processing');
            mediaRecorder.current.source.disconnect();
            mediaRecorder.current.processor.disconnect();
            mediaRecorder.current = null;
            chunkCounter.current = 0;
            audioBuffer.current = [];
            setVolume(0);
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        }
    }, [isRecording, permission, onAudioChunk]);

    return (
        <div className="flex items-center justify-center p-4 border rounded-md">
            {!permission ? (
                <div className="text-red-500">Please allow microphone access</div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                        {isRecording && (
                            <div 
                                className="absolute top-0 left-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75"
                                style={{ transform: `scale(${1 + volume/100})` }}
                            />
                        )}
                    </div>
                    <span>{isRecording ? 'Recording...' : 'Ready to record'}</span>
                    {isRecording && (
                        <div className="ml-2 text-xs text-gray-500">
                            Volume: {Math.round(volume)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default MicrophoneInput; 