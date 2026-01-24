document.addEventListener('DOMContentLoaded', () => {
    const addPackBtn = document.getElementById('addPackBtn');
    const mergeBtn = document.getElementById('mergeBtn');
    const layerList = document.getElementById('layerList');
    const fileInput = document.getElementById('fileInput');

    // Store loaded packs: { name: string, file: File, id: string }
    // Order in array = Display order (Top of list = Top visual priority)
    // However, for merging, the Top of list should adhere to Minecraft logic:
    // In Minecraft, top pack overrides bottom pack.
    // So Array[0] (Visual: Top) -> Highest Priority.
    let packs = [];
    let draggedPackId = null;

    // --- Event Listeners ---

    addPackBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset to allow same file selection again
    });

    // Drag and Drop support for the list container
    const packIconInput = document.getElementById('packIconInput');
    const iconLabelText = document.getElementById('iconLabelText');

    if (packIconInput) {
        packIconInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                iconLabelText.innerText = e.target.files[0].name;
            } else {
                iconLabelText.innerText = 'Icon (pack.png)';
            }
        });
    }

    layerList.addEventListener('dragover', (e) => {
        e.preventDefault();
        layerList.style.borderColor = 'var(--accent-color)';
        layerList.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    });

    layerList.addEventListener('dragleave', () => {
        layerList.style.borderColor = '';
        layerList.style.backgroundColor = '';
    });

    layerList.addEventListener('drop', (e) => {
        e.preventDefault();
        layerList.style.borderColor = '';
        layerList.style.backgroundColor = '';

        // Handle FILES drop
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    mergeBtn.addEventListener('click', async () => {
        if (packs.length === 0) {
            alert('Please add at least one Resource Pack.');
            return;
        }
        await mergePacks();
    });

    // --- Functions ---

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
            // Add to the START of the array so new files appear at the top (High Priority by default)
            packs.unshift({
                id: id,
                name: file.name,
                data: buffer,
                size: file.size
            });
        } catch (e) {
            console.error("Error reading file:", e);
            alert("Error reading file " + file.name);
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

    function renderPacks() {
        layerList.innerHTML = '';

        if (packs.length === 0) {
            layerList.innerHTML = `
                <div class="empty-state">
                    <p>No packs added. Drag and drop files here.</p>
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="12" r="1"></circle>
                        <circle cx="9" cy="5" r="1"></circle>
                        <circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="12" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle>
                        <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                </div>
                <div class="layer-info">
                    <span class="layer-priority">#${index + 1}</span>
                    <span class="layer-name">${pack.name}</span>
                    <span class="layer-size">${(pack.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="layer-actions">
                    <button class="icon-btn up-btn" title="Move Up" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="icon-btn down-btn" title="Move Down" ${index === packs.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="icon-btn delete-btn" title="Remove">✖</button>
                </div>
            `;

            // Event bindings
            item.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); removePack(pack.id); });
            item.querySelector('.up-btn').addEventListener('click', (e) => { e.stopPropagation(); movePackUp(pack.id); });
            item.querySelector('.down-btn').addEventListener('click', (e) => { e.stopPropagation(); movePackDown(pack.id); });

            // Drag Events
            item.addEventListener('dragstart', (e) => {
                // Only allow drag if starting from handle
                if (!e.target.closest('.drag-handle')) {
                    e.preventDefault();
                    return;
                }

                draggedPackId = pack.id;
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                draggedPackId = null;
                item.classList.remove('dragging');
                document.querySelectorAll('.layer-item').forEach(el => el.style.borderTop = '');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                if (e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                e.stopPropagation();
                if (draggedPackId && draggedPackId !== pack.id) {
                    reorderPack(draggedPackId, pack.id);
                }
            });

            item.addEventListener('dragenter', (e) => {
                if (e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
            });

            layerList.appendChild(item);
        });
    }

    async function mergePacks() {
        const originalText = mergeBtn.innerText;
        mergeBtn.innerText = 'Merging...';
        mergeBtn.disabled = true;

        try {
            const zip = new JSZip();

            // We want to simulate Minecraft's behavior.
            // Packs higher in the list (lower index in our array) override lower ones.
            // So we must process from LAST (lowest priority) to FIRST (highest priority).
            // This way, the files from high priority packs will be written LAST, overwriting previous ones.

            // Reverse copy for iteration
            const packsProcessingOrder = [...packs].reverse();

            for (const pack of packsProcessingOrder) {
                console.log(`Processing ${pack.name}...`);
                // Use stored buffer data
                const packZip = await JSZip.loadAsync(pack.data);

                packZip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir) {
                        // Read content and add to new zip
                        // We use a promise to handle async reading
                        zip.file(relativePath, zipEntry.async('arraybuffer'));
                    }
                });
            }

            // Handle Icon (Custom or Default)
            const packIconInput = document.getElementById('packIconInput');
            if (packIconInput && packIconInput.files.length > 0) {
                const iconFile = packIconInput.files[0];
                const iconBuffer = await iconFile.arrayBuffer();
                zip.file("pack.png", iconBuffer);
            } else {
                // Generate Default Icon
                const defaultIconBuffer = await createDefaultIcon();
                zip.file("pack.png", defaultIconBuffer);
            }

            // Create a generic pack.mcmeta if it doesn't exist or just use the one from the highest priority pack (already handled by overwrite).
            // However, to be safe and ensure the description is correct, let's create a custom one.
            const customMcmeta = JSON.stringify({
                pack: {
                    pack_format: 15, // Defaulting to a recent version, user might want to change this later
                    description: "Merged with MineMerge"
                }
            }, null, 4);

            // Ask user if they want to override the metadata or keep the top one?
            // For now, simpler: file overwriting handles it. The top pack's mcmeta is used. 
            // We only write ONLY IF MISSING, or maybe we append to description?
            // Let's stick to: "Top pack wins everything", simplest mental model.

            // Get pack name from input
            const packNameInput = document.getElementById('packNameInput');
            let packName = packNameInput.value.trim() || 'MineMerge_Pack';
            if (!packName.endsWith('.zip')) {
                packName += '.zip';
            }

            // Generate file
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, packName);

            alert('Merge completed successfully!');

        } catch (err) {
            console.error(err);
            alert('An error occurred during merge: ' + err.message);
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

            // Gradient Background
            const gradient = ctx.createLinearGradient(0, 0, 64, 64);
            gradient.addColorStop(0, '#3b82f6'); // Blue
            gradient.addColorStop(1, '#0f172a'); // Dark Slate
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);

            // Accessorize borders
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 64, 64);

            // Text "M"
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', 32, 34); // Centered

            // Convert to ArrayBuffer
            canvas.toBlob(async (blob) => {
                resolve(await blob.arrayBuffer());
            }, 'image/png');
        });
    }
});
