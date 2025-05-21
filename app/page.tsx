"use client"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MSStream?: any;
  }
}

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Trash2 } from "lucide-react";
import { saveRecordingToDB, getAllRecordingsFromDB, deleteRecordingFromDB } from "@/lib/indexedDb";
import PWAInstallPrompt from "@/components/custom/PWAInstallPrompt";
import { FaRegCircleStop } from "react-icons/fa6";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [timer, setTimer] = useState(180) // 3 minutes
  const [recordings, setRecordings] = useState<{ id: number, recordingName: string, blob: Blob; url: string; createdAt: Date }[]>([])

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const MAX_RECORDING_TIME = 180 // 3 minutes in seconds
  const buttonRadius = 30 // Button radius in pixels
  const strokeWidth = 4 // Width of the progress stroke
  const radius = buttonRadius + strokeWidth // Outer radius for the SVG circle
  const circumference = 2 * Math.PI * radius // Circle circumference (2πr)

  useEffect(() => {
    const loadRecordings = async () => {
      const data = await getAllRecordingsFromDB()
      const withUrls = data.map((r) => ({
        ...r,
        url: URL.createObjectURL(r.blob),
        createdAt: new Date(r.createdAt),
      }))
      setRecordings(withUrls)
    }

    loadRecordings()
  }, [])

  useEffect(() => {
    if (isRecording && timer > 0) {
      timerRef.current = setTimeout(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    }

    if (timer === 0 && isRecording) {
      stopRecording() // auto-stop
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isRecording, timer])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
            const blob = new Blob(chunks as BlobPart[], { type: "audio/mp4" });
            const createdAt = new Date();
            const url = URL.createObjectURL(blob);
            const recordingName = `Recording ${createdAt.toLocaleString()}`;
            const id = await saveRecordingToDB({ recordingName, blob, createdAt: createdAt.toISOString() });

            setRecordings((prev) => [
              ...prev,
              { id, recordingName, blob, url, createdAt }
            ])

            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
      }

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setTimer(MAX_RECORDING_TIME);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false)
    setTimer(MAX_RECORDING_TIME)
  }

  const deleteRecording = async (index: number) => {
    const rec = recordings[index]
    if (rec.id != null) {
      await deleteRecordingFromDB(rec.id);
    }
    URL.revokeObjectURL(rec.url);
    setRecordings((prev) => prev.filter((_, i) => i !== index))
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      month: "short",
      day: "numeric",
    }).format(date)
  }

  // Calculate the stroke-dashoffset based on remaining time
  const calculateProgress = () => {
    const progress = timer / MAX_RECORDING_TIME
    return circumference - progress * circumference
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4">
      <PWAInstallPrompt />
      {/* Fixed header section */}
      <div className="w-full flex flex-col items-center justify-center bg-white">
        <div className="w-full max-w-sm flex flex-col items-center space-y-2 pt-[30%] pb-[10%] md:pt-[10%] md:pb-[5%]">
          <h1 className="text-2xl text-center text-gray-800 font-bold">hey, what&apos;s up?</h1>
          <p className="italic text-center">record raw thoughts now, and make sense of it later</p>
        </div>
      </div>

      {/* Scrollable recordings section */}
      <div className="space-y-4 px-4 flex flex-col items-center w-full lg:max-w-md">
      <h2 className="text-base font-medium text-gray-700 border-b pb-2 sticky top-0 bg-white self-start">your thoughts</h2>
      <ScrollArea className="h-[300px] w-full md:h-[400px] rounded-md border p-4 max-w-sm lg:max-w-md">
        <div className="w-full">
          {recordings.length > 0 ? (
            <div className="space-y-4 pb-32">
              {recordings.map((rec, i) => (
                <div
                  key={i}
                  className="bg-white p-4 rounded-lg flex flex-col gap-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-800">{rec.recordingName}</span>
                      <span className="text-xs text-gray-500">{formatDate(rec.createdAt)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => deleteRecording(i)}
                      aria-label="Delete recording"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <audio controls className="w-full h-8" src={rec.url} preload="metadata" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400 text-sm italic">no recordings yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
      </div>
      

      {/* Fixed recording button section */}
      <div className="fixed bottom-0 left-0 right-0 py-8 px-4 flex flex-col items-center bg-white border-gray-100">
        <div className="w-full max-w-sm flex flex-col items-center space-y-4">
          <div className="relative">
            {/* Radial countdown timer surrounding the button */}
            {isRecording && (
              <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-90 w-28 h-28">
                {/* Background circle */}
                <circle cx="50%" cy="50%" r={radius} stroke="#f1f1f1" strokeWidth={strokeWidth} fill="none" />
                {/* Progress circle */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  stroke="#ef4444"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={calculateProgress()}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            )}

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "w-[60px] h-[60px] rounded-full shadow-md transition-all duration-300 z-10 relative",
                isRecording
                  ? "bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300"
                  : "bg-white hover:bg-gray-50 border-gray-200",
              )}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <FaRegCircleStop
                  size={32}
                  className={cn("text-red-500 size-4 lg:size-6", "animate-[pulse_1.5s_ease-in-out_infinite]")}
                />
              ) : (
                <Mic size={32} className="text-gray-700 size-4 lg:size-6" />
              )}
            </Button>
          </div>
          <span className={cn("text-sm text-gray-500 transition-opacity", isRecording ? "opacity-0" : "opacity-100")}>
            tap to record
          </span>
        </div>
      </div>
    </main>
  )
}