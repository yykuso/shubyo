// レイヤー設定ファイル
// 新しいGeoJSONレイヤーを追加する際は、このファイルにレイヤー情報を追加してください

const LAYER_CONFIG = [
    {
        id: 'city-hall',
        type: 'geojson',
        source: 'data/city-hall.geojson',
        geometryType: 'Point',
        visible: true,
        style: {
            type: 'circle',
            paint: {
                'circle-radius': 5,
                'circle-color': '#dd0000',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        }
    },
    {
        id: 'foreign-embassy',
        type: 'geojson',
        source: 'data/foreign-embassy.geojson',
        geometryType: 'Point',
        visible: false,
        style: {
            type: 'circle',
            paint: {
                'circle-radius': 5,
                'circle-color': '#9b59b6',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        }
    }
];

// ベースマップの設定
const MAP_CONFIG = {
    style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json', // OSM日本語ベクトルスタイル
    center: [139.6917, 35.6895], // 東京駅の座標
    zoom: 10,
    minZoom: 1,
    maxZoom: 18
};

// 新しいレイヤーを追加する関数（オプション）
function addLayerConfig(layerConfig) {
    LAYER_CONFIG.push(layerConfig);
}
