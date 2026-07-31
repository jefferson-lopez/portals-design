export type AutosaveStatus = "idle" | "saving" | "saved" | "error";
export type AutosaveHandoff<T> = { error: unknown; value: T };

type AutosaveQueueOptions<T> = {
  delay: number;
  maxFlushPasses?: number;
  onStatusChange?: (status: AutosaveStatus, error?: unknown) => void;
  save: (value: T) => Promise<void>;
};

/**
 * Debounces full snapshots and serializes persistence so an older request can
 * never finish after (and overwrite) a newer one.
 */
export class AutosaveQueue<T> {
  readonly #delay: number;
  readonly #maxFlushPasses: number;
  readonly #onStatusChange?: AutosaveQueueOptions<T>["onStatusChange"];
  readonly #save: AutosaveQueueOptions<T>["save"];
  #disposed = false;
  #dueAt = 0;
  #inFlight: Promise<void> | null = null;
  #pending: T | undefined;
  #status: AutosaveStatus = "idle";
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    delay,
    maxFlushPasses = 50,
    onStatusChange,
    save,
  }: AutosaveQueueOptions<T>) {
    this.#delay = delay;
    this.#maxFlushPasses = maxFlushPasses;
    this.#onStatusChange = onStatusChange;
    this.#save = save;
  }

  get status() {
    return this.#status;
  }

  schedule(value: T) {
    if (this.#disposed) return;
    this.#pending = value;
    this.#dueAt = Date.now() + this.#delay;
    this.#setStatus("saving");
    this.#arm(this.#delay);
  }

  acceptHandoff({ error, value }: AutosaveHandoff<T>) {
    if (this.#disposed || this.#pending !== undefined) return;
    this.#pending = value;
    this.#setStatus("error", error);
  }

  completePredecessor(handoff?: AutosaveHandoff<T>) {
    if (handoff) {
      this.acceptHandoff(handoff);
      return;
    }
    if (!this.#disposed && this.#pending === undefined) {
      this.#setStatus("idle");
    }
  }

  async flush() {
    if (this.#disposed) return;
    let passes = 0;
    while (!this.#disposed) {
      this.#clearTimer();
      if (!this.#inFlight && this.#pending === undefined) return;
      if (passes >= this.#maxFlushPasses) {
        const error = new Error("Autosave flush did not stabilize");
        this.#clearTimer();
        this.#setStatus("error", error);
        throw error;
      }
      const operation = this.#inFlight ?? this.#drain();
      passes += 1;
      await operation;
    }
  }

  async dispose(): Promise<AutosaveHandoff<T> | undefined> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#clearTimer();
    let finalError: unknown;
    try {
      if (this.#inFlight) await this.#inFlight;
    } catch (error) {
      finalError = error;
      // The failed snapshot remains pending and gets one final safe attempt.
    }
    if (this.#pending !== undefined) {
      try {
        await this.#drain(true);
      } catch (error) {
        finalError = error;
      }
    }
    if (this.#pending === undefined) return;
    const value = this.#pending;
    this.#pending = undefined;
    return {
      error: finalError ?? new Error("Autosave dispose could not persist"),
      value,
    };
  }

  #arm(delay: number) {
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#drain().catch(() => {
        // The error is exposed through status and retained for explicit retry.
      });
    }, delay);
  }

  #clearTimer() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #drain(whileDisposing = false) {
    if ((!whileDisposing && this.#disposed) || this.#pending === undefined) {
      return Promise.resolve();
    }
    if (this.#inFlight) return this.#inFlight;

    const value = this.#pending;
    this.#pending = undefined;
    this.#setStatus("saving");

    const operation = (async () => {
      let restoredFailedSnapshot = false;
      try {
        await this.#save(value);
        this.#setStatus(this.#pending === undefined ? "saved" : "saving");
      } catch (error) {
        if (this.#pending === undefined) {
          this.#pending = value;
          restoredFailedSnapshot = true;
        }
        this.#setStatus("error", error);
        throw error;
      } finally {
        this.#inFlight = null;
        if (
          !this.#disposed &&
          this.#pending !== undefined &&
          !restoredFailedSnapshot
        ) {
          this.#arm(Math.max(0, this.#dueAt - Date.now()));
        }
      }
    })();
    this.#inFlight = operation;
    return operation;
  }

  #setStatus(status: AutosaveStatus, error?: unknown) {
    this.#status = status;
    if (!this.#disposed) this.#onStatusChange?.(status, error);
  }
}
