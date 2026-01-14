import fs from 'fs';

const graph = JSON.parse(fs.readFileSync('navigation-graph-optimized.json', 'utf8'));

// Сжимаем координаты до 5 знаков (точность ~1 метр)
const compressed = {
  nodes: {},
  edges: graph.edges
};

Object.keys(graph.nodes).forEach(nodeId => {
  const node = graph.nodes[nodeId];
  compressed.nodes[nodeId] = {
    lon: parseFloat(node.lon.toFixed(5)),
    lat: parseFloat(node.lat.toFixed(5))
  };
});

fs.writeFileSync('navigation-graph-final.json', JSON.stringify(compressed));

const beforeSize = fs.statSync('navigation-graph-optimized.json').size;
const afterSize = fs.statSync('navigation-graph-final.json').size;

console.log(`До: ${(beforeSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`После: ${(afterSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`Экономия: ${((1 - afterSize / beforeSize) * 100).toFixed(1)}%`);
