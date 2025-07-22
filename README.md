# MapLibre GeoJSON Viewer

MapLibre GLを使用したGeoJSONファイル表示アプリケーションです。複数のGeoJSONレイヤーをチェックボックスで制御でき、簡単にメンテナンスできる構造になっています。

## 機能

- 🗺️ MapLibre GLベースのインタラクティブマップ
- 📍 複数のGeoJSONレイヤーの表示
- ✅ レイヤーごとのチェックボックス制御
- 📱 レスポンシブデザイン
- 🔧 メンテナンスしやすい設定ファイル構造
- 💬 フィーチャークリック時のポップアップ表示

## ファイル構成

```
├── index.html              # メインHTML
├── app.js                  # アプリケーションロジック
├── styles.css             # スタイルシート
├── config/
│   └── layers.js          # レイヤー設定ファイル
├── data/                  # GeoJSONファイル
│   ├── sample-points.geojson
│   ├── sample-lines.geojson
│   └── sample-polygons.geojson
├── LAYER_GUIDE.md         # レイヤー追加ガイド
└── README.md
```

## 使用方法

1. **基本的な使い方**
   - ブラウザで `index.html` を開く
   - 左側のサイドバーでレイヤーのON/OFFを切り替え
   - マップ上のフィーチャーをクリックで詳細情報を表示

2. **新しいGeoJSONレイヤーの追加**
   - `data/` フォルダに新しいGeoJSONファイルを配置
   - `config/layers.js` に設定を追加
   - 詳細は `LAYER_GUIDE.md` を参照

## レイヤー設定例

```javascript
{
    id: 'my-layer',
    name: '私のレイヤー',
    description: 'レイヤーの説明',
    type: 'geojson',
    source: 'data/my-data.geojson',
    geometryType: 'Point',
    visible: true,
    style: {
        type: 'circle',
        paint: {
            'circle-radius': 8,
            'circle-color': '#ff6b6b'
        }
    }
}
```

## 開発・カスタマイズ

### 主要なクラス・メソッド

- `GeoJSONMapViewer` - メインアプリケーションクラス
- `addNewLayer(layerConfig)` - 動的レイヤー追加
- `removeLayer(layerId)` - レイヤー削除
- `toggleLayer(layerId, visible)` - レイヤー表示切り替え

### 設定可能項目

- **ベースマップ**: `MAP_CONFIG.style` でスタイルURLを変更
- **初期位置**: `MAP_CONFIG.center` と `MAP_CONFIG.zoom` で調整
- **レイヤースタイル**: 各レイヤーの `style` プロパティで調整

## 技術仕様

- **マップライブラリ**: MapLibre GL JS v4.1.1
- **データ形式**: GeoJSON
- **対応ジオメトリ**: Point, LineString, Polygon
- **ブラウザ要件**: モダンブラウザ (ES6+)

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。