import { useEffect, useState, useRef, forwardRef } from 'react';

const MicrophoneInput = forwardRef(({ onAudioChunk, isRecording }, ref) => {
    const [permission, setPermission] = useState(false);
    const mediaRecorder = useRef(null);
    const audioContext = useRef(null);
    const audioStream = useRef(null);

    useEffect(() => {
        // Request microphone permission
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setPermission(true);
                audioStream.current = stream;
                audioContext.current = new AudioContext();
            })
            .catch(err => {
                console.error("Microphone permission denied:", err);
                setPermission(false);
            });

        return () => {
            if (audioStream.current) {
                audioStream.current.getTracks().forEach(track => track.stop());
            }
            if (audioContext.current) {
                audioContext.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (!permission || !audioStream.current) return;

        if (isRecording) {
            const source = audioContext.current.createMediaStreamSource(audioStream.current);
            const processor = audioContext.current.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert float32 to int16
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = inputData[i] * 32767;
                }
                onAudioChunk(pcmData);
            };

            source.connect(processor);
            processor.connect(audioContext.current.destination);

            mediaRecorder.current = { processor, source };
        } else if (mediaRecorder.current) {
            mediaRecorder.current.source.disconnect();
            mediaRecorder.current.processor.disconnect();
            mediaRecorder.current = null;
        }
    }, [isRecording, permission, onAudioChunk]);

    return (
        <div className="flex items-center justify-center p-4 border rounded-md">
            {!permission ? (
                <div className="text-red-500">Please allow microphone access</div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span>{isRecording ? 'Recording...' : 'Ready to record'}</span>
                </div>
            )}
        </div>
    );
});

export default MicrophoneInput; 