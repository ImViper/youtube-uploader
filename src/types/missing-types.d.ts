// Missing type definitions

// Add ProgressHandler type that was missing
export type ProgressHandler = (progress: number) => void;

// Extend BullMQ types if needed
declare module 'bullmq' {
  export interface RedisConnection {
    incr(key: string): Promise<number>;
  }
}