// Lets the task screen tell the list to reload as soon as the user comes back.
const listeners = new Set<() => void>();

export function onTasksChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function tasksChanged(): void {
  listeners.forEach((fn) => fn());
}
