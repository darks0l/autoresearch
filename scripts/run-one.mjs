// Run exactly 1 experiment with full debug
import { runAutoresearch } from '../src/controller.js';
import { initMemory } from '../src/memory.js';

process.on('uncaughtException', e => {
  console.error('UNCAUGHT:', e.message);
  console.error(e.stack?.slice(0, 500));
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason?.message || reason);
});

console.log('Starting 1-experiment run...');

try {
  await initMemory();
  const result = await runAutoresearch({
    maxExperiments: 1,
    onExperiment: (exp) => {
      console.log('Experiment result:', exp.id, 'kept:', exp.kept, 'score:', exp.result?.score);
    },
    onBatch: (results, batchNum) => {
      console.log('Batch', batchNum, ':', results.length, 'experiments');
    }
  });
  console.log('Done:', JSON.stringify(result).slice(0, 200));
} catch (e) {
  console.error('RUN ERROR:', e.message);
  console.error(e.stack?.slice(0, 500));
}
