const activeJobs = new Map();

export class ImageProcessingQueue {
  async add(name, processor) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const job = { id, name, status: 'processing', progress: 5, createdAt: new Date() };
    activeJobs.set(id, job);
    try {
      job.progress = 35;
      const result = await processor((progress) => { job.progress = Math.max(job.progress, Number(progress) || 0); });
      Object.assign(job, { status: 'complete', progress: 100, result, completedAt: new Date() });
      return job;
    } catch (error) {
      Object.assign(job, { status: 'failed', error: error.message, completedAt: new Date() });
      throw error;
    } finally {
      setTimeout(() => activeJobs.delete(id), 10 * 60 * 1000).unref?.();
    }
  }

  get(id) {
    return activeJobs.get(id) || null;
  }
}

export default new ImageProcessingQueue();
