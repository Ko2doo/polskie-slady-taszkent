import fs from 'fs';

const graph = JSON.parse(fs.readFileSync('navigation-graph-compact.json', 'utf8'));

console.log('Исходный граф:');
console.log('  Узлов:', Object.keys(graph.nodes).length);
console.log('  Рёбер:', graph.edges.length);

// Строим список смежности для анализа
const adjacency = {};
graph.edges.forEach(edge => {
  if (!adjacency[edge.from]) adjacency[edge.from] = [];
  adjacency[edge.from].push(edge);
});

// Находим узлы, которые можно убрать (имеют ровно 2 соседа)
const nodesToRemove = new Set();
const nodeConnections = {};

Object.keys(graph.nodes).forEach(nodeId => {
  const connections = adjacency[nodeId] || [];
  nodeConnections[nodeId] = connections.length;
  
  // Если у узла ровно 2 соседа и они оба одного типа дороги - можно объединить
  if (connections.length === 2) {
    const types = connections.map(e => e.type);
    if (types[0] === types[1]) {
      nodesToRemove.add(nodeId);
    }
  }
});

console.log('Промежуточных узлов для удаления:', nodesToRemove.size);

// Создаём оптимизированный граф
const optimizedGraph = {
  nodes: {},
  edges: []
};

const processedEdges = new Set();

// Копируем узлы, которые НЕ удаляем
Object.keys(graph.nodes).forEach(nodeId => {
  if (!nodesToRemove.has(nodeId)) {
    optimizedGraph.nodes[nodeId] = graph.nodes[nodeId];
  }
});

// Функция для прослеживания пути через промежуточные узлы
function tracePath(startEdge) {
  let currentNode = startEdge.to;
  let totalDistance = startEdge.distance;
  let path = [startEdge.from, currentNode];
  
  while (nodesToRemove.has(currentNode)) {
    const nextEdges = adjacency[currentNode].filter(e => e.to !== path[path.length - 2]);
    if (nextEdges.length !== 1) break;
    
    const nextEdge = nextEdges[0];
    totalDistance += nextEdge.distance;
    currentNode = nextEdge.to;
    path.push(currentNode);
    
    if (path.length > 1000) break; // Защита от бесконечных циклов
  }
  
  return {
    to: currentNode,
    distance: totalDistance,
    type: startEdge.type
  };
}

// Обрабатываем рёбра
graph.edges.forEach((edge, index) => {
  const edgeKey = `${edge.from}-${edge.to}`;
  
  if (processedEdges.has(edgeKey)) return;
  processedEdges.add(edgeKey);
  
  // Если начальный узел НЕ удаляется
  if (!nodesToRemove.has(edge.from)) {
    const traced = tracePath(edge);
    
    optimizedGraph.edges.push({
      from: edge.from,
      to: traced.to,
      distance: Math.round(traced.distance * 10) / 10,
      type: traced.type
    });
  }
  
  if ((index + 1) % 10000 === 0) {
    console.log(`Обработано рёбер: ${index + 1}`);
  }
});

console.log('\nОптимизированный граф:');
console.log('  Узлов:', Object.keys(optimizedGraph.nodes).length);
console.log('  Рёбер:', optimizedGraph.edges.length);

// Сохраняем
fs.writeFileSync('navigation-graph-optimized.json', JSON.stringify(optimizedGraph));

const originalSize = fs.statSync('navigation-graph-compact.json').size;
const optimizedSize = fs.statSync('navigation-graph-optimized.json').size;

console.log(`\nИсходный размер: ${(originalSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`Оптимизированный размер: ${(optimizedSize / 1024 / 1024).toFixed(2)} МБ`);
console.log(`Экономия: ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}%`);
