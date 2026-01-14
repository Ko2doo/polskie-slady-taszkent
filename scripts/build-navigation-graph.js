import fs from 'fs';

// Загружаем GeoJSON
const geojson = JSON.parse(fs.readFileSync('tashkent_roads.geojson', 'utf8'));

console.log('Загружено дорог:', geojson.features.length);

// Граф навигации
const graph = {
  nodes: {},
  edges: []
};

let nodeIdCounter = 0;
const coordToNodeId = new Map(); // Для поиска существующих узлов

// Функция для создания ключа координаты (округляем до 6 знаков)
function coordKey(lon, lat) {
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

// Функция для получения или создания узла
function getOrCreateNode(lon, lat) {
  const key = coordKey(lon, lat);
  
  if (coordToNodeId.has(key)) {
    return coordToNodeId.get(key);
  }
  
  const nodeId = `n${nodeIdCounter++}`;
  graph.nodes[nodeId] = { lon, lat };
  coordToNodeId.set(key, nodeId);
  
  return nodeId;
}

// Функция расчёта расстояния (Haversine formula)
function distance(lon1, lat1, lon2, lat2) {
  const R = 6371000; // Радиус Земли в метрах
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Обрабатываем каждую дорогу
geojson.features.forEach((feature, index) => {
  if (feature.geometry.type !== 'LineString') {
    return;
  }
  
  const coords = feature.geometry.coordinates;
  const highway = feature.properties?.highway || 'unknown';
  
  // Определяем двунаправленность (по умолчанию да для пешеходов)
  const oneway = feature.properties?.oneway === 'yes' ? true : false;
  
  // Создаём узлы и рёбра для каждого сегмента
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    
    const fromNode = getOrCreateNode(lon1, lat1);
    const toNode = getOrCreateNode(lon2, lat2);
    
    const dist = distance(lon1, lat1, lon2, lat2);
    
    // Добавляем ребро
    graph.edges.push({
      from: fromNode,
      to: toNode,
      distance: Math.round(dist * 10) / 10, // Округляем до 0.1м
      type: highway
    });
    
    // Если не односторонняя - добавляем обратное ребро
    if (!oneway) {
      graph.edges.push({
        from: toNode,
        to: fromNode,
        distance: Math.round(dist * 10) / 10,
        type: highway
      });
    }
  }
  
  if ((index + 1) % 1000 === 0) {
    console.log(`Обработано дорог: ${index + 1}`);
  }
});

console.log('Узлов создано:', Object.keys(graph.nodes).length);
console.log('Рёбер создано:', graph.edges.length);

// Сохраняем граф
fs.writeFileSync('navigation-graph.json', JSON.stringify(graph, null, 2));
console.log('Граф сохранён в navigation-graph.json');

// Сохраняем компактную версию (без форматирования)
fs.writeFileSync('navigation-graph-compact.json', JSON.stringify(graph));
console.log('Компактная версия сохранена в navigation-graph-compact.json');

// Статистика
const graphSize = fs.statSync('navigation-graph-compact.json').size;
console.log(`Размер графа: ${(graphSize / 1024 / 1024).toFixed(2)} МБ`);
