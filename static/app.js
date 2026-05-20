document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const scrapeForm = document.getElementById('scrape-form');
    const submitBtn = document.getElementById('submit-btn');
    const concurrencyInput = document.getElementById('concurrency');
    const concurrencyVal = document.getElementById('concurrency-val');
    const terminalOutput = document.getElementById('terminal-output');
    const clearConsoleBtn = document.getElementById('clear-console');
    
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Result panels & containers
    const resultsActions = document.getElementById('results-actions');
    const resultsCount = document.getElementById('results-count');
    const cardsContainer = document.getElementById('cards-container');
    const tableBody = document.getElementById('table-body');
    const jsonOutput = document.getElementById('json-output');
    
    // Empty states
    const gridEmpty = document.getElementById('grid-empty-state');
    const tableEmpty = document.getElementById('table-empty-state');
    const jsonEmpty = document.getElementById('json-empty-state');
    
    // Wrappers
    const tableWrapper = document.getElementById('table-wrapper');
    const jsonWrapper = document.getElementById('json-wrapper');
    
    // Export buttons
    const downloadCsvBtn = document.getElementById('download-csv');
    const downloadExcelBtn = document.getElementById('download-excel');
    const downloadJsonBtn = document.getElementById('download-json');
    const noWebsiteFilter = document.getElementById('no-website-filter');
    
    // History elements
    const historyTableBody = document.getElementById('history-table-body');
    const clearHistoryBtn = document.getElementById('clear-history');

    // Global state
    let scrapedData = [];

    // Concurrency slider badge update
    concurrencyInput.addEventListener('input', (e) => {
        concurrencyVal.textContent = e.target.value;
    });

    // Clear terminal console
    clearConsoleBtn.addEventListener('click', () => {
        terminalOutput.innerHTML = '';
        logTerminal('Console cleared.', 'system');
    });

    // Switch tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetTab = document.getElementById(tab.dataset.tab);
            targetTab.classList.add('active');
        });
    });

    // Filter checkbox listener
    if (noWebsiteFilter) {
        noWebsiteFilter.addEventListener('change', () => {
            const filtered = getFilteredData();
            logTerminal(`Filter toggled. Showing ${filtered.length} of ${scrapedData.length} listings (No website only).`, 'info');
            renderFilteredResults();
        });
    }

    // Helper: Add log to terminal
    function logTerminal(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        line.innerText = `[${timestamp}] ${message}`;
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Submit form handler
    scrapeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = document.getElementById('query').value.trim();
        const maxPlaces = document.getElementById('max-places').value;
        const lang = document.getElementById('lang').value;
        const headless = document.getElementById('headless').checked;
        const concurrency = concurrencyInput.value;

        if (!query) {
            logTerminal('Error: Search query is required.', 'error');
            return;
        }

        // Setup loading UI
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').classList.add('hidden');
        submitBtn.querySelector('.btn-loader').classList.remove('hidden');

        logTerminal(`Starting scraping task for query: "${query}"`, 'system');
        logTerminal(`Config: Lang=${lang}, Headless=${headless}, MaxResults=${maxPlaces || 'unlimited'}, Concurrency=${concurrency}`, 'info');
        logTerminal('Initializing browser via API backend...', 'info');

        // Virtual loader updates to keep UI alive (FastAPI scrapes synchronously in single requests)
        let virtualStepsCount = 0;
        const stepInterval = setInterval(() => {
            virtualStepsCount++;
            if (virtualStepsCount === 2) {
                logTerminal('Browser launched successfully. Loading Google Maps search results...', 'info');
            } else if (virtualStepsCount === 5) {
                logTerminal('Locating listings list in Google Maps feed container...', 'info');
            } else if (virtualStepsCount === 8) {
                logTerminal('Scrolling down feed container to retrieve listing cards...', 'info');
            } else if (virtualStepsCount === 12) {
                logTerminal('Scroll depth reached. Extracting listing links...', 'info');
            } else if (virtualStepsCount === 16) {
                logTerminal('Concurrently loading place details in multiple tabs...', 'info');
            } else if (virtualStepsCount === 24) {
                logTerminal('Scraping addresses, phones, ratings, websites, and opening hours...', 'info');
            } else if (virtualStepsCount === 32) {
                logTerminal('Processing extraction results and formatting responses...', 'info');
            }
        }, 3000);

        try {
            // Build GET request params
            const params = new URLSearchParams({
                query: query,
                lang: lang,
                headless: headless,
                concurrency: concurrency
            });
            if (maxPlaces) {
                params.append('max_places', maxPlaces);
            }

            const response = await fetch(`/scrape-get?${params.toString()}`);
            
            clearInterval(stepInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Server returned ${response.status}`);
            }

            const data = await response.json();
            scrapedData = data;
            
            logTerminal(`Scrape completed successfully! Extracted ${data.length} listings.`, 'success');
            
            // Render results
            renderResults(data);
            
            // Refresh history table
            loadHistory();

        } catch (err) {
            clearInterval(stepInterval);
            logTerminal(`Error executing scraper: ${err.message}`, 'error');
            alert(`Scraping Failed: ${err.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').classList.remove('hidden');
            submitBtn.querySelector('.btn-loader').classList.add('hidden');
        }
    });

    // Render results helper
    function renderResults(data) {
        scrapedData = data;
        if (noWebsiteFilter) {
            noWebsiteFilter.checked = false; // Reset filter for new results
        }
        renderFilteredResults();
    }

    function getFilteredData() {
        if (noWebsiteFilter && noWebsiteFilter.checked) {
            return scrapedData.filter(place => !place.website || place.website.trim() === '');
        }
        return scrapedData;
    }

    function renderFilteredResults() {
        const data = getFilteredData();
        
        if (!data || data.length === 0) {
            showEmptyStates(scrapedData.length > 0);
            return;
        }

        // Update count and show action bar
        resultsCount.textContent = data.length;
        resultsActions.style.display = 'flex';

        // 1. Render Grid View
        gridEmpty.classList.add('hidden');
        cardsContainer.classList.remove('hidden');
        cardsContainer.innerHTML = '';

        data.forEach(place => {
            const card = document.createElement('div');
            card.className = 'place-card';
            
            // Build rating section
            let ratingHtml = '';
            if (place.rating) {
                const starsCount = Math.round(place.rating);
                let stars = '';
                for (let i = 1; i <= 5; i++) {
                    stars += i <= starsCount ? '<i class="bi bi-star-fill"></i>' : '<i class="bi bi-star"></i>';
                }
                ratingHtml = `
                    <div class="rating-row">
                        <div class="rating-stars">${stars}</div>
                        <span class="rating-number">${place.rating}</span>
                        <span class="reviews-count">(${place.reviews_count || 0} reviews)</span>
                    </div>
                `;
            } else {
                ratingHtml = `<div class="rating-row"><span class="reviews-count">No ratings</span></div>`;
            }

            // Build categories tags
            let categoriesHtml = '';
            if (place.categories && place.categories.length > 0) {
                categoriesHtml = `
                    <div class="categories-container">
                        ${place.categories.slice(0, 3).map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="place-card-body">
                    <h3 class="place-title" title="${place.name}">${place.name}</h3>
                    ${ratingHtml}
                    ${categoriesHtml}
                    <div class="contact-info">
                        <div class="info-line" title="${place.address || 'N/A'}">
                            <i class="bi bi-geo-alt"></i>
                            <span class="text-truncate">${place.address || 'No address provided'}</span>
                        </div>
                        ${place.phone ? `
                            <div class="info-line">
                                <i class="bi bi-telephone"></i>
                                <span>${place.phone}</span>
                            </div>
                        ` : ''}
                        ${place.website ? `
                            <div class="info-line">
                                <i class="bi bi-globe"></i>
                                <span class="text-truncate">${place.website}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="place-card-footer">
                    ${place.website ? `<a href="${place.website}" target="_blank" class="btn btn-secondary btn-sm"><i class="bi bi-box-arrow-up-right"></i> Website</a>` : ''}
                    <a href="${place.link}" target="_blank" class="btn btn-primary btn-sm"><i class="bi bi-google"></i> Maps</a>
                </div>
            `;
            cardsContainer.appendChild(card);
        });

        // 2. Render Table View
        tableEmpty.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
        tableBody.innerHTML = '';

        data.forEach(place => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${place.name}</strong></td>
                <td>${(place.categories && place.categories.join(', ')) || 'N/A'}</td>
                <td>${place.rating ? `<span class="table-rating"><i class="bi bi-star-fill"></i> ${place.rating}</span>` : 'N/A'}</td>
                <td>${place.reviews_count || 0}</td>
                <td>${place.phone || 'N/A'}</td>
                <td>${place.website ? `<a href="${place.website}" target="_blank" class="text-truncate" style="max-width:150px; display:inline-block;">${place.website.replace(/^https?:\/\/(www\.)?/, '')}</a>` : 'N/A'}</td>
                <td>${place.address || 'N/A'}</td>
            `;
            tableBody.appendChild(tr);
        });

        // 3. Render JSON View
        jsonEmpty.classList.add('hidden');
        jsonWrapper.classList.remove('hidden');
        jsonOutput.textContent = JSON.stringify(data, null, 2);
    }

    // Show empty state placeholder helper
    function showEmptyStates(keepActions = false) {
        resultsCount.textContent = '0';
        if (!keepActions) {
            resultsActions.style.display = 'none';
        }
        
        gridEmpty.classList.remove('hidden');
        cardsContainer.classList.add('hidden');

        tableEmpty.classList.remove('hidden');
        tableWrapper.classList.add('hidden');

        jsonEmpty.classList.remove('hidden');
        jsonWrapper.classList.add('hidden');
    }

    // CSV Download
    downloadCsvBtn.addEventListener('click', () => {
        const data = getFilteredData();
        if (data.length === 0) return;

        const headers = ['Name', 'Rating', 'Reviews Count', 'Phone', 'Website', 'Address', 'Categories', 'Google Maps Link'];
        let csvContent = '\uFEFF'; // Add UTF-8 BOM for Excel compatibility
        csvContent += headers.join(',') + '\r\n';

        data.forEach(item => {
            const row = [
                item.name || '',
                item.rating || '',
                item.reviews_count || '',
                item.phone || '',
                item.website || '',
                item.address || '',
                (item.categories && item.categories.join('; ')) || '',
                item.link || ''
            ];

            const rowEscaped = row.map(val => {
                const text = String(val).replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowEscaped.join(',') + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `gmaps_scrape_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // JSON Download
    downloadJsonBtn.addEventListener('click', () => {
        const data = getFilteredData();
        if (data.length === 0) return;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `gmaps_scrape_${timestamp}.json`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Excel Download (using XML Spreadsheet 2003 format)
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', () => {
            const data = getFilteredData();
            if (data.length === 0) return;

            let xml = '<?xml version="1.0"?>\r\n';
            xml += '<?mso-application progid="Excel.Sheet"?>\r\n';
            xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n';
            xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\r\n';
            xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n';
            xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n';
            xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\r\n';
            xml += ' <Worksheet ss:Name="Scraped Listings">\r\n';
            xml += '  <Table>\r\n';
            
            // Header row
            const headers = ['Name', 'Rating', 'Reviews Count', 'Phone', 'Website', 'Address', 'Categories', 'Google Maps Link'];
            xml += '   <Row ss:Height="22">\r\n';
            headers.forEach(h => {
                xml += `    <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\r\n`;
            });
            xml += '   </Row>\r\n';
            
            // Data rows
            data.forEach(item => {
                xml += '   <Row>\r\n';
                
                const rowData = [
                    item.name || '',
                    item.rating !== null && item.rating !== undefined ? String(item.rating) : '',
                    item.reviews_count !== null && item.reviews_count !== undefined ? String(item.reviews_count) : '',
                    item.phone || '',
                    item.website || '',
                    item.address || '',
                    (item.categories && item.categories.join(', ')) || '',
                    item.link || ''
                ];
                
                rowData.forEach((val, idx) => {
                    let type = 'String';
                    if ((idx === 1 || idx === 2) && val !== '' && !isNaN(val)) {
                        type = 'Number';
                    }
                    xml += `    <Cell><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>\r\n`;
                });
                
                xml += '   </Row>\r\n';
            });
            
            xml += '  </Table>\r\n';
            xml += ' </Worksheet>\r\n';
            xml += '</Workbook>\r\n';

            const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            
            const timestamp = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `gmaps_scrape_${timestamp}.xls`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    function escapeXml(unsafe) {
        return String(unsafe).replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    // Load and render search history
    async function loadHistory() {
        if (!historyTableBody) return;
        
        try {
            const response = await fetch('/history?limit=10');
            if (!response.ok) throw new Error('Failed to load history');
            
            const history = await response.json();
            
            if (history.length === 0) {
                historyTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted" style="padding: 20px; text-align: center;">
                            No search history recorded yet.
                        </td>
                    </tr>
                `;
                return;
            }
            
            historyTableBody.innerHTML = '';
            history.forEach(item => {
                const tr = document.createElement('tr');
                
                // Format timestamp beautifully (YYYY-MM-DD HH:MM)
                let dateStr = 'N/A';
                if (item.timestamp) {
                    const d = new Date(item.timestamp);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day} ${hours}:${minutes}`;
                }
                
                const maxPlacesStr = item.max_places ? item.max_places : 'All';
                const modeStr = item.headless ? 'Headless' : 'Headed';
                
                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td><strong>${escapeXml(item.query)}</strong></td>
                    <td>${maxPlacesStr}</td>
                    <td><span class="badge" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 2px 6px;">${item.lang.toUpperCase()}</span></td>
                    <td>${item.concurrency}</td>
                    <td>${modeStr}</td>
                    <td><span class="badge" style="background: hsla(142, 70%, 15%, 0.3); border: 1px solid hsla(142, 70%, 40%, 0.3); color: var(--accent-green); padding: 2px 6px;">${item.results_count} found</span></td>
                    <td class="history-actions-cell">
                        <button class="btn btn-secondary btn-sm load-history-btn" 
                                data-query="${escapeXml(item.query)}" 
                                data-max="${item.max_places || ''}" 
                                data-lang="${item.lang}" 
                                data-concurrency="${item.concurrency}" 
                                data-headless="${item.headless}" 
                                title="Load configuration">
                            <i class="bi bi-sliders"></i> Load
                        </button>
                        <button class="btn btn-secondary btn-sm text-danger delete-history-btn" 
                                data-id="${item.id}" 
                                title="Delete from history">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                historyTableBody.appendChild(tr);
            });
            
            // Bind actions dynamically
            bindHistoryActions();
            
        } catch (err) {
            console.error('Error loading history:', err);
        }
    }

    // Bind event listeners to load and delete history buttons
    function bindHistoryActions() {
        // Load configuration button
        const loadButtons = document.querySelectorAll('.load-history-btn');
        loadButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                const max = btn.getAttribute('data-max');
                const lang = btn.getAttribute('data-lang');
                const concurrency = btn.getAttribute('data-concurrency');
                const headless = btn.getAttribute('data-headless') === 'true';
                
                // Populate form fields
                document.getElementById('query').value = query;
                document.getElementById('max-places').value = max;
                document.getElementById('lang').value = lang;
                
                concurrencyInput.value = concurrency;
                concurrencyVal.textContent = concurrency;
                
                document.getElementById('headless').checked = headless;
                
                logTerminal(`Loaded configuration from history: "${query}"`, 'info');
                
                // Scroll form into view
                document.querySelector('.control-panel').scrollIntoView({ behavior: 'smooth' });
            });
        });

        // Delete item button
        const deleteButtons = document.querySelectorAll('.delete-history-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const response = await fetch(`/history/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        logTerminal('Deleted history item.', 'info');
                        loadHistory();
                    }
                } catch (err) {
                    console.error('Error deleting history item:', err);
                }
            });
        });
    }

    // Clear all history listener
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear your search history?')) return;
            try {
                const response = await fetch('/history', { method: 'DELETE' });
                if (response.ok) {
                    logTerminal('Cleared all search history from database.', 'success');
                    loadHistory();
                }
            } catch (err) {
                console.error('Error clearing history:', err);
            }
        });
    }

    // Load history initially on page startup
    loadHistory();
});
