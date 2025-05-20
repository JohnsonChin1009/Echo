"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Trash2 } from "lucide-react"
import { saveRecordingToDB, getAllRecordingsFromDB, deleteRecordingFromDB } from "@/lib/indexedDb"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [timer, setTimer] = useState(180) // 3 minutes
  const [recordings, setRecordings] = useState<{ id: number, blob: Blob; url: string; createdAt: Date }[]>([])

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const MAX_RECORDING_TIME = 180 // 3 minutes in seconds
  const circumference = 2 * Math.PI * 30 // Circle circumference (2πr) where r=30

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
            const blob = new Blob(chunks, { type: "audio/webm" })
            const createdAt = new Date()
            const url = URL.createObjectURL(blob)

            const id = await saveRecordingToDB({ blob, createdAt: createdAt.toISOString() })

            setRecordings((prev) => [
              ...prev,
              { id, blob, url, createdAt }
            ])

            stream.getTracks().forEach((track) => track.stop())
            streamRef.current = null
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setTimer(MAX_RECORDING_TIME)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop()
    }
    setIsRecording(false)
    setTimer(MAX_RECORDING_TIME)
  }

  const deleteRecording = async (index: number) => {
    const rec = recordings[index]
    if (rec.id != null) {
      await deleteRecordingFromDB(rec.id)
    }
    URL.revokeObjectURL(rec.url)
    setRecordings((prev) => prev.filter((_, i) => i !== index))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
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
    <main className="min-h-screen px-4 py-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm flex flex-col items-center space-y-12">
        <h1 className="text-2xl text-center text-gray-800 font-bold">hey, what&apos;s up?</h1>

        <div className="flex flex-col items-center space-y-8 w-full">
          {/* Timer with radial countdown */}
          {isRecording && (
            <div className="relative flex items-center justify-center">
              {/* Radial countdown timer */}
              <svg className="absolute -rotate-90 w-20 h-20">
                {/* Background circle */}
                <circle cx="50%" cy="50%" r="30" stroke="#f1f1f1" strokeWidth="4" fill="none" />
                {/* Progress circle */}
                <circle
                  cx="50%"
                  cy="50%"
                  r="30"
                  stroke="#ef4444"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={calculateProgress()}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Timer text */}
              <div className="text-xl font-mono font-medium text-red-500 z-10">{formatTime(timer)}</div>
            </div>
          )}

          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "w-20 h-20 rounded-full shadow-md transition-all duration-300 z-10 relative",
                isRecording
                  ? "bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300"
                  : "bg-white hover:bg-gray-50 border-gray-200",
              )}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <StopCircle size={32} className="text-red-500" />
              ) : (
                <Mic size={32} className="text-gray-700" />
              )}
            </Button>
          </div>

          <span className="text-sm font-medium text-gray-500">{!isRecording && "Tap to record a thought"}</span>
        </div>
      </div>

      {/* Recordings */}
      {recordings.length > 0 && (
        <div className="w-full max-w-sm mt-16 space-y-4">
          <h2 className="text-base font-medium text-gray-700 border-b pb-2">Your Thoughts</h2>
          <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-1">
            {recordings.map((rec, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-lg flex flex-col gap-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{formatDate(rec.createdAt)}</span>
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
                <audio controls className="w-full h-8" src={rec.url} preload="metadata"></audio>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}