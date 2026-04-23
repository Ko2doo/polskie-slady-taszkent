import fs from 'fs';

import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filename = path.resolve(__dirname, 'dist/optimized/navigation-graph-optimized.json');
const graph = JSON.parse(fs.readFileSync(filename, 'utf8'));

// Сжимаем координаты до 5 знаков (точность ~1 метр)
const compressed = {
  nodes: {},
  edges: graph.edges,
};

Object.keys(graph.nodes).forEach((nodeId) => {
  const node = graph.nodes[nodeId];
  compressed.nodes[nodeId] = {
    lon: parseFloat(node.lon.toFixed(5)),
    lat: parseFloat(node.lat.toFixed(5)),
  };
});

fs.writeFileSync(path.resolve(__dirname, 'dist/navigation-graph-final.json'), JSON.stringify(compressed));

const beforeSize = fs.statSync(filename).size;
const afterSize = fs.statSync(path.resolve(__dirname, 'dist/navigation-graph-final.json')).size;

console.log(`До: ${(beforeSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`После: ${(afterSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`Экономия: ${((1 - afterSize / beforeSize) * 100).toFixed(1)}%`);
