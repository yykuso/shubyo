class GeoJSONMapViewer {
    constructor() {
        this.map = null;
        this.loadedLayers = new Set();
        this.init();
    }

    init() {
        this.initMap();
        this.initUI();
        this.initSidebarToggle();
    }

    initSidebarToggle() {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.getElementById('toggle-sidebar');
        const mobileToggle = document.getElementById('mobile-toggle');

        // デスクトップでは初期状態で開いている
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
        }

        // サイドバー内のトグルボタン
        toggleButton.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            mobileToggle.classList.remove('hidden');
        });

        // モバイル用フローティングボタン
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.remove('collapsed');
            mobileToggle.classList.add('hidden');
        });

        // ウィンドウリサイズ時の処理
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('collapsed');
                mobileToggle.classList.add('hidden');
            } else {
                // モバイルでは初期状態で閉じている
                if (!sidebar.classList.contains('collapsed')) {
                    mobileToggle.classList.add('hidden');
                } else {
                    mobileToggle.classList.remove('hidden');
                }
            }
        });

        // マップエリアクリック時にサイドバーを閉じる（モバイルのみ）
        document.getElementById('map').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.add('collapsed');
                mobileToggle.classList.remove('hidden');
            }
        });
    }

    initMap() {
        this.map = new maplibregl.Map({
            container: 'map',
            style: MAP_CONFIG.style,
            center: MAP_CONFIG.center,
            zoom: MAP_CONFIG.zoom,
            minZoom: MAP_CONFIG.minZoom,
            maxZoom: MAP_CONFIG.maxZoom
        });

        this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
        this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        this.map.on('load', () => {
            console.log('Map loaded successfully');
            this.loadInitialLayers();
        });
    }

    async initUI() {
        const layerControlsContainer = document.getElementById('layer-controls');
        
        // 各レイヤーの設定を非同期で処理
        for (const layer of LAYER_CONFIG) {
            await this.loadLayerMetadata(layer);
            const controlElement = this.createLayerControl(layer);
            layerControlsContainer.appendChild(controlElement);
        }
    }

    async loadLayerMetadata(layer) {
        if (layer.name && layer.description) {
            return; // すでに設定されている場合はスキップ
        }

        try {
            const response = await fetch(layer.source);
            if (!response.ok) {
                throw new Error(`Failed to load metadata from ${layer.source}: ${response.status}`);
            }
            
            const geojsonData = await response.json();
            
            // metadataがある場合は使用、なければデフォルト値を設定
            if (geojsonData.metadata) {
                layer.name = geojsonData.metadata.name || `レイヤー ${layer.id}`;
                layer.description = geojsonData.metadata.description || 'GeoJSONデータ';
                layer.category = geojsonData.metadata.category;
                layer.updated = geojsonData.metadata.updated;
            } else {
                layer.name = `レイヤー ${layer.id}`;
                layer.description = 'GeoJSONデータ';
            }
            
        } catch (error) {
            console.error(`Error loading metadata for layer ${layer.id}:`, error);
            // エラーの場合はデフォルト値を設定
            layer.name = `レイヤー ${layer.id}`;
            layer.description = '読み込みエラー';
        }
    }

    createLayerControl(layer) {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'layer-control';

        const styleIndicator = document.createElement('div');
        styleIndicator.className = `layer-style-indicator ${layer.geometryType.toLowerCase()}`;
        styleIndicator.style.backgroundColor = this.getLayerColor(layer);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `layer-${layer.id}`;
        checkbox.checked = layer.visible;
        checkbox.addEventListener('change', (e) => {
            this.toggleLayer(layer.id, e.target.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = `layer-${layer.id}`;
        label.appendChild(styleIndicator);
        label.appendChild(document.createTextNode(layer.name));

        const description = document.createElement('div');
        description.className = 'layer-description';
        description.textContent = layer.description;

        controlDiv.appendChild(label);
        controlDiv.appendChild(description);
        label.insertBefore(checkbox, styleIndicator);

        return controlDiv;
    }

    getLayerColor(layer) {
        if (layer.style.paint) {
            return layer.style.paint['circle-color'] || 
                   layer.style.paint['line-color'] || 
                   layer.style.paint['fill-color'] || 
                   '#000000';
        }
        return '#000000';
    }

    async loadInitialLayers() {
        for (const layer of LAYER_CONFIG) {
            if (layer.visible) {
                await this.loadLayer(layer);
                this.showLayer(layer.id);
            }
        }
    }

    async loadLayer(layer) {
        if (this.loadedLayers.has(layer.id)) {
            return;
        }

        try {
            // GeoJSONデータを読み込み
            const response = await fetch(layer.source);
            if (!response.ok) {
                throw new Error(`Failed to load ${layer.source}: ${response.status}`);
            }
            
            const geojsonData = await response.json();

            // ソースを追加
            this.map.addSource(layer.id, {
                type: 'geojson',
                data: geojsonData
            });

            // レイヤーを追加
            this.map.addLayer({
                id: layer.id,
                type: layer.style.type,
                source: layer.id,
                paint: layer.style.paint,
                layout: layer.style.layout || {}
            });

            // ポップアップ機能を追加
            this.addPopupToLayer(layer);

            this.loadedLayers.add(layer.id);
            console.log(`Layer ${layer.id} loaded successfully`);

        } catch (error) {
            console.error(`Error loading layer ${layer.id}:`, error);
            // エラーメッセージを表示
            this.showErrorMessage(`レイヤー "${layer.name}" の読み込みに失敗しました: ${error.message}`);
        }
    }

    addPopupToLayer(layer) {
        this.map.on('click', layer.id, (e) => {
            const features = e.features;
            if (features.length > 0) {
                const feature = features[0];
                const properties = feature.properties;
                
                let popupContent = `<h3>${layer.name}</h3>`;
                for (const [key, value] of Object.entries(properties)) {
                    popupContent += `<p><strong>${key}:</strong> ${value}</p>`;
                }

                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(this.map);
            }
        });

        // マウスカーソルをポインターに変更
        this.map.on('mouseenter', layer.id, () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', layer.id, () => {
            this.map.getCanvas().style.cursor = '';
        });
    }

    async toggleLayer(layerId, visible) {
        const layer = LAYER_CONFIG.find(l => l.id === layerId);
        if (!layer) return;

        if (visible) {
            if (!this.loadedLayers.has(layerId)) {
                await this.loadLayer(layer);
            }
            this.showLayer(layerId);
        } else {
            this.hideLayer(layerId);
        }
    }

    showLayer(layerId) {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    }

    hideLayer(layerId) {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    }

    showErrorMessage(message) {
        // 簡単なエラー表示（実際のプロジェクトではより洗練された方法を使用）
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        // 5秒後に自動で削除
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // レイヤーを動的に追加するためのメソッド
    async addNewLayer(layerConfig) {
        LAYER_CONFIG.push(layerConfig);
        const controlElement = this.createLayerControl(layerConfig);
        document.getElementById('layer-controls').appendChild(controlElement);
        
        if (layerConfig.visible) {
            await this.loadLayer(layerConfig);
            this.showLayer(layerConfig.id);
        }
    }

    // レイヤーを削除するためのメソッド
    removeLayer(layerId) {
        if (this.map.getLayer(layerId)) {
            this.map.removeLayer(layerId);
        }
        if (this.map.getSource(layerId)) {
            this.map.removeSource(layerId);
        }
        this.loadedLayers.delete(layerId);

        // UIからも削除
        const control = document.getElementById(`layer-${layerId}`);
        if (control && control.parentElement) {
            control.parentElement.remove();
        }

        // 設定からも削除
        const index = LAYER_CONFIG.findIndex(l => l.id === layerId);
        if (index > -1) {
            LAYER_CONFIG.splice(index, 1);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    window.mapViewer = new GeoJSONMapViewer();
});
