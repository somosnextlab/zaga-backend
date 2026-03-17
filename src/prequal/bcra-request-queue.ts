/**
 * Cola de requests hacia la API del BCRA con concurrencia limitada.
 * Respeta el control de tráfico por IP documentado en el manual BCRA.
 */
export class BcraRequestQueue {
  private readonly concurrency: number;
  private activeCount = 0;
  private readonly waitQueue: Array<() => void> = [];

  public constructor(concurrency: number) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  /**
   * Ejecuta una función respetando el límite de concurrencia.
   * Las tareas excedentes esperan en cola hasta que haya un slot libre.
   */
  public async add<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.concurrency) {
      this.activeCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) next();
    } else {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }
}
