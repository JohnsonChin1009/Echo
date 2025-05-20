// lib/indexedDb.ts
import { openDB } from "idb"

export interface Recording {
  id: number
  recordingName: string;
  blob: Blob
  createdAt: string // stored as ISO string
}

const DB_NAME = "recordings-db"
const STORE_NAME = "recordings"

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
      }
    },
  })
}

export const saveRecordingToDB = async (recording: Omit<Recording, "id">) => {
  const db = await initDB()
  const id = await db.add(STORE_NAME, recording)
  return id as number;
}

export const getAllRecordingsFromDB = async (): Promise<Recording[]> => {
  const db = await initDB()
  return await db.getAll(STORE_NAME)
}

export const deleteRecordingFromDB = async (id: number) => {
  const db = await initDB()
  await db.delete(STORE_NAME, id)
}