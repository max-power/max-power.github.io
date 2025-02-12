const application = Stimulus.Application.start();

application.register("district-map", class extends Stimulus.Controller {
    static targets = ["districtList", "map"];

    connect() {
        this.initMap();
        this.districts = [];
        this.allShapes = {};  // Store individual postal code shapes
        this.districtBoundaries = {};  // Store combined district boundaries
        this.currentDistrict = null;  // Track the currently selected district
        this.loadDistricts();
    }

    initMap() {
        this.map = L.map(this.mapTarget, { minZoom: 7 }).setView([52.52, 13.405], 11);

        L.tileLayer('https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', {
            attribution: 'Map data: &copy; <a href="http://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>'
        }).addTo(this.map);
    }

    loadDistricts() {
		const basePath = window.location.origin + window.location.pathname;
		fetch(`${basePath}/districts.json`)
            .then(response => response.json())
            .then(data => {
                this.districts = data;
                this.populateDistrictsList();
                this.loadGeoJsonForDistricts();
            })
            .catch(error => console.error("Error loading districts:", error));
    }

    populateDistrictsList() {
        this.districts.forEach(district => {
            const li = document.createElement('li');
            li.innerHTML = `<code>${district.abbr}</code> <span>${district.name}</span>`;
            li.dataset.district = district.name;
            li.addEventListener('click', () => this.toggleDistrictSelection(district, li));
            this.districtListTarget.appendChild(li);
        });
    }

    loadGeoJsonForDistricts() {
        const allBounds = L.latLngBounds();
        this.districts.forEach(district => {
            const shapeLayers = [];
            district.postal_codes.forEach(postalCode => {
                if (!this.allShapes[postalCode]) {
                    this.loadGeoJson(postalCode, district.name, shapeLayers);
                }
            });

            setTimeout(() => {
                if (shapeLayers.length) {
                    const boundary = this.createDistrictBoundary(district.name, shapeLayers);
                    if (boundary) allBounds.extend(boundary.getBounds());
                }
            }, 500);
        });

        setTimeout(() => this.fitToBounds(allBounds), 1000);
    }

    loadGeoJson(postalCode, districtName, shapeLayers) {
        fetch(`/shapes/${postalCode}.geojson`)
            .then(response => response.json())
            .then(data => {
                const geoJsonLayer = L.geoJSON(data, {
                    style: { color: "#9467bd", weight: 2, opacity: 0.8, fillOpacity: 0.4 }
                });

                this.addTooltip(geoJsonLayer, postalCode);
                geoJsonLayer.addTo(this.map);
                this.allShapes[postalCode] = geoJsonLayer;
                shapeLayers.push(geoJsonLayer);
            })
            .catch(error => console.error(`Error loading GeoJSON for ${postalCode}:`, error));
    }

    createDistrictBoundary(districtName, shapeLayers) {
        const boundaryLayer = L.featureGroup(shapeLayers);
        const bounds = boundaryLayer.getBounds();

        if (bounds.isValid()) {
            const districtBoundary = L.polygon(bounds, {
                color: "#ff0000", weight: 4, fillOpacity: 0
            });

            this.addTooltip(districtBoundary, districtName);
            districtBoundary.addTo(this.map);
            this.districtBoundaries[districtName] = districtBoundary;

            return districtBoundary;
        }
        return null;
    }

    toggleDistrictSelection(district, listItem) {
        if (this.currentDistrict === district.name) {
            this.resetView();
            this.currentDistrict = null;
            this.clearSelection();
        } else {
            this.zoomToDistrict(district);
            this.currentDistrict = district.name;
            this.clearSelection();
            listItem.classList.add("selected");
        }
    }

    zoomToDistrict(district) {
        this.toggleLayers(false);  // Hide all layers

        const bounds = L.latLngBounds();
        district.postal_codes.forEach(postalCode => this.toggleLayer(this.allShapes[postalCode], true, bounds));

        const districtBoundary = this.districtBoundaries[district.name];
        if (districtBoundary) this.toggleLayer(districtBoundary, true, bounds);

        this.fitToBounds(bounds);
    }

	resetView() {
	    this.toggleLayers(true);  // Show all layers first

	    setTimeout(() => {  // Ensure rendering before calculating bounds
	        const allBounds = L.latLngBounds();
	        Object.values(this.allShapes).forEach(layer => {
	            if (layer.getBounds().isValid()) allBounds.extend(layer.getBounds());
	        });

	        Object.values(this.districtBoundaries).forEach(layer => {
	            if (layer.getBounds().isValid()) allBounds.extend(layer.getBounds());
	        });

	        this.fitToBounds(allBounds);
	    }, 100);  // Small delay to ensure all layers are added
	}

    toggleLayers(show) {
        Object.values(this.allShapes).forEach(layer => this.toggleLayer(layer, show));
        Object.values(this.districtBoundaries).forEach(layer => this.toggleLayer(layer, show));
    }

    toggleLayer(layer, show, bounds = null) {
        if (!layer) return;
        if (show) {
            layer.addTo(this.map);
            if (bounds) bounds.extend(layer.getBounds());
        } else {
            this.map.removeLayer(layer);
        }
    }

    fitToBounds(bounds) {
        if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
    }

    addTooltip(layer, text) {
        const tooltip = L.tooltip({ permanent: false, direction: "center", className: "tooltip" })
            .setContent(text)
            .setLatLng(layer.getBounds().getCenter());

        layer.on("mouseover", () => this.map.openTooltip(tooltip));
        layer.on("mouseout", () => this.map.closeTooltip(tooltip));
    }

    clearSelection() {
        this.districtListTarget.querySelectorAll("li").forEach(li => li.classList.remove("selected"));
    }
});
