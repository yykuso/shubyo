# 新しいGeoJSONレイヤーの追加方法

このドキュメントでは、マップアプリケーションに新しいGeoJSONレイヤーを追加する方法を説明します。

## 手順

### 1. GeoJSONファイルの準備

新しいGeoJSONファイルを `data/` フォルダに配置します。レイヤーの名前と説明は、GeoJSONファイル内の `metadata` セクションに含めることができます。

```json
{
  "type": "FeatureCollection",
  "metadata": {
    "name": "レイヤーの表示名",
    "description": "レイヤーの詳細説明",
    "category": "カテゴリ名",
    "updated": "2025-07-22"
  },
  "features": [
    // フィーチャーデータ
  ]
}
```

```
data/
├── sample-points.geojson
├── sample-lines.geojson
├── sample-polygons.geojson
└── your-new-file.geojson  ← 新しいファイル
```

### 2. レイヤー設定の追加

`config/layers.js` ファイルの `LAYER_CONFIG` 配列に新しいレイヤー設定を追加します。

```javascript
{
    id: 'unique-layer-id',           // 一意のレイヤーID
    name: null,                      // GeoJSONのmetadataから自動取得（nullの場合）
    description: null,               // GeoJSONのmetadataから自動取得（nullの場合）
    type: 'geojson',                 // 固定値
    source: 'data/your-file.geojson', // GeoJSONファイルのパス
    geometryType: 'Point',           // Point, LineString, Polygon のいずれか
    visible: true,                   // 初期表示状態（true/false）
    style: {
        // スタイル設定（ジオメトリタイプに応じて設定）
    }
}
```

**注意**: `name` と `description` を `null` に設定すると、GeoJSONファイルの `metadata` セクションから自動的に読み込まれます。設定ファイルで値を指定した場合は、そちらが優先されます。

### 3. スタイル設定例

#### ポイント（Point）の場合
```javascript
style: {
    type: 'circle',
    paint: {
        'circle-radius': 8,
        'circle-color': '#ff6b6b',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
    }
}
```

#### ライン（LineString）の場合
```javascript
style: {
    type: 'line',
    paint: {
        'line-color': '#4ecdc4',
        'line-width': 3,
        'line-opacity': 0.8
    }
}
```

#### ポリゴン（Polygon）の場合
```javascript
style: {
    type: 'fill',
    paint: {
        'fill-color': '#95e1d3',
        'fill-opacity': 0.6,
        'fill-outline-color': '#3d5a80'
    }
}
```

## GeoJSONファイルの形式

### ポイントデータの例
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "地点名",
        "category": "カテゴリ",
        "description": "説明"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [経度, 緯度]
      }
    }
  ]
}
```

### プロパティの活用

- `properties` オブジェクト内の値は、地図上のフィーチャーをクリックした際にポップアップで表示されます
- わかりやすいキー名を使用することを推奨します

## 動的なレイヤー追加

JavaScript でレイヤーを動的に追加することも可能です：

```javascript
// 新しいレイヤー設定
const newLayer = {
    id: 'dynamic-layer',
    name: '動的レイヤー',
    description: '動的に追加されたレイヤー',
    type: 'geojson',
    source: 'data/new-data.geojson',
    geometryType: 'Point',
    visible: true,
    style: {
        type: 'circle',
        paint: {
            'circle-radius': 6,
            'circle-color': '#purple'
        }
    }
};

// レイヤーを追加
window.mapViewer.addNewLayer(newLayer);
```

## 注意事項

1. **レイヤーID** は一意である必要があります
2. **GeoJSONファイル** は有効な形式である必要があります
3. **スタイル設定** はジオメトリタイプに適合している必要があります
4. ファイルサイズが大きい場合は、パフォーマンスに影響する可能性があります

## トラブルシューティング

- レイヤーが表示されない場合は、ブラウザの開発者ツールでエラーを確認してください
- GeoJSONファイルの形式が正しいか確認してください
- ファイルパスが正しいか確認してください
