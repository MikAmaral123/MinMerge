document.addEventListener('DOMContentLoaded', () => {
    const addPackBtn = document.getElementById('addPackBtn');
    const mergeBtn = document.getElementById('mergeBtn');
    const layerList = document.getElementById('layerList');
    const fileInput = document.getElementById('fileInput');

    // --- Language Logic ---
    let currentLang = localStorage.getItem('minemerge_lang') || 'en';

    // Check if user has a preferred language and no saved preference
    if (!localStorage.getItem('minemerge_lang')) {
        const browserLang = navigator.language.split('-')[0];
        if (['fr', 'es'].includes(browserLang)) {
            currentLang = browserLang;
        }
    }

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('minemerge_lang', lang);
        updateInterface();
        updateActiveButton();
    }

    // Expose to global scope for HTML buttons
    window.setLanguage = setLanguage;

    function updateActiveButton() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    function updateInterface() {
        if (typeof translations === 'undefined') return;
        const t = translations[currentLang];

        // Text Content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = resolveKey(t, key);
            if (value) el.textContent = value;
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const value = resolveKey(t, key);
            if (value) el.placeholder = value;
        });

        // Re-render empty state if needed
        if (packs.length === 0) renderPacks();
    }

    function resolveKey(obj, path) {
        return path.split('.').reduce((o, key) => (o && o[key] ? o[key] : null), obj);
    }


    // --- Core Logic ---
    let packs = [];
    let draggedPackId = null;

    addPackBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });

    const packIconInput = document.getElementById('packIconInput');
    const iconLabelText = document.getElementById('iconLabelText');

    if (packIconInput) {
        packIconInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                // Update icon label with filename
                // Need to respect markup: <icon> Label
                // But we only want to change the text part. 
                // Let's force re-render via i18n logic? 
                // Or just append filename.
                const filename = e.target.files[0].name;
                // Simple hack: update UI, but keep icon
                iconLabelText.innerHTML = `<i data-lucide="image" style="width: 16px; height: 16px; margin-right: 8px; display: inline-block;"></i> ${filename}`;
                lucide.createIcons();
            }
        });
    }

    // Drag & Drop on Container
    layerList.addEventListener('dragover', (e) => {
        e.preventDefault();
        layerList.style.borderColor = 'var(--primary)';
        layerList.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
    });

    layerList.addEventListener('dragleave', () => {
        layerList.style.borderColor = '';
        layerList.style.backgroundColor = '';
    });

    layerList.addEventListener('drop', (e) => {
        e.preventDefault();
        layerList.style.borderColor = '';
        layerList.style.backgroundColor = '';
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    mergeBtn.addEventListener('click', async () => {
        if (packs.length === 0) {
            const t = translations[currentLang];
            alert(currentLang === 'fr' ? 'Ajoutez au moins un pack.' : (currentLang === 'es' ? 'Añade al menos un pack.' : 'Please add at least one Resource Pack.'));
            return;
        }
        await mergePacks();
    });

    // --- Pack Management ---

    async function handleFiles(fileList) {
        for (const file of Array.from(fileList)) {
            if (file.name.endsWith('.zip')) {
                await addPack(file);
            } else {
                alert(`File ${file.name} is not a valid .zip file.`);
            }
        }
        renderPacks();
    }

    async function addPack(file) {
        try {
            const buffer = await file.arrayBuffer();
            const id = Math.random().toString(36).substr(2, 9);
            packs.unshift({
                id: id,
                name: file.name,
                data: buffer,
                size: file.size
            });
        } catch (e) {
            console.error("Error reading file:", e);
        }
    }

    function removePack(id) {
        packs = packs.filter(p => p.id !== id);
        renderPacks();
    }

    function movePackUp(id) {
        const index = packs.findIndex(p => p.id === id);
        if (index > 0) {
            [packs[index - 1], packs[index]] = [packs[index], packs[index - 1]];
            renderPacks();
        }
    }

    function movePackDown(id) {
        const index = packs.findIndex(p => p.id === id);
        if (index < packs.length - 1) {
            [packs[index], packs[index + 1]] = [packs[index + 1], packs[index]];
            renderPacks();
        }
    }

    function reorderPack(fromId, toId) {
        const fromIndex = packs.findIndex(p => p.id === fromId);
        const toIndex = packs.findIndex(p => p.id === toId);
        if (fromIndex !== -1 && toIndex !== -1) {
            const [movedItem] = packs.splice(fromIndex, 1);
            packs.splice(toIndex, 0, movedItem);
            renderPacks();
        }
    }

    function renderPacks() {
        layerList.innerHTML = '';
        const t = translations[currentLang];

        if (packs.length === 0) {
            layerList.innerHTML = `
                <div class="empty-state">
                    <p>${t.empty_state}</p>
                </div>`;
            return;
        }

        packs.forEach((pack, index) => {
            const item = document.createElement('div');
            item.className = 'layer-item glass-panel';
            item.draggable = true;
            item.dataset.id = pack.id;

            item.innerHTML = `
                <div class="drag-handle" title="Drag to reorder">
                    <i data-lucide="grip-vertical"></i>
                </div>
                <div class="layer-info">
                    <span class="layer-name">${pack.name}</span>
                    <span class="layer-size">${(pack.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="layer-actions">
                    <button class="icon-btn up-btn" title="Move Up" ${index === 0 ? 'disabled' : ''}><i data-lucide="chevron-up"></i></button>
                    <button class="icon-btn down-btn" title="Move Down" ${index === packs.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-down"></i></button>
                    <button class="icon-btn delete-btn" title="Remove"><i data-lucide="x"></i></button>
                </div>
            `;

            // Event Bindings
            item.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); removePack(pack.id); });
            item.querySelector('.up-btn').addEventListener('click', (e) => { e.stopPropagation(); movePackUp(pack.id); });
            item.querySelector('.down-btn').addEventListener('click', (e) => { e.stopPropagation(); movePackDown(pack.id); });

            // Drag
            item.addEventListener('dragstart', (e) => {
                if (!e.target.closest('.drag-handle')) { e.preventDefault(); return; }
                draggedPackId = pack.id;
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                draggedPackId = null;
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('drop', (e) => {
                if (e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                e.stopPropagation();
                if (draggedPackId && draggedPackId !== pack.id) {
                    reorderPack(draggedPackId, pack.id);
                }
            });

            layerList.appendChild(item);
        });

        lucide.createIcons();
    }

    async function mergePacks() {
        const originalText = mergeBtn.innerText;
        mergeBtn.innerText = 'Converting...'; // Could be translated too but simple spin is enough
        mergeBtn.disabled = true;

        try {
            const zip = new JSZip();
            const packsProcessingOrder = [...packs].reverse();

            for (const pack of packsProcessingOrder) {
                const packZip = await JSZip.loadAsync(pack.data);
                packZip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir) {
                        zip.file(relativePath, zipEntry.async('arraybuffer'));
                    }
                });
            }

            // Icon
            const packIconInput = document.getElementById('packIconInput');
            if (packIconInput && packIconInput.files.length > 0) {
                const iconBuffer = await packIconInput.files[0].arrayBuffer();
                zip.file("pack.png", iconBuffer);
            } else {
                const defaultIconBuffer = await createDefaultIcon();
                zip.file("pack.png", defaultIconBuffer);
            }

            // MCMeta
            const customMcmeta = JSON.stringify({
                pack: {
                    pack_format: 15,
                    description: "Merged with MineMerge"
                }
            }, null, 4);
            // Only write if not exists or overwrite? We overwrite because it's a merge
            // But usually we respect topmost mcmeta. Let's just create a new one if merging.
            // Actually, keep it simple: Let the files overwrite themselves. But pack.mcmeta is root.
            // Let's force our description to indicate it's merged.
            zip.file("pack.mcmeta", customMcmeta);

            // Name
            const packNameInput = document.getElementById('packNameInput');
            let packName = packNameInput.value.trim() || 'MineMerge_Pack';
            if (!packName.endsWith('.zip')) packName += '.zip';

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, packName);

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            mergeBtn.innerText = originalText;
            mergeBtn.disabled = false;
        }
    }

    function createDefaultIcon() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 64, 64);
            gradient.addColorStop(0, '#06b6d4');
            gradient.addColorStop(1, '#8b5cf6');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', 32, 34);

            canvas.toBlob(async (blob) => {
                resolve(await blob.arrayBuffer());
            }, 'image/png');
        });
    }

    // Initialize
    updateInterface();
    updateActiveButton();
});
