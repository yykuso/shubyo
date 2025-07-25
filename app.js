class GeoJSONMapViewer {
    constructor() {
        this.map = null;
        this.loadedLayers = new Set();
        this.layerData = new Map(); // レイヤーデータを保存
        this.layerTypes = new Map(); // レイヤーごとのタイプ情報
        this.activeLayerFilters = new Map(); // レイヤーごとのアクティブフィルター
        this.checkinData = this.loadShubyoData(); // 収鋲データ
        this.init();
    }

    init() {
        this.initMap();
        this.initUI();
        this.initSidebarToggle();
        
        // ページ読み込み完了後にトランジションを有効化
        setTimeout(() => {
            document.body.classList.remove('preload');
        }, 100);
    }

    initSidebarToggle() {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.getElementById('toggle-sidebar');
        const mobileToggle = document.getElementById('mobile-toggle');

        // 初期状態を即座に設定（チラつき防止）
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
            mobileToggle.classList.add('hidden');
        } else {
            sidebar.classList.add('collapsed');
            mobileToggle.classList.remove('hidden');
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
        // 保存されたマップ状態を読み込み
        const savedMapState = this.loadMapState();
        
        this.map = new maplibregl.Map({
            container: 'map',
            style: MAP_CONFIG.style,
            center: savedMapState.center || MAP_CONFIG.center,
            zoom: savedMapState.zoom || MAP_CONFIG.zoom,
            minZoom: MAP_CONFIG.minZoom,
            maxZoom: MAP_CONFIG.maxZoom
        });

        this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
        this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
        
        // 位置情報コントロールを追加
        this.map.addControl(new maplibregl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            fitBoundsOptions: {maxZoom: 15},
            trackUserLocation: true,
            showUserLocation: true
        }), 'top-right');

        this.map.on('load', () => {
            console.log('Map loaded successfully');
            this.loadInitialLayers();
        });

        // マップの移動・ズーム時に状態を保存
        this.map.on('moveend', () => {
            this.saveMapState();
        });

        this.map.on('zoomend', () => {
            this.saveMapState();
        });
    }

    async initUI() {
        const layerControlsContainer = document.getElementById('layer-controls');
        
        // 保存されたレイヤー状態を読み込み
        const savedLayerStates = this.loadLayerStates();
        
        // 各レイヤーの設定を非同期で処理
        for (const layer of LAYER_CONFIG) {
            await this.loadLayerMetadata(layer);
            
            // 保存された状態があれば適用
            if (savedLayerStates[layer.id]) {
                layer.visible = savedLayerStates[layer.id].visible;
            }
            
            const controlElement = this.createLayerControl(layer);
            layerControlsContainer.appendChild(controlElement);
        }
        
        // レイヤーコントロールの後にエクスポート/インポートボタンを追加
        this.createDataManagementButtons(layerControlsContainer);
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
        controlDiv.id = `control-${layer.id}`;

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

        // レイヤータイトル部分
        const layerTitle = document.createElement('div');
        layerTitle.className = 'layer-title';
        layerTitle.appendChild(checkbox);
        layerTitle.appendChild(styleIndicator);
        layerTitle.appendChild(document.createTextNode(layer.name));

        // アクションボタン群
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'layer-actions';

        // 情報ボタン
        const infoButton = document.createElement('button');
        infoButton.className = 'info-button';
        infoButton.textContent = 'i';
        infoButton.title = 'レイヤー情報を表示';
        infoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLayerMetadata(layer.id);
        });
        actionsDiv.appendChild(infoButton);

        // フィルターボタン
        const filterButton = document.createElement('button');
        filterButton.className = 'filter-button';
        filterButton.id = `filter-btn-${layer.id}`;
        filterButton.textContent = '▼';
        filterButton.title = 'フィルターを表示/非表示';
        filterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLayerFilters(layer.id);
        });
        actionsDiv.appendChild(filterButton);

        const headerDiv = document.createElement('div');
        headerDiv.className = 'layer-header';
        headerDiv.appendChild(layerTitle);
        headerDiv.appendChild(actionsDiv);

        // レイヤーヘッダーのクリック動作：レイヤーのオン/オフ切り替え
        headerDiv.addEventListener('click', (e) => {
            // ボタンクリック時は動作しないようにする
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
                return;
            }
            checkbox.checked = !checkbox.checked;
            this.toggleLayer(layer.id, checkbox.checked);
        });

        // 説明部分は削除

        const description = document.createElement('div');
        description.className = 'layer-description';
        description.textContent = layer.description;

        // メタデータセクション
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'layer-metadata';
        metadataDiv.id = `metadata-${layer.id}`;

        // フィルターセクション
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'layer-filters';
        filtersDiv.id = `filters-${layer.id}`;

        controlDiv.appendChild(headerDiv);
        controlDiv.appendChild(description);
        controlDiv.appendChild(metadataDiv);
        controlDiv.appendChild(filtersDiv);

        return controlDiv;
    }

    toggleLayerMetadata(layerId) {
        const metadataDiv = document.getElementById(`metadata-${layerId}`);
        
        if (metadataDiv.classList.contains('visible')) {
            metadataDiv.classList.remove('visible');
        } else {
            metadataDiv.classList.add('visible');
            // メタデータを初期化（まだ作成されていない場合）
            if (metadataDiv.innerHTML === '') {
                this.createLayerMetadata(layerId);
            }
        }
    }

    createLayerMetadata(layerId) {
        const metadataDiv = document.getElementById(`metadata-${layerId}`);
        if (!metadataDiv) return;

        const geojsonData = this.layerData.get(layerId);
        const layer = LAYER_CONFIG.find(l => l.id === layerId);
        
        if (!geojsonData || !layer) return;

        const content = document.createElement('div');

        // 基本情報
        const addMetadataItem = (label, value) => {
            if (value) {
                const item = document.createElement('div');
                item.className = 'metadata-item';
                
                const labelSpan = document.createElement('span');
                labelSpan.className = 'metadata-label';
                labelSpan.textContent = label + ':';
                
                const valueSpan = document.createElement('span');
                valueSpan.className = 'metadata-value';
                valueSpan.textContent = value;
                
                item.appendChild(labelSpan);
                item.appendChild(valueSpan);
                content.appendChild(item);
            }
        };

        // GeoJSONのメタデータから情報を取得
        const metadata = geojsonData.metadata || {};
        
        // nameとdescription以外のメタデータを表示
        Object.keys(metadata).forEach(key => {
            if (key !== 'name' && key !== 'description') {
                addMetadataItem(key, metadata[key]);
            }
        });
        
        // フィーチャー数
        const featureCount = geojsonData.features ? geojsonData.features.length : 0;
        addMetadataItem('features', `${featureCount}`);

        metadataDiv.appendChild(content);
    }

    toggleLayerFilters(layerId) {
        const controlDiv = document.getElementById(`control-${layerId}`);
        const filtersDiv = document.getElementById(`filters-${layerId}`);
        const filterButton = document.getElementById(`filter-btn-${layerId}`);
        
        if (filtersDiv.classList.contains('visible')) {
            filtersDiv.classList.remove('visible');
            controlDiv.classList.remove('expanded');
            filterButton.classList.remove('active');
        } else {
            filtersDiv.classList.add('visible');
            controlDiv.classList.add('expanded');
            filterButton.classList.add('active');
            // フィルターを初期化（まだ作成されていない場合）
            if (!this.layerTypes.has(layerId) && this.loadedLayers.has(layerId)) {
                this.createLayerFilters(layerId);
            }
        }
    }

    createLayerFilters(layerId) {
        const filtersDiv = document.getElementById(`filters-${layerId}`);
        if (!filtersDiv || this.layerTypes.has(layerId)) return;

        const geojsonData = this.layerData.get(layerId);
        if (!geojsonData) return;

        // タイプを収集
        const types = new Set();
        if (geojsonData.features) {
            geojsonData.features.forEach(feature => {
                if (feature.properties && feature.properties.type) {
                    types.add(feature.properties.type);
                }
            });
        }

        this.layerTypes.set(layerId, types);
        
        // 保存されたフィルター状態を復元
        const savedLayerStates = this.loadLayerStates();
        const savedFilters = savedLayerStates[layerId]?.activeFilters || [];
        this.activeLayerFilters.set(layerId, new Set(savedFilters));

        if (types.size === 0) {
            filtersDiv.innerHTML = '<p style="font-size: 0.8em; color: #999; margin: 0;">フィルター可能なタイプがありません</p>';
            return;
        }

        const title = document.createElement('h4');
        title.textContent = 'タイプフィルター:';

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'layer-filter-controls';

        types.forEach(type => {
            const tag = document.createElement('div');
            tag.className = 'layer-filter-tag';
            tag.textContent = type;
            
            // 保存されたフィルター状態を反映
            if (savedFilters.includes(type)) {
                tag.classList.add('active');
            }
            
            tag.addEventListener('click', () => {
                this.toggleLayerTypeFilter(layerId, type, tag);
            });
            controlsDiv.appendChild(tag);
        });

        const clearButton = document.createElement('button');
        clearButton.className = 'layer-clear-filters';
        clearButton.textContent = 'クリア';
        clearButton.addEventListener('click', () => {
            this.clearLayerFilters(layerId);
        });

        filtersDiv.appendChild(title);
        filtersDiv.appendChild(controlsDiv);
        filtersDiv.appendChild(clearButton);
        
        // フィルターを適用
        this.updateLayerFilter(layerId);
    }

    toggleLayerTypeFilter(layerId, type, element) {
        const activeFilters = this.activeLayerFilters.get(layerId);
        
        if (activeFilters.has(type)) {
            activeFilters.delete(type);
            element.classList.remove('active');
        } else {
            activeFilters.add(type);
            element.classList.add('active');
        }
        
        this.updateLayerFilter(layerId);
        
        // フィルター状態を保存
        this.saveLayerStates();
    }

    clearLayerFilters(layerId) {
        const activeFilters = this.activeLayerFilters.get(layerId);
        activeFilters.clear();
        
        const controlsDiv = document.querySelector(`#filters-${layerId} .layer-filter-controls`);
        if (controlsDiv) {
            controlsDiv.querySelectorAll('.layer-filter-tag').forEach(tag => {
                tag.classList.remove('active');
            });
        }
        
        this.updateLayerFilter(layerId);
        
        // フィルター状態を保存
        this.saveLayerStates();
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

            // 重複座標の調整を適用
            this.adjustOverlappingPoints(geojsonData);

            // レイヤーデータを保存
            this.layerData.set(layer.id, geojsonData);

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

            // 収鋲状態に応じたスタイルを適用
            this.updateShubyoStyle(layer.id, geojsonData.metadata);

            // ポップアップ機能を追加
            this.addPopupToLayer(layer, geojsonData.metadata);

            this.loadedLayers.add(layer.id);
            console.log(`Layer ${layer.id} loaded successfully`);

        } catch (error) {
            console.error(`Error loading layer ${layer.id}:`, error);
            // エラーメッセージを表示
            this.showErrorMessage(`レイヤー "${layer.name}" の読み込みに失敗しました: ${error.message}`);
        }
    }

    updateLayerFilter(layerId) {
        const activeFilters = this.activeLayerFilters.get(layerId);
        
        if (!activeFilters || activeFilters.size === 0) {
            // フィルターがない場合は全て表示
            this.map.setFilter(layerId, null);
        } else {
            // 選択されたタイプのみ表示
            const filterExpression = [
                'in',
                ['get', 'type'],
                ['literal', Array.from(activeFilters)]
            ];
            this.map.setFilter(layerId, filterExpression);
        }
    }

    // 重複するポイントの座標を微調整する
    adjustOverlappingPoints(geojsonData) {
        if (!geojsonData.features || geojsonData.features.length === 0) return;

        // 座標をキーとして、同じ座標のポイントをグループ化
        const coordinateGroups = new Map();
        
        geojsonData.features.forEach((feature, index) => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const coordinates = feature.geometry.coordinates;
                const key = `${coordinates[0]},${coordinates[1]}`;
                
                if (!coordinateGroups.has(key)) {
                    coordinateGroups.set(key, []);
                }
                coordinateGroups.get(key).push({
                    feature: feature,
                    originalIndex: index
                });
            }
        });

        // 重複がある座標グループのみ処理
        coordinateGroups.forEach((group, coordinateKey) => {
            if (group.length > 1) {
                // 元の座標
                const [originalLng, originalLat] = group[0].feature.geometry.coordinates;
                
                // 円形に配置するためのオフセット計算
                const offsetDistance = 0.0001; // 約11メートル程度のオフセット
                const angleStep = (2 * Math.PI) / group.length;
                
                group.forEach((item, index) => {
                    if (index === 0) {
                        // 最初のポイントは元の位置のまま
                        return;
                    }
                    
                    // 円形にポイントを配置
                    const angle = angleStep * index;
                    const offsetLng = originalLng + (offsetDistance * Math.cos(angle));
                    const offsetLat = originalLat + (offsetDistance * Math.sin(angle));
                    
                    // 座標を更新
                    item.feature.geometry.coordinates = [offsetLng, offsetLat];
                });
                
                // console.log(`Adjusted ${group.length} overlapping points at ${coordinateKey}`);
            }
        });
    }

    // データ管理ボタンの作成
    createDataManagementButtons(container) {
        const managementDiv = document.createElement('div');
        managementDiv.className = 'data-management';
        managementDiv.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        `;

        const title = document.createElement('h4');
        title.textContent = '収鋲データ管理';
        title.style.cssText = `
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #495057;
            font-weight: 600;
        `;
        managementDiv.appendChild(title);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            flex-direction: column;
        `;

        // エクスポートボタン
        const exportButton = document.createElement('button');
        exportButton.textContent = '📤 エクスポート';
        exportButton.className = 'export-button';
        exportButton.style.cssText = `
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        `;
        exportButton.addEventListener('click', () => this.exportShubyoData());
        exportButton.addEventListener('mouseover', () => {
            exportButton.style.transform = 'translateY(-1px)';
            exportButton.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.3)';
        });
        exportButton.addEventListener('mouseout', () => {
            exportButton.style.transform = 'translateY(0)';
            exportButton.style.boxShadow = 'none';
        });

        // インポートボタン
        const importButton = document.createElement('button');
        importButton.textContent = '📥 インポート';
        importButton.className = 'import-button';
        importButton.style.cssText = `
            background: linear-gradient(135deg, #007bff, #6f42c1);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        `;
        importButton.addEventListener('click', () => this.importShubyoData());
        importButton.addEventListener('mouseover', () => {
            importButton.style.transform = 'translateY(-1px)';
            importButton.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
        });
        importButton.addEventListener('mouseout', () => {
            importButton.style.transform = 'translateY(0)';
            importButton.style.boxShadow = 'none';
        });

        // クリアボタン
        const clearButton = document.createElement('button');
        clearButton.textContent = '🗑️ 全削除';
        clearButton.className = 'clear-button';
        clearButton.style.cssText = `
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        `;
        clearButton.addEventListener('click', () => this.clearAllShubyoData());
        clearButton.addEventListener('mouseover', () => {
            clearButton.style.transform = 'translateY(-1px)';
            clearButton.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.3)';
        });
        clearButton.addEventListener('mouseout', () => {
            clearButton.style.transform = 'translateY(0)';
            clearButton.style.boxShadow = 'none';
        });

        buttonContainer.appendChild(exportButton);
        buttonContainer.appendChild(importButton);
        buttonContainer.appendChild(clearButton);
        managementDiv.appendChild(buttonContainer);

        container.appendChild(managementDiv);
    }

    addPopupToLayer(layer, metadata) {
        this.map.on('click', layer.id, (e) => {
            const features = e.features;
            if (features.length > 0) {
                const feature = features[0];
                const properties = feature.properties;
                const featureId = properties.id;
                const locationName = properties.name;
                
                // 収鋲状態を確認
                const metadataId = metadata?.id;
                let isAlreadyShubyo = false;
                if (metadataId) {
                    const history = this.getShubyoHistory(metadataId, featureId);
                    isAlreadyShubyo = history.length > 0;
                }

                // リッチなポップアップコンテンツを作成
                let popupContent = `
                    <div style="
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        min-width: 280px;
                        max-width: 350px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        margin: -15px;
                    ">
                        <!-- ヘッダー部分 -->
                        <div style="
                            background: rgba(255,255,255,0.95);
                            padding: 16px;
                            border-bottom: 1px solid rgba(0,0,0,0.1);
                        ">
                            <div style="
                                display: flex;
                                align-items: center;
                                margin-bottom: 8px;
                            ">
                                <div style="
                                    width: 40px;
                                    height: 40px;
                                    background: linear-gradient(135deg, #667eea, #764ba2);
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    margin-right: 12px;
                                    color: white;
                                    font-size: 18px;
                                    font-weight: bold;
                                ">
                                    🏛️
                                </div>
                                <div style="flex: 1;">
                                    <h3 style="
                                        margin: 0;
                                        font-size: 16px;
                                        font-weight: 600;
                                        color: #2c3e50;
                                        line-height: 1.3;
                                    ">${locationName}</h3>
                                    <div style="
                                        font-size: 12px;
                                        color: #7f8c8d;
                                        margin-top: 2px;
                                    ">${layer.name}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- コンテンツ部分 -->
                        <div style="
                            background: rgba(255,255,255,0.98);
                            padding: 16px;
                        ">
                `;

                // プロパティを整理して表示
                const displayProperties = Object.entries(properties).filter(([key, value]) => 
                    key !== 'id' && key !== 'name' && value && value.toString().trim() !== ''
                );

                displayProperties.forEach(([key, value]) => {
                    let icon = '📍';
                    let label = key;
                    
                    // キーに応じてアイコンとラベルを設定
                    switch(key.toLowerCase()) {
                        case 'name':
                            icon = '🏛️';
                            label = '施設名';
                            break;
                        case 'address':
                            icon = '📍';
                            label = '住所';
                            break;
                        case 'phone':
                        case 'tel':
                            icon = '📞';
                            label = '電話番号';
                            break;
                        case 'email':
                            icon = '📧';
                            label = 'メール';
                            break;
                        case 'website':
                        case 'url':
                            icon = '🌐';
                            label = 'ウェブサイト';
                            break;
                        case 'type':
                            icon = '🏷️';
                            label = '種別';
                            break;
                        case 'country':
                            icon = '🇯🇵';
                            label = '国';
                            break;
                    }
                    
                    popupContent += `
                        <div style="
                            display: flex;
                            align-items: flex-start;
                            margin-bottom: 12px;
                            padding: 8px;
                            background: #f8f9fa;
                            border-radius: 8px;
                            border-left: 3px solid #667eea;
                        ">
                            <span style="
                                font-size: 16px;
                                margin-right: 10px;
                                margin-top: 2px;
                            ">${icon}</span>
                            <div style="flex: 1;">
                                <div style="
                                    font-size: 12px;
                                    color: #6c757d;
                                    font-weight: 500;
                                    margin-bottom: 4px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                ">${label}</div>
                                <div style="
                                    font-size: 14px;
                                    color: #2c3e50;
                                    line-height: 1.4;
                                    word-break: break-word;
                                ">${value}</div>
                            </div>
                        </div>
                    `;
                });

                // 収鋲状態表示
                if (isAlreadyShubyo) {
                    popupContent += `
                        <div style="
                            background: linear-gradient(135deg, #d4edda, #c3e6cb);
                            border: 1px solid #c3e6cb;
                            border-radius: 8px;
                            padding: 12px;
                            margin: 12px 0;
                            display: flex;
                            align-items: center;
                        ">
                            <span style="
                                font-size: 20px;
                                margin-right: 10px;
                            ">✅</span>
                            <div>
                                <div style="
                                    font-weight: 600;
                                    color: #155724;
                                    font-size: 14px;
                                ">収鋲済み</div>
                                <div style="
                                    font-size: 12px;
                                    color: #155724;
                                    opacity: 0.8;
                                ">このポイントは既に収鋲されています</div>
                            </div>
                        </div>
                    `;
                }

                // ボタン部分
                popupContent += `
                            <div style="
                                display: flex;
                                flex-direction: column;
                                gap: 8px;
                                margin-top: 16px;
                            ">
                `;

                // Googleマップで開くボタン（常に表示）
                const coordinates = feature.geometry.coordinates;
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;
                
                popupContent += `
                    <button onclick="window.open('${googleMapsUrl}', '_blank');" 
                        style="
                            background: linear-gradient(135deg, #34a853, #2d8f47);
                            color: white;
                            border: none;
                            padding: 10px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            transition: all 0.3s ease;
                            box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(52, 168, 83, 0.4)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(52, 168, 83, 0.3)';"
                    >
                        <span style="font-size: 14px;">🗺️</span>
                        Googleマップで開く
                    </button>
                `;

                // 収鋲/収鋲解除ボタンのコンテナ
                popupContent += `
                    <div style="
                        display: flex;
                        gap: 8px;
                    ">
                `;

                if (isAlreadyShubyo) {
                    // 収鋲解除ボタン
                    popupContent += `
                        <button onclick="window.mapViewer.removeShubyoFromLocation('${metadataId}', '${featureId}', '${locationName.replace(/'/g, "\\'")}'); document.querySelector('.maplibregl-popup').remove();" 
                            style="
                                flex: 1;
                                background: linear-gradient(135deg, #e74c3c, #c0392b);
                                color: white;
                                border: none;
                                padding: 12px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 600;
                                transition: all 0.3s ease;
                                box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 6px;
                            "
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(231, 76, 60, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(231, 76, 60, 0.3)';"
                        >
                            <span style="font-size: 16px;">🗑️</span>
                            収鋲解除
                        </button>
                    `;
                } else {
                    // 収鋲ボタン
                    popupContent += `
                        <button onclick="window.mapViewer.shubyoToLocation('${metadataId}', '${featureId}', '${locationName.replace(/'/g, "\\'")}'); document.querySelector('.maplibregl-popup').remove();" 
                            style="
                                flex: 1;
                                background: linear-gradient(135deg, #3498db, #2980b9);
                                color: white;
                                border: none;
                                padding: 12px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 600;
                                transition: all 0.3s ease;
                                box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 6px;
                            "
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(52, 152, 219, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(52, 152, 219, 0.3)';"
                        >
                            <span style="font-size: 16px;">📍</span>
                            収鋲する
                        </button>
                    `;
                }

                popupContent += `
                    </div>
                </div>`;

                popupContent += `
                        </div>
                    </div>
                `;

                const popup = new maplibregl.Popup({
                    maxWidth: '400px',
                    className: 'rich-popup'
                })
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

        // レイヤー状態を更新
        layer.visible = visible;

        if (visible) {
            if (!this.loadedLayers.has(layerId)) {
                await this.loadLayer(layer);
            }
            this.showLayer(layerId);
        } else {
            this.hideLayer(layerId);
        }

        // レイヤー状態を保存
        this.saveLayerStates();
    }

    showLayer(layerId) {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'visible');
            // フィルターも再適用
            this.updateLayerFilter(layerId);
            // 収鋲スタイルも再適用
            const geojsonData = this.layerData.get(layerId);
            if (geojsonData?.metadata) {
                this.updateShubyoStyle(layerId, geojsonData.metadata);
            }
        }
    }

    hideLayer(layerId) {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    }

    // レイヤー状態の保存・読み込み機能
    loadLayerStates() {
        const saved = localStorage.getItem('shubyo-layer-states');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error('Error parsing saved layer states:', error);
                return {};
            }
        }
        return {};
    }

    saveLayerStates() {
        const layerStates = {};
        
        LAYER_CONFIG.forEach(layer => {
            layerStates[layer.id] = {
                visible: layer.visible,
                activeFilters: Array.from(this.activeLayerFilters.get(layer.id) || [])
            };
        });
        
        localStorage.setItem('shubyo-layer-states', JSON.stringify(layerStates));
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

    // 収鋲関連機能
    loadShubyoData() {
        const saved = localStorage.getItem('shubyo-data');
        return saved ? JSON.parse(saved) : {};
    }

    saveShubyoData() {
        localStorage.setItem('shubyo-data', JSON.stringify(this.checkinData));
    }

    // マップ状態の保存・読み込み機能
    loadMapState() {
        const saved = localStorage.getItem('shubyo-map-state');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error('Error parsing saved map state:', error);
                return {};
            }
        }
        return {};
    }

    saveMapState() {
        if (!this.map) return;
        
        const mapState = {
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            bearing: this.map.getBearing(),
            pitch: this.map.getPitch(),
            timestamp: Date.now()
        };
        
        localStorage.setItem('shubyo-map-state', JSON.stringify(mapState));
    }

    shubyoToLocation(layerId, featureId, locationName) {
        // layerIdまたはfeatureIdがundefinedや空文字列の場合の処理
        if (!layerId || layerId === 'undefined') {
            console.error('Invalid layerId (metadata.id):', layerId);
            this.showSuccessMessage('収鋲に失敗しました：レイヤーIDが無効です');
            return;
        }
        
        if (!featureId || featureId === '' || featureId === 'undefined') {
            console.error('Invalid featureId:', featureId);
            this.showSuccessMessage('収鋲に失敗しました：フィーチャーIDが無効です');
            return;
        }
        
        // シンプルなJSON形式で保存: {metadataId: [id1, id2, id3]}
        if (!this.checkinData[layerId]) {
            this.checkinData[layerId] = [];
        }
        
        // featureIdを文字列として保存
        const featureIdStr = String(featureId);
        
        // 重複チェック
        if (!this.checkinData[layerId].includes(featureIdStr)) {
            this.checkinData[layerId].push(featureIdStr);
        }
        
        this.saveShubyoData();
        this.showSuccessMessage(`${locationName}を収鋲しました！`);
        
        // 収鋲後にスタイルを更新
        this.updateAllShubyoStyles();
    }

    removeShubyoFromLocation(layerId, featureId, locationName) {
        // layerIdまたはfeatureIdがundefinedや空文字列の場合の処理
        if (!layerId || layerId === 'undefined') {
            console.error('Invalid layerId (metadata.id):', layerId);
            this.showSuccessMessage('収鋲解除に失敗しました：レイヤーIDが無効です');
            return;
        }
        
        if (!featureId || featureId === '' || featureId === 'undefined') {
            console.error('Invalid featureId:', featureId);
            this.showSuccessMessage('収鋲解除に失敗しました：フィーチャーIDが無効です');
            return;
        }
        
        // 収鋲データが存在しない場合は何もしない
        if (!this.checkinData[layerId]) {
            this.showSuccessMessage(`${locationName}は収鋲されていません`);
            return;
        }
        
        // featureIdを文字列として処理
        const featureIdStr = String(featureId);
        
        // 配列から該当のIDを削除
        const index = this.checkinData[layerId].indexOf(featureIdStr);
        if (index > -1) {
            this.checkinData[layerId].splice(index, 1);
            this.saveShubyoData();
            this.showSuccessMessage(`${locationName}の収鋲を解除しました！`);
            
            // 収鋲解除後にスタイルを更新
            this.updateAllShubyoStyles();
        } else {
            this.showSuccessMessage(`${locationName}は収鋲されていません`);
        }
    }

    updateAllShubyoStyles() {
        // 全ての読み込まれたレイヤーの収鋲スタイルを更新
        for (const layerId of this.loadedLayers) {
            const geojsonData = this.layerData.get(layerId);
            if (geojsonData?.metadata) {
                this.updateShubyoStyle(layerId, geojsonData.metadata);
            }
        }
    }

    updateShubyoStyle(layerId, metadata) {
        if (!this.map.getLayer(layerId) || !metadata?.id) return;
        
        const shubyoIds = this.checkinData[metadata.id] || [];
        
        if (shubyoIds.length > 0) {
            // 文字列と数値の両方に対応するため、すべて文字列に変換
            const shubyoIdsAsStrings = shubyoIds.map(id => String(id));
            
            // 収鋲済みのポイントをソフトな赤色にするフィルター式
            const strokeColorExpression = [
                'case',
                ['in', ['to-string', ['get', 'id']], ['literal', shubyoIdsAsStrings]],
                '#ff6b6b', // 収鋲済みはソフトな赤色
                'rgba(255, 255, 255, 0.8)'  // 未収鋲は半透明の白色
            ];
            
            // ストローク幅も調整（より細く）
            const strokeWidthExpression = [
                'case',
                ['in', ['to-string', ['get', 'id']], ['literal', shubyoIdsAsStrings]],
                2.5, // 収鋲済みは少し太め
                1.5  // 未収鋲は細め
            ];
            
            // circle-stroke-colorとwidthを動的に設定
            this.map.setPaintProperty(layerId, 'circle-stroke-color', strokeColorExpression);
            this.map.setPaintProperty(layerId, 'circle-stroke-width', strokeWidthExpression);
            
            // 円の透明度も少し調整
            this.map.setPaintProperty(layerId, 'circle-opacity', 0.9);
            this.map.setPaintProperty(layerId, 'circle-stroke-opacity', 0.8);
        } else {
            // 収鋲済みがない場合はデフォルトの半透明白色
            this.map.setPaintProperty(layerId, 'circle-stroke-color', 'rgba(255, 255, 255, 0.8)');
            this.map.setPaintProperty(layerId, 'circle-stroke-width', 1.5);
            this.map.setPaintProperty(layerId, 'circle-opacity', 0.9);
            this.map.setPaintProperty(layerId, 'circle-stroke-opacity', 0.8);
        }
    }

    getShubyoHistory(layerId, featureId) {
        const shubyoIds = this.checkinData[layerId] || [];
        // featureIdを文字列として比較（保存時に文字列化しているため）
        const featureIdStr = String(featureId);
        const isShubyo = shubyoIds.includes(featureIdStr);
        return isShubyo ? [{ status: 'shubyo' }] : [];
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
        `;
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        // 3秒後に自動で削除
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // 収鋲データのエクスポート（テキストベース）
    exportShubyoData() {
        try {
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                shubyoData: this.checkinData,
                totalPoints: Object.values(this.checkinData).reduce((sum, points) => sum + points.length, 0)
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            
            // モバイル対応のテキストエクスポート
            this.showTextExportModal(dataStr, exportData.totalPoints);
            
        } catch (error) {
            console.error('Export error:', error);
            this.showErrorMessage('エクスポートに失敗しました');
        }
    }

    // テキストエクスポート用モーダル表示
    showTextExportModal(dataStr, totalPoints) {
        // モーダル背景
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        // モーダルコンテンツ
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        `;

        // ヘッダー
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e9ecef;
        `;

        const title = document.createElement('h3');
        title.textContent = `収鋲データエクスポート (${totalPoints}ポイント)`;
        title.style.cssText = `
            margin: 0;
            color: #495057;
            font-size: 16px;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #6c757d;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.addEventListener('click', () => document.body.removeChild(modalOverlay));

        header.appendChild(title);
        header.appendChild(closeButton);

        // 説明文
        const description = document.createElement('p');
        description.textContent = 'このテキストをコピーして保存してください。インポート時に使用できます。';
        description.style.cssText = `
            margin: 0 0 15px 0;
            color: #6c757d;
            font-size: 14px;
        `;

        // テキストエリア
        const textarea = document.createElement('textarea');
        textarea.value = dataStr;
        textarea.readOnly = true;
        textarea.style.cssText = `
            width: 100%;
            height: 300px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: none;
            background: #f8f9fa;
            box-sizing: border-box;
        `;

        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 15px;
        `;

        // コピーボタン
        const copyButton = document.createElement('button');
        copyButton.textContent = '📋 クリップボードにコピー';
        copyButton.style.cssText = `
            flex: 1;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        `;
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(dataStr);
                copyButton.textContent = '✅ コピー完了';
                setTimeout(() => {
                    copyButton.textContent = '📋 クリップボードにコピー';
                }, 2000);
            } catch (error) {
                // フォールバック: テキストエリアを選択
                textarea.select();
                document.execCommand('copy');
                copyButton.textContent = '✅ コピー完了';
                setTimeout(() => {
                    copyButton.textContent = '📋 クリップボードにコピー';
                }, 2000);
            }
        });

        // ダウンロードボタン（デスクトップ用）
        const downloadButton = document.createElement('button');
        downloadButton.textContent = '💾 ファイルダウンロード';
        downloadButton.style.cssText = `
            background: linear-gradient(135deg, #007bff, #6f42c1);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        `;
        downloadButton.addEventListener('click', () => {
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `shubyo-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });

        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(downloadButton);

        modal.appendChild(header);
        modal.appendChild(description);
        modal.appendChild(textarea);
        modal.appendChild(buttonContainer);
        modalOverlay.appendChild(modal);

        // ESCキーで閉じる
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modalOverlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // オーバーレイクリックで閉じる
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
                document.removeEventListener('keydown', handleEscape);
            }
        });

        document.body.appendChild(modalOverlay);
        
        // テキストエリアを選択状態にする
        setTimeout(() => textarea.select(), 100);
    }

    // 収鋲データのインポート（テキスト＆ファイル対応）
    importShubyoData() {
        // インポート方法選択モーダル
        this.showImportModal();
    }

    // インポート方法選択モーダル
    showImportModal() {
        // モーダル背景
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        // モーダルコンテンツ
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        `;

        // ヘッダー
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e9ecef;
        `;

        const title = document.createElement('h3');
        title.textContent = '収鋲データインポート';
        title.style.cssText = `
            margin: 0;
            color: #495057;
            font-size: 16px;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #6c757d;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.addEventListener('click', () => document.body.removeChild(modalOverlay));

        header.appendChild(title);
        header.appendChild(closeButton);

        // 説明文
        const description = document.createElement('p');
        description.textContent = 'エクスポートしたデータをテキストで貼り付けるか、ファイルを選択してください。';
        description.style.cssText = `
            margin: 0 0 15px 0;
            color: #6c757d;
            font-size: 14px;
        `;

        // テキストエリア
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'エクスポートしたJSONデータをここに貼り付けてください...';
        textarea.style.cssText = `
            width: 100%;
            height: 200px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: none;
            box-sizing: border-box;
            margin-bottom: 15px;
        `;

        // ファイル選択ボタン
        const fileButton = document.createElement('button');
        fileButton.textContent = '📁 ファイルを選択';
        fileButton.style.cssText = `
            background: linear-gradient(135deg, #6c757d, #495057);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 15px;
            width: 100%;
        `;
        fileButton.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    textarea.value = e.target.result;
                };
                reader.readAsText(file);
            };
            input.click();
        });

        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
        `;

        // インポートボタン
        const importButton = document.createElement('button');
        importButton.textContent = '📥 インポート実行';
        importButton.style.cssText = `
            flex: 1;
            background: linear-gradient(135deg, #007bff, #6f42c1);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        `;
        importButton.addEventListener('click', () => {
            this.processImportData(textarea.value);
            document.body.removeChild(modalOverlay);
        });

        // キャンセルボタン
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'キャンセル';
        cancelButton.style.cssText = `
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        `;
        cancelButton.addEventListener('click', () => document.body.removeChild(modalOverlay));

        buttonContainer.appendChild(importButton);
        buttonContainer.appendChild(cancelButton);

        modal.appendChild(header);
        modal.appendChild(description);
        modal.appendChild(textarea);
        modal.appendChild(fileButton);
        modal.appendChild(buttonContainer);
        modalOverlay.appendChild(modal);

        // ESCキーで閉じる
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modalOverlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // オーバーレイクリックで閉じる
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
                document.removeEventListener('keydown', handleEscape);
            }
        });

        document.body.appendChild(modalOverlay);
    }

    // インポートデータの処理
    processImportData(dataText) {
        if (!dataText.trim()) {
            this.showErrorMessage('データが入力されていません');
            return;
        }

        try {
            const importData = JSON.parse(dataText);
            
            // データ形式の検証
            if (!importData.shubyoData || typeof importData.shubyoData !== 'object') {
                throw new Error('無効なデータ形式です');
            }

            // 確認ダイアログ
            const currentPoints = Object.values(this.checkinData).reduce((sum, points) => sum + points.length, 0);
            const importPoints = Object.values(importData.shubyoData).reduce((sum, points) => sum + points.length, 0);
            
            const confirmMessage = `現在の収鋲データ（${currentPoints}ポイント）を、インポートデータ（${importPoints}ポイント）で置き換えますか？\n\n※この操作は元に戻せません。`;
            
            if (confirm(confirmMessage)) {
                this.checkinData = importData.shubyoData;
                this.saveShubyoData();
                this.updateAllShubyoStyles();
                
                this.showSuccessMessage(`収鋲データをインポートしました（${importPoints}ポイント）`);
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showErrorMessage('インポートに失敗しました: ' + error.message);
        }
    }

    // 全収鋲データのクリア
    clearAllShubyoData() {
        const currentPoints = Object.values(this.checkinData).reduce((sum, points) => sum + points.length, 0);
        
        if (currentPoints === 0) {
            this.showSuccessMessage('削除する収鋲データがありません');
            return;
        }

        const confirmMessage = `すべての収鋲データ（${currentPoints}ポイント）を削除しますか？\n\n※この操作は元に戻せません。`;
        
        if (confirm(confirmMessage)) {
            this.checkinData = {};
            this.saveShubyoData();
            this.updateAllShubyoStyles();
            
            this.showSuccessMessage(`すべての収鋲データを削除しました（${currentPoints}ポイント）`);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    window.mapViewer = new GeoJSONMapViewer();
});
