// Simple per-file async queue to avoid concurrent write corruption
const fileQueues = new Map();

function enqueue(file, task) {
    const prev = fileQueues.get(file) || Promise.resolve();
    const next = prev.then(task).catch((e) => { throw e; });
    fileQueues.set(file, next.finally(() => {
        if (fileQueues.get(file) === next) fileQueues.delete(file);
    }));
    return next;
}

module.exports = { enqueue };
