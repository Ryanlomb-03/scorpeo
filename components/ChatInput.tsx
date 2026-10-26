"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const documentFormats = [
  "txt", "log", "text", "csv", "tsv", "doc", "docx", "rtf", "odt", "wpd", "pages", "abw",
  "pdf", "xps", "epub", "mobi", "azw", "djvu", "html", "xhtml", "xml", "md", "tex", "adoc", "rst",
  "xls", "xlsx", "ods", "ppt", "pptx", "odp", "key", "json", "yaml", "yml", "toml", "ini",
  "azw3", "fb2", "zip", "rar", "7z", "tar", "gz", "odg", "vsdx", "pub"
];

const vectorFormats = [
  "svg", "svgz", "eps", "ai", "pdf", "cdr", "wmf", "emf", "dxf", "cgm", "odg", "vsdx"
];

const imageFormats = [
  "ico", "icns", "png", "jpg", "jpeg", "webp", "bmp", "cur", "ani", "gif", "apng", "tif", "tiff", "heif", "heic", "avif", "jxl", "psd", "xcf"
];

export default function ChatInput({ 
  onSend, 
  isAIThinking,
  position = "bottom"
}: { 
  onSend?: (message: string) => void; 
  isAIThinking?: boolean;
  position?: "bottom" | "center";
}) {
  const [input, setInput] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(false);
  const [isScrolledBottom, setIsScrolledBottom] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing' | 'review'>('idle');
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string;
    file: File;
    isLoading: boolean;
    lines: number;
    extension: string;
    isDoc: boolean;
    isVector: boolean;
    content?: string;
  }>>([]);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    file: File;
    isLoading: boolean;
    lines: number;
    extension: string;
    isDoc: boolean;
    isVector: boolean;
    content?: string;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceActionRef = useRef<'send' | 'stop' | null>(null);
  const browserRecognitionRef = useRef<any>(null);
  const browserTranscriptRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDetectedRef = useRef<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup voice resources on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const transcribeWithWhisper = async (audioBlob: Blob): Promise<string> => {
    console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
    
    // Convert webm to wav for better compatibility
    let audioToSend = audioBlob;
    if (audioBlob.type === 'audio/webm' || audioBlob.type === 'audio/webm;codecs=opus') {
      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Convert to WAV
        const wavBlob = await audioBufferToWav(audioBuffer);
        audioToSend = wavBlob;
        console.log('Converted to WAV, size:', wavBlob.size);
      } catch (e) {
        console.warn('Failed to convert audio, sending original:', e);
      }
    }
    
    const formData = new FormData();
    formData.append('file', audioToSend, 'audio.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('prompt', 'Transcribe all spoken words and sound expressions accurately. Keep every spoken word (e.g., "Hey") and format vocalizations in brackets, like: "Hey [COUGHING]" or "[LAUGHTER]".');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API error:', errorData);
      throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Transcription result:', data);
    return data.text;
  };

  const transcribeWithBrowserFallback = async (): Promise<string> => {
    // Return the transcript collected during recording
    const transcript = browserTranscriptRef.current;
    console.log('Browser fallback transcript:', transcript);
    return transcript;
  };

  const audioBufferToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numberOfChannels);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numberOfChannels); // avg. bytes/sec
    setUint16(numberOfChannels * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < audioBuffer.length) {
      for (let i = 0; i < numberOfChannels; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Initialize MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      browserTranscriptRef.current = '';
      audioDetectedRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', audioChunksRef.current.length);
        // Audio will be processed in stopRecording
      };

      // Set up audio level detection
      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkAudioLevel = () => {
          if (voiceState !== 'recording') return;
          
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          
          // If audio level exceeds threshold, mark as detected
          if (average > 10) {
            audioDetectedRef.current = true;
          }
          
          requestAnimationFrame(checkAudioLevel);
        };
        
        checkAudioLevel();
      } catch (e) {
        console.warn('Audio level detection not available:', e);
      }

      // Also start browser speech recognition as fallback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            }
          }
          if (finalTranscript) {
            // Preserve the transcript as-is, don't modify sound tags
            browserTranscriptRef.current = finalTranscript;
            audioDetectedRef.current = true;
          }
        };
        
        recognition.onerror = (event: any) => {
          console.warn('Browser recognition error:', event.error);
        };
        
        recognition.onend = () => {
          if (voiceState === 'recording') {
            recognition.start();
          }
        };
        
        browserRecognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorder.start(100); // Collect data every 100ms
      setVoiceState('recording');
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = async (autoSend = false) => {
    voiceActionRef.current = autoSend ? 'send' : 'stop';
    
    // Stop browser recognition
    if (browserRecognitionRef.current) {
      browserRecognitionRef.current.stop();
      browserRecognitionRef.current = null;
    }
    
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          console.log('MediaRecorder onstop triggered');
          processRecording();
          resolve();
        };
        mediaRecorderRef.current.stop();
      } else {
        processRecording();
        resolve();
      }
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    });
  };

  const processRecording = async () => {
    setVoiceState('processing');
    
    // Wait a small delay to ensure all chunks are collected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create audio blob from chunks
    console.log('Creating blob from chunks:', audioChunksRef.current.length);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    
    console.log('Audio blob created:', audioBlob.size, 'bytes');
    console.log('Audio detected:', audioDetectedRef.current);
    
    // Check if audio blob has data
    if (audioBlob.size < 100) {
      console.error('Audio blob too small, no audio recorded');
      setVoiceState('idle');
      voiceActionRef.current = null;
      alert('No audio was recorded. Please try again.');
      return;
    }
    
    // If no audio was detected, skip Groq API and use browser fallback or show error
    if (!audioDetectedRef.current) {
      console.warn('No audio detected during recording, skipping Groq API');
      
      // Try browser fallback if available
      const browserTranscript = browserTranscriptRef.current;
      if (browserTranscript && browserTranscript.trim().length > 0) {
        console.log('Using browser fallback transcript');
        const cleaned = cleanTranscription(browserTranscript);
        handleTranscriptionResult(cleaned);
      } else {
        setVoiceState('idle');
        voiceActionRef.current = null;
        alert('No sound was detected. Please try again.');
      }
      return;
    }
    
    let transcribedText = '';
    
    try {
      // Try Whisper API first
      transcribedText = await transcribeWithWhisper(audioBlob);
    } catch (error) {
      console.warn('Whisper API failed, falling back to browser recognition:', error);
      // Fall back to browser speech recognition
      transcribedText = await transcribeWithBrowserFallback();
    }
    
    const cleaned = cleanTranscription(transcribedText);
    handleTranscriptionResult(cleaned);
  };

  const handleTranscriptionResult = (cleaned: string) => {
    // Check if transcription is empty or failed
    if (!cleaned || cleaned.trim().length === 0) {
      console.error('Transcription returned empty text');
      setVoiceState('idle');
      voiceActionRef.current = null;
      alert('Transcription returned no text. Please try again.');
      return;
    }
    
    const action = voiceActionRef.current;
    voiceActionRef.current = null;
    
    if (action === 'send') {
      // Auto-send the transcribed text
      setInput(cleaned);
      setVoiceState('idle');
      // Directly call onSend without waiting for state re-render
      if (onSend) {
        onSend(cleaned);
      }
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } else {
      // Stop button - populate text for review
      setInput(cleaned);
      setVoiceState('review');
    }
  };

  const cancelRecording = () => {
    if (browserRecognitionRef.current) {
      browserRecognitionRef.current.stop();
      browserRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioChunksRef.current = [];
    browserTranscriptRef.current = '';
    audioDetectedRef.current = false;
    setVoiceState('idle');
  };

  const cleanTranscription = (text: string): string => {
    // Only trim whitespace, preserve all content including brackets
    let cleaned = text.trim();
    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned;
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      if (onSend) {
        onSend(input);
      }
      setInput("");
      setVoiceState('idle');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newAttachedFiles = filesArray.map(file => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isVector = vectorFormats.includes(extension);
        const isDoc = documentFormats.includes(extension) || isVector;
        
        return {
          id: Math.random().toString(36).substring(7),
          file,
          isLoading: true,
          lines: 0,
          extension: extension.toUpperCase(),
          isDoc,
          isVector
        };
      });

      setAttachedFiles(prev => [...prev, ...newAttachedFiles]);

      // Simulate loading and count lines
      newAttachedFiles.forEach(fileObj => {
        if (fileObj.isVector) {
          setTimeout(() => {
            setAttachedFiles(prev => prev.map(f => 
              f.id === fileObj.id ? { ...f, isLoading: false } : f
            ));
          }, 1500);
        } else if (fileObj.isDoc) {
          let lines = 1;
          if (fileObj.file.size > 5 * 1024 * 1024) {
            // Estimate for large files (assume ~50 chars per line)
            lines = Math.max(1, Math.floor(fileObj.file.size / 50));
            setTimeout(() => {
              setAttachedFiles(prev => prev.map(f => 
                f.id === fileObj.id ? { ...f, isLoading: false, lines, content: "File is too large to preview." } : f
              ));
            }, 1500);
          } else {
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target?.result as string;
              lines = text ? text.split('\n').length : 1;
              
              setTimeout(() => {
                setAttachedFiles(prev => prev.map(f => 
                  f.id === fileObj.id ? { ...f, isLoading: false, lines, content: text } : f
                ));
              }, 1500); // 1.5s loading skeleton
            };
            reader.readAsText(fileObj.file);
          }
        } else {
            setTimeout(() => {
              setAttachedFiles(prev => prev.map(f => 
                f.id === fileObj.id ? { ...f, isLoading: false } : f
              ));
            }, 1000);
        }
      });
      
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="px-2 sm:px-4 py-2 relative w-full">
      {/* AI Thinking Dots — floats above the input pill */}
      <AnimatePresence>
        {isAIThinking && (
          <motion.div
            key="thinking-dots"
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.85 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-30 pointer-events-none"
          >
            <div
              style={{
                background: "rgba(24, 24, 26, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
                width: "42px",
                height: "28px",
                borderRadius: "14px",
              }}
              className="flex items-center justify-center gap-[4px]"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block w-[4px] h-[4px] rounded-full"
                  style={{ background: "rgba(215, 215, 220, 0.8)" }}
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.form 
        layout
        onSubmit={handleSubmit} 
        className="max-w-3xl mx-auto w-full"
      >
        <div className="bg-[#1e1e1e] rounded-full w-full px-5 py-1.5 border border-neutral-800/50 flex items-center gap-2">
          
          {/* File Previews */}
          {attachedFiles.length > 0 && (
            <motion.div layout className="absolute -top-32 left-0 right-0 flex flex-wrap gap-3 mb-3 z-10">
              {attachedFiles.map((file) => (
                <div key={file.id} className="relative group">
                  {file.isDoc ? (
                    <button 
                      type="button"
                      onClick={() => !file.isLoading && setPreviewFile(file)}
                      className="w-28 h-28 bg-[#1a1a1a] rounded-xl border border-neutral-700/50 p-3 flex flex-col relative shadow-sm overflow-visible text-left hover:bg-[#252525] transition-colors focus:outline-none"
                    >
                      {file.isLoading ? (
                        <>
                          <div className="w-full h-3 bg-neutral-700 rounded-full mb-2 animate-pulse" />
                          <div className="w-2/3 h-3 bg-neutral-700 rounded-full animate-pulse" />
                          <div className="absolute bottom-3 left-3 w-8 h-5 bg-neutral-700 rounded animate-pulse" />
                        </>
                      ) : (
                        <>
                          <div className="text-gray-200 text-[11px] font-medium leading-tight line-clamp-3 break-all">{file.file.name}</div>
                          {!file.isVector && (
                            <div className="text-gray-500 text-[10px] mt-1">{file.lines === 1 ? '1 line' : `${file.lines} lines`}</div>
                          )}
                          <div className="absolute bottom-3 left-3 px-1.5 py-0.5 border border-neutral-600 rounded text-[10px] font-bold text-gray-300 bg-neutral-800 shadow-sm uppercase">
                            {file.extension}
                          </div>
                        </>
                      )}
                      
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-neutral-600 border-2 border-[#1a1a1a] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-neutral-500 z-10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </div>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => !file.isLoading && setPreviewFile(file)}
                      className="w-28 h-28 bg-[#1a1a1a] rounded-xl border border-neutral-700/50 flex items-center justify-center relative overflow-visible focus:outline-none"
                    >
                       {file.isLoading ? (
                         <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                       ) : file.file.type.startsWith('image/') || imageFormats.includes(file.extension.toLowerCase()) ? (
                         <img src={URL.createObjectURL(file.file)} alt={file.file.name} className="w-full h-full object-cover rounded-xl" />
                       ) : (
                         <div className="text-white text-xs p-2 text-center break-all">{file.file.name}</div>
                       )}
                       <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-neutral-600 border-2 border-[#1a1a1a] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-neutral-500 z-10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowPopup(!showPopup)}
              className="text-white hover:text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            
            {showPopup && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#252525] border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setShowPopup(false); }}
                  className="w-full px-4 py-3 text-left text-gray-200 hover:bg-neutral-700/50 flex items-center gap-3 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <span>Add photos & files</span>
                </button>
                <div className="border-t border-neutral-700" />
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-3 text-left text-gray-500 flex items-center gap-3 cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Create image</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-3 text-left text-gray-500 flex items-center gap-3 cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>
                  <span>Thinking</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-3 text-left text-gray-500 flex items-center gap-3 cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/></svg>
                  <span>Deep research</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsWebSearch(true); textareaRef.current?.focus(); setShowPopup(false); }}
                  className="w-full px-4 py-3 text-left text-gray-200 hover:bg-neutral-700/50 flex items-center gap-3 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                  <span>Web search</span>
                </button>
              </div>
            )}
          </div>

          {voiceState === 'recording' ? (
            <div className="flex-1 flex items-center justify-center gap-0.5 h-8">
              {[...Array(28)].map((_, i) => (
                <div
                  key={i}
                  className="w-[2.5px] bg-white rounded-full"
                  style={{
                    animation: `wavePulse ${1.2 + (i % 3) * 0.2}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              placeholder={isWebSearch ? "Search the web" : "Ask Scorpeo"}
              className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-gray-500 resize-none min-h-[24px] max-h-[200px]"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (voiceState === 'review') {
                  setVoiceState('idle');
                }
              }}
              rows={1}
              onScroll={(e) => {
                const target = e.currentTarget;
                setIsScrolledTop(target.scrollTop > 0);
                setIsScrolledBottom(Math.ceil(target.scrollTop + target.clientHeight) < target.scrollHeight - 1);
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                setIsScrolledTop(target.scrollTop > 0);
                setIsScrolledBottom(Math.ceil(target.scrollTop + target.clientHeight) < target.scrollHeight - 1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          )}

          <div className="flex items-center gap-2">
            <AnimatePresence>
              {isWebSearch && voiceState !== 'recording' && voiceState !== 'processing' && (
                <motion.button 
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -10 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => setIsWebSearch(false)}
                  className="group/tag flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors"
                >
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <svg className="w-4 h-4 absolute inset-0 transition-opacity group-hover/tag:opacity-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                    <svg className="w-4 h-4 absolute inset-0 transition-opacity opacity-0 group-hover/tag:opacity-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </div>
                  <span className="text-sm font-medium">Search</span>
                </motion.button>
              )}
            </AnimatePresence>
            {voiceState === 'recording' ? (
              <>
                <button
                  type="button"
                  onClick={() => stopRecording(false)}
                  className="text-white flex items-center justify-center transition-colors hover:bg-white/10 rounded-full p-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  className="rounded-full w-9 h-9 flex items-center justify-center transition-colors bg-white text-black hover:bg-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20V4m-7 7l7-7l7 7" />
                  </svg>
                </button>
              </>
            ) : voiceState === 'processing' ? (
              <div className="relative w-5 h-5 flex items-center justify-center">
                <svg className="animate-[spin_2s_linear_infinite] w-full h-full" viewBox="25 25 50 50">
                  <circle
                    className="stroke-white fill-none [stroke-linecap:round] [stroke-dasharray:1,200] [stroke-dashoffset:0] animate-[dash_1.5s_ease-in-out_infinite]"
                    cx="50"
                    cy="50"
                    r="20"
                    strokeWidth="4"
                    strokeMiterlimit="10"
                  />
                </svg>
              </div>
            ) : (
              <>
                {input.trim() ? (
                  <button
                    type="submit"
                    className="rounded-full w-9 h-9 flex items-center justify-center transition-colors bg-white text-black hover:bg-gray-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                      <path d="M0 0h24v24H0z" fill="none" />
                      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20V4m-7 7l7-7l7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="text-white flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple
          onChange={handleFileChange}
        />
      </motion.form>

      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          >
            {previewFile.isDoc || previewFile.isVector ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1a1a] border border-neutral-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              >
                <div className="flex items-start justify-between p-6 pb-4 border-b border-neutral-800">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{previewFile.file.name}</h3>
                    {!previewFile.isVector && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{(previewFile.file.size / 1024).toFixed(2)} KB</span>
                        <span>•</span>
                        <span>{previewFile.lines === 1 ? '1 line' : `${previewFile.lines} lines`}</span>
                        <span>•</span>
                        <span>Formatting may be inconsistent from source</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto bg-[#1a1a1a] scrollbar-thin scrollbar-thumb-neutral-700">
                  {previewFile.isVector ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-gray-300 mb-6">Preview isn't available for {previewFile.file.name} ({(previewFile.file.size / 1024).toFixed(2)} KB).</p>
                      <button
                        onClick={() => {
                          const url = URL.createObjectURL(previewFile.file);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = previewFile.file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-700 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#252525] border border-neutral-800 rounded-2xl p-4 md:p-6">
                      <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                        {previewFile.content || "Content not available for preview."}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex flex-col items-center justify-center w-full max-w-5xl h-full max-h-[90vh]"
              >
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="absolute top-0 right-0 md:-right-12 md:top-0 text-gray-400 hover:text-white p-2 transition-colors z-50 bg-black/20 md:bg-transparent rounded-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <div className="bg-[#111] p-2 rounded-2xl shadow-2xl flex flex-col max-w-full max-h-[85vh] relative overflow-hidden">
                  <div className="flex-1 overflow-auto flex items-center justify-center">
                    <img 
                      src={URL.createObjectURL(previewFile.file)} 
                      alt={previewFile.file.name} 
                      className="max-w-full max-h-full object-contain rounded-lg" 
                    />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-neutral-800/40 backdrop-blur-md text-gray-200 text-sm px-4 py-2 rounded-full shadow-lg pointer-events-auto border border-white/5">
                      {previewFile.file.name}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
