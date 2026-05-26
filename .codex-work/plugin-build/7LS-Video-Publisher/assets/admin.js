(function () {
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                resolve();
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    function setupCopyButtons() {
        var buttons = document.querySelectorAll('.sevenls-vp-copy-btn');

        buttons.forEach(function (button) {
            if (!button.dataset.defaultLabel) {
                button.dataset.defaultLabel = button.textContent;
            }

            button.addEventListener('click', function () {
                var text = button.getAttribute('data-copy-text') || '';
                if (!text) {
                    return;
                }

                copyText(text)
                    .then(function () {
                        button.textContent = (window.sevenlsVpAdmin && window.sevenlsVpAdmin.labels.copy_success) || 'คัดลอกแล้ว';
                        button.classList.add('is-copied');
                        window.setTimeout(function () {
                            button.textContent = button.dataset.defaultLabel || ((window.sevenlsVpAdmin && window.sevenlsVpAdmin.labels.copy_default) || 'คัดลอก');
                            button.classList.remove('is-copied');
                        }, 2000);
                    })
                    .catch(function () {
                        button.textContent = (window.sevenlsVpAdmin && window.sevenlsVpAdmin.labels.copy_failed) || 'คัดลอกไม่สำเร็จ';
                        window.setTimeout(function () {
                            button.textContent = button.dataset.defaultLabel || ((window.sevenlsVpAdmin && window.sevenlsVpAdmin.labels.copy_default) || 'คัดลอก');
                        }, 2000);
                    });
            });
        });
    }

    function setupSmoothScroll() {
        var anchors = document.querySelectorAll('.sevenls-vp-wrapper a[href^="#"]');
        anchors.forEach(function (anchor) {
            anchor.addEventListener('click', function (event) {
                var targetId = anchor.getAttribute('href');
                if (!targetId) {
                    return;
                }
                var target = document.querySelector(targetId);
                if (!target) {
                    return;
                }
                event.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function setupProgressBars() {
        var forms = document.querySelectorAll('.sevenls-vp-wrapper form');
        forms.forEach(function (form) {
            form.addEventListener('submit', function () {
                var card = form.closest('.sevenls-vp-card');
                if (card) {
                    card.classList.add('is-loading');
                }
            });
        });
    }

    function setupSyncForms() {
        var config = window.sevenlsVpAdmin;
        var forms = document.querySelectorAll('.sevenls-vp-sync-form');
        var modal = getSyncModal();
        var activeSync = null;

        if (!config || !forms.length || !modal || !window.fetch) {
            return;
        }

        function setSyncButtonsDisabled(disabled) {
            forms.forEach(function (form) {
                var button = form.querySelector('button[type="submit"]');
                if (button) {
                    button.disabled = disabled;
                }
            });
        }

        function setCardLoading(form, loading) {
            var card = form.closest('.sevenls-vp-card');
            if (!card) {
                return;
            }

            if (loading) {
                card.classList.add('is-loading');
            } else {
                card.classList.remove('is-loading');
            }
        }

        function generateJobId() {
            return 'sync-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        }

        function request(endpointAction, payload) {
            var formData = new FormData();
            formData.append('action', endpointAction);
            formData.append('nonce', config.syncNonce);

            Object.keys(payload).forEach(function (key) {
                if (payload[key] !== undefined && payload[key] !== null) {
                    formData.append(key, payload[key]);
                }
            });

            return window.fetch(config.ajaxUrl, {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            }).then(function (response) {
                return response.json().catch(function () {
                    return {
                        success: false,
                        data: {
                            message: config.labels.invalid_response || 'รูปแบบคำตอบจาก AJAX ไม่ถูกต้อง'
                        }
                    };
                });
            });
        }

        function openModal(label) {
            modal.root.hidden = false;
            modal.root.classList.add('is-visible');
            document.body.classList.add('sevenls-vp-modal-open');
            modal.root.dataset.reloadOnClose = '0';
            modal.root.dataset.finalState = '';
            modal.title.textContent = label || config.labels.preparing;
            modal.message.textContent = config.labels.preparing;
            modal.status.textContent = config.labels.running;
            modal.status.className = 'sevenls-vp-sync-modal__status sevenls-vp-sync-modal__status--running';
            modal.percent.textContent = '1%';
            modal.progress.style.width = '1%';
            modal.completed.textContent = '0';
            modal.created.textContent = '0';
            modal.updated.textContent = '0';
            modal.errors.textContent = '0';
            modal.currentItem.textContent = config.labels.waiting_item;
            modal.page.textContent = '\u2014';
            modal.total.textContent = '\u2014';
            modal.mode.textContent = '\u2014';
            modal.alert.hidden = false;
            modal.alert.className = 'sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--info';
            modal.alertText.textContent = config.labels.starting_alert || config.labels.running_alert;
            modal.pendingCount.textContent = '0';
            modal.resultsCount.textContent = '0';
            modal.errorsCount.textContent = '0';
            modal.elapsed.textContent = config.labels.elapsed_default || '0 วินาที';
            modal.eta.textContent = config.labels.eta_calculating || 'กำลังคำนวณ...';
            renderSimpleList(modal.pendingList, [], config.labels.no_pending);
            renderResultList(modal.resultsList, [], config.labels.no_results);
            renderResultList(modal.errorsList, [], config.labels.no_errors);
            modal.errorsWrap.hidden = true;
            modal.closeButtons.forEach(function (button) {
                button.disabled = true;
                if (button === modal.footerClose) {
                    button.textContent = config.labels.close;
                }
            });
        }

        function closeModal() {
            if (!modal.root.classList.contains('is-visible')) {
                return;
            }

            if (modal.footerClose.disabled) {
                return;
            }

            var shouldReload = modal.root.dataset.reloadOnClose === '1';

            modal.root.classList.remove('is-visible');
            modal.root.hidden = true;
            document.body.classList.remove('sevenls-vp-modal-open');

            if (shouldReload) {
                window.location.reload();
            }
        }

        function setCloseEnabled(enabled, label, shouldReload) {
            modal.root.dataset.reloadOnClose = shouldReload ? '1' : '0';
            modal.closeButtons.forEach(function (button) {
                button.disabled = !enabled;
            });
            if (label) {
                modal.footerClose.textContent = label;
            }
        }

        function getStatusLabel(status) {
            if (status === 'completed') {
                return config.labels.completed;
            }
            if (status === 'error') {
                return config.labels.error;
            }
            if (status === 'running') {
                return config.labels.running;
            }
            return config.labels.running;
        }

        function updateModal(progress, fallbackLabel) {
            var status = progress.status || 'running';
            var label = progress.label || fallbackLabel || config.labels.preparing;
            var percent = typeof progress.percent === 'number' ? progress.percent : parseInt(progress.percent || '0', 10);
            var completed = typeof progress.completed_items === 'number'
                ? progress.completed_items
                : (parseInt(progress.completed_items || progress.processed || '0', 10) || 0);
            var currentPage = parseInt(progress.current_page || '0', 10) || 0;
            var totalPages = progress.total_pages !== null && progress.total_pages !== undefined
                ? parseInt(progress.total_pages, 10) || 0
                : 0;
            var totalItems = progress.total_items !== null && progress.total_items !== undefined
                ? parseInt(progress.total_items, 10) || 0
                : 0;
            var pendingItems = Array.isArray(progress.pending_items) ? progress.pending_items : [];
            var recentResults = Array.isArray(progress.recent_results) ? progress.recent_results : [];
            var errorItems = Array.isArray(progress.error_items) ? progress.error_items : [];
            var currentItem = progress.current_item || '';
            var timeMetrics = buildTimeMetrics(progress);

            modal.title.textContent = label;
            modal.message.textContent = progress.message || config.labels.preparing;
            modal.status.textContent = getStatusLabel(status);
            modal.status.className = 'sevenls-vp-sync-modal__status sevenls-vp-sync-modal__status--' + status;
            modal.percent.textContent = Math.max(0, Math.min(100, percent)) + '%';
            modal.progress.style.width = Math.max(0, Math.min(100, percent)) + '%';
            modal.completed.textContent = completed;
            modal.created.textContent = parseInt(progress.created || '0', 10) || 0;
            modal.updated.textContent = parseInt(progress.updated || '0', 10) || 0;
            modal.errors.textContent = parseInt(progress.errors || '0', 10) || 0;
            modal.currentItem.textContent = currentItem || (status === 'running' ? config.labels.waiting_item : '\u2014');
            modal.page.textContent = currentPage > 0
                ? (totalPages > 0 ? currentPage + ' / ' + totalPages : String(currentPage))
                : config.labels.unknown_page;
            modal.total.textContent = totalItems > 0 ? String(totalItems) : config.labels.unknown_total;
            modal.mode.textContent = progress.mode_label || '\u2014';
            modal.elapsed.textContent = timeMetrics.elapsedText;
            modal.eta.textContent = timeMetrics.etaText;
            modal.pendingCount.textContent = String(pendingItems.length);
            modal.resultsCount.textContent = String(recentResults.length);
            modal.errorsCount.textContent = String(errorItems.length);
            renderSimpleList(modal.pendingList, pendingItems, config.labels.no_pending);
            renderResultList(modal.resultsList, recentResults, config.labels.no_results);
            renderResultList(modal.errorsList, errorItems, config.labels.no_errors);
            modal.errorsWrap.hidden = errorItems.length === 0;
            updateAlert(status, progress.message || config.labels.preparing);
        }

        function buildTimeMetrics(progress) {
            var nowSeconds = Date.now() / 1000;
            var startedAt = parseInt(progress.started_at || '0', 10) || 0;
            var finishedAt = parseInt(progress.finished_at || '0', 10) || 0;
            var duration = progress.duration !== null && progress.duration !== undefined
                ? parseFloat(progress.duration) || 0
                : 0;
            var handled = parseInt(progress.handled || progress.completed_items || progress.processed || '0', 10) || 0;
            var totalItems = progress.total_items !== null && progress.total_items !== undefined
                ? parseInt(progress.total_items, 10) || 0
                : 0;
            var percent = typeof progress.percent === 'number' ? progress.percent : parseInt(progress.percent || '0', 10) || 0;
            var phase = progress.phase || '';
            var elapsedSeconds;
            var etaSeconds = null;
            var etaText = config.labels.eta_calculating || 'กำลังคำนวณ...';

            if (finishedAt > 0) {
                elapsedSeconds = duration > 0 ? duration : Math.max(0, finishedAt - startedAt);
            } else if (startedAt > 0) {
                elapsedSeconds = Math.max(0, nowSeconds - startedAt);
            } else {
                elapsedSeconds = 0;
            }

            if (progress.status === 'completed') {
                etaText = config.labels.eta_done || 'เสร็จแล้ว';
            } else if (progress.status === 'error') {
                etaText = '\u2014';
            } else if (handled > 0 && totalItems > handled && elapsedSeconds > 0) {
                etaSeconds = Math.ceil((elapsedSeconds / handled) * (totalItems - handled));
            } else if (phase !== 'prepare_remote' && percent >= 5 && percent < 100 && elapsedSeconds > 0) {
                etaSeconds = Math.ceil((elapsedSeconds / percent) * (100 - percent));
            }

            if (etaSeconds !== null) {
                if (etaSeconds <= 5) {
                    etaText = config.labels.eta_soon || 'อีกไม่กี่วินาที';
                } else {
                    etaText = formatEtaTime(nowSeconds + etaSeconds) + ' (' + formatDuration(etaSeconds) + ')';
                }
            } else if (progress.status === 'running' && (phase === 'prepare_remote' || percent < 5 || handled === 0)) {
                etaText = config.labels.eta_calculating || 'กำลังคำนวณ...';
            } else if (progress.status === 'running') {
                etaText = config.labels.eta_unavailable || 'ยังประเมินไม่ได้';
            }

            return {
                elapsedText: formatDuration(elapsedSeconds),
                etaText: etaText
            };
        }

        function formatDuration(totalSeconds) {
            var seconds = Math.max(0, Math.round(totalSeconds || 0));
            var hours;
            var minutes;

            if (seconds < 60) {
                return seconds + ' วินาที';
            }

            if (seconds < 3600) {
                minutes = Math.floor(seconds / 60);
                seconds = seconds % 60;
                if (seconds === 0) {
                    return minutes + ' นาที';
                }
                return minutes + ' นาที ' + seconds + ' วินาที';
            }

            hours = Math.floor(seconds / 3600);
            minutes = Math.floor((seconds % 3600) / 60);

            if (minutes === 0) {
                return hours + ' ชม.';
            }

            return hours + ' ชม. ' + minutes + ' นาที';
        }

        function formatEtaTime(timestampSeconds) {
            var date = new Date(timestampSeconds * 1000);

            try {
                return date.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                }) + ' น.';
            } catch (error) {
                return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0') + ' น.';
            }
        }

        function recordProgressHeartbeat(state, progress) {
            var signatureParts;

            if (!state || !progress) {
                return;
            }

            signatureParts = [
                progress.status || '',
                progress.updated_at || '',
                progress.percent || 0,
                progress.completed_items || progress.processed || 0,
                progress.errors || 0,
                progress.current_page || 0,
                progress.current_item || ''
            ];

            if (state.lastProgressSignature === signatureParts.join('|')) {
                return;
            }

            state.lastProgressSignature = signatureParts.join('|');
            state.lastProgressAt = Date.now();
        }

        function maybeFailStalledSync(state) {
            var staleThreshold = parseInt(config.syncStaleThreshold || '180000', 10) || 180000;

            if (!state || state.finalized || !state.lastProgressAt) {
                return false;
            }

            if (!activeSync || activeSync.jobId !== state.jobId) {
                return false;
            }

            if ((Date.now() - state.lastProgressAt) < staleThreshold) {
                return false;
            }

            failSync(state, config.labels.stalled);
            return true;
        }

        function finalizeSync(state, progress, options) {
            var shouldReload = !!options.shouldReload;
            var buttonLabel = shouldReload ? config.labels.close_refresh : config.labels.close;

            if (state.pollTimer) {
                window.clearInterval(state.pollTimer);
                state.pollTimer = null;
            }

            if (state.batchTimer) {
                window.clearTimeout(state.batchTimer);
                state.batchTimer = null;
            }

            setCardLoading(state.form, false);
            setSyncButtonsDisabled(false);
            setCloseEnabled(true, buttonLabel, shouldReload);
            modal.root.dataset.finalState = progress && progress.status ? progress.status : '';
            state.finalized = true;
            state.batchRequestInFlight = false;

            if (activeSync && activeSync.jobId === state.jobId) {
                activeSync = null;
            }
        }

        function failSync(state, message) {
            var progress = {
                status: 'error',
                label: state.label,
                message: message || config.labels.error,
                percent: 100,
                phase: '',
                completed_items: 0,
                created: 0,
                updated: 0,
                errors: 0,
                current_page: 0,
                total_pages: null,
                total_items: null,
                mode_label: '',
                current_item: '',
                pending_items: [],
                recent_results: [],
                error_items: [
                    {
                        title: state.label,
                        status: 'error',
                        detail: message || config.labels.error
                    }
                ]
            };

            updateModal(progress, state.label);
            finalizeSync(state, progress, { shouldReload: false });
        }

        function updateAlert(status, message) {
            modal.alert.hidden = false;

            if (status === 'completed') {
                modal.alert.className = 'sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--success';
                modal.alertText.textContent = message || config.labels.success_alert;
                return;
            }

            if (status === 'error') {
                modal.alert.className = 'sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--error';
                modal.alertText.textContent = message || config.labels.error;
                return;
            }

            modal.alert.className = 'sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--info';
            modal.alertText.textContent = message || config.labels.running_alert;
        }

        function renderSimpleList(listEl, items, emptyText) {
            listEl.innerHTML = '';

            if (!Array.isArray(items) || !items.length) {
                appendEmptyListItem(listEl, emptyText);
                return;
            }

            items.forEach(function (item) {
                var li = document.createElement('li');
                li.className = 'sevenls-vp-sync-modal__list-item';
                li.textContent = item;
                listEl.appendChild(li);
            });
        }

        function renderResultList(listEl, items, emptyText) {
            listEl.innerHTML = '';

            if (!Array.isArray(items) || !items.length) {
                appendEmptyListItem(listEl, emptyText);
                return;
            }

            items.forEach(function (item) {
                var li = document.createElement('li');
                var badge = document.createElement('span');
                var body = document.createElement('div');
                var title = document.createElement('strong');
                var detail = document.createElement('span');

                li.className = 'sevenls-vp-sync-modal__list-item sevenls-vp-sync-modal__list-item--result';
                badge.className = 'sevenls-vp-sync-modal__result-badge sevenls-vp-sync-modal__result-badge--' + item.status;
                badge.textContent = getResultStatusLabel(item.status);
                body.className = 'sevenls-vp-sync-modal__result-body';
                title.textContent = item.title || '';
                detail.className = 'sevenls-vp-sync-modal__result-detail';
                detail.textContent = item.detail || '';

                body.appendChild(title);
                if (item.detail) {
                    body.appendChild(detail);
                }

                li.appendChild(badge);
                li.appendChild(body);
                listEl.appendChild(li);
            });
        }

        function appendEmptyListItem(listEl, text) {
            var li = document.createElement('li');
            li.className = 'sevenls-vp-sync-modal__list-empty';
            li.textContent = text;
            listEl.appendChild(li);
        }

        function getResultStatusLabel(status) {
            if (status === 'created') {
                return config.labels.created;
            }
            if (status === 'updated') {
                return config.labels.updated;
            }
            if (status === 'error') {
                return config.labels.error_item;
            }
            return config.labels.completed_item;
        }

        function pollProgress(state) {
            request('sevenls_vp_get_sync_progress', {
                job_id: state.jobId
            }).then(function (result) {
                if (!result || !result.success || !result.data) {
                    return;
                }

                updateModal(result.data, state.label);
                recordProgressHeartbeat(state, result.data);

                if (result.data.status === 'completed') {
                    finalizeSync(state, result.data, { shouldReload: true });
                } else if (result.data.status === 'error') {
                    finalizeSync(state, result.data, { shouldReload: false });
                }
            }).catch(function () {
                // Ignore transient polling errors while the main request is running.
            });
        }

        function clearBatchTimer(state) {
            if (state.batchTimer) {
                window.clearTimeout(state.batchTimer);
                state.batchTimer = null;
            }
        }

        function scheduleNextBatch(state, delay) {
            clearBatchTimer(state);

            if (!state || state.finalized || !state.isBatch) {
                return;
            }

            state.batchTimer = window.setTimeout(function () {
                state.batchTimer = null;
                processNextBatch(state);
            }, typeof delay === 'number' ? delay : 25);
        }

        function processNextBatch(state) {
            if (!state || state.finalized || !state.isBatch || state.batchRequestInFlight) {
                return;
            }

            if (!activeSync || activeSync.jobId !== state.jobId) {
                return;
            }

            state.batchRequestInFlight = true;

            request('sevenls_vp_process_sync_batch', {
                job_id: state.jobId
            }).then(function (result) {
                state.batchRequestInFlight = false;

                if (!state || state.finalized) {
                    return;
                }

                if (!result || !result.success) {
                        failSync(
                        state,
                        result && result.data && result.data.message ? result.data.message : (config.labels.batch_failed || 'การประมวลผลแบตช์ล้มเหลว')
                    );
                    return;
                }

                if (result.data && result.data.progress) {
                    updateModal(result.data.progress, state.label);
                    recordProgressHeartbeat(state, result.data.progress);

                    if (result.data.progress.status === 'completed') {
                        finalizeSync(state, result.data.progress, { shouldReload: true });
                        return;
                    }

                    if (result.data.progress.status === 'error') {
                        finalizeSync(state, result.data.progress, { shouldReload: false });
                        return;
                    }
                }

                if (result.data && result.data.continue) {
                    scheduleNextBatch(state, 25);
                    return;
                }

                if (result.data && result.data.progress) {
                    finalizeSync(state, result.data.progress, {
                        shouldReload: result.data.progress.status === 'completed'
                    });
                    return;
                }

                failSync(state, config.labels.unexpected_batch || 'แบตช์ซิงก์ตอบกลับไม่ตรงตามที่คาดไว้');
            }).catch(function () {
                state.batchRequestInFlight = false;
                failSync(state, config.labels.network_batch || 'เครือข่ายขัดข้องระหว่างประมวลผลแบตช์');
            });
        }

        function startProgressObservers(state) {
            if (!state || state.finalized || state.pollTimer) {
                return;
            }

            state.pollTimer = window.setInterval(function () {
                if (maybeFailStalledSync(state)) {
                    return;
                }

                pollProgress(state);
            }, parseInt(config.syncPollInterval || '1000', 10));
        }

        forms.forEach(function (form) {
            form.addEventListener('submit', function (event) {
                var confirmMessage;
                var state;

                if (activeSync) {
                    event.preventDefault();
                    setCardLoading(form, false);
                    return;
                }

                confirmMessage = form.getAttribute('data-confirm');
                if (confirmMessage && !window.confirm(confirmMessage)) {
                    event.preventDefault();
                    setCardLoading(form, false);
                    return;
                }

                event.preventDefault();

                state = {
                    form: form,
                    jobId: generateJobId(),
                    label: form.getAttribute('data-sync-label') || 'Sync',
                    syncAction: form.getAttribute('data-sync-action') || '',
                    pollTimer: null,
                    batchTimer: null,
                    batchRequestInFlight: false,
                    isBatch: false,
                    delayInitialPoll: (form.getAttribute('data-sync-action') || '') === 'full_sync',
                    lastProgressAt: Date.now(),
                    lastProgressSignature: '',
                    finalized: false
                };

                activeSync = state;
                openModal(state.label);
                setSyncButtonsDisabled(true);
                setCardLoading(form, true);

                if (!state.delayInitialPoll) {
                    startProgressObservers(state);
                    pollProgress(state);
                }

                request('sevenls_vp_start_sync', {
                    sync_action: state.syncAction,
                    job_id: state.jobId
                }).then(function (result) {
                    if (!result || !result.success) {
                        failSync(state, result && result.data && result.data.message ? result.data.message : (config.labels.sync_failed || 'การซิงก์ล้มเหลว'));
                        return;
                    }

                    startProgressObservers(state);

                    if (result.data && result.data.progress) {
                        updateModal(result.data.progress, state.label);
                        recordProgressHeartbeat(state, result.data.progress);

                        if (result.data.progress.status === 'completed') {
                            finalizeSync(state, result.data.progress, { shouldReload: true });
                        } else if (result.data.progress.status === 'error') {
                            finalizeSync(state, result.data.progress, { shouldReload: false });
                        } else if (result.data.batched) {
                            state.isBatch = true;
                            scheduleNextBatch(state, 0);
                        }
                    } else if (result.data && result.data.batched) {
                        startProgressObservers(state);
                        state.isBatch = true;
                        scheduleNextBatch(state, 0);
                    }
                }).catch(function () {
                    failSync(state, config.labels.network_start || 'เครือข่ายขัดข้องระหว่างเริ่มการซิงก์');
                });
            });
        });

        modal.closeButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                closeModal();
            });
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });
    }

    function getSyncModal() {
        var root = document.querySelector('[data-sync-modal]');

        if (!root) {
            return null;
        }

        return {
            root: root,
            title: root.querySelector('[data-sync-modal-title]'),
            message: root.querySelector('[data-sync-modal-message]'),
            status: root.querySelector('[data-sync-modal-status]'),
            percent: root.querySelector('[data-sync-modal-percent]'),
            progress: root.querySelector('[data-sync-modal-progress]'),
            alert: root.querySelector('[data-sync-modal-alert]'),
            alertText: root.querySelector('[data-sync-modal-alert-text]'),
            completed: root.querySelector('[data-sync-modal-completed]'),
            created: root.querySelector('[data-sync-modal-created]'),
            updated: root.querySelector('[data-sync-modal-updated]'),
            errors: root.querySelector('[data-sync-modal-errors]'),
            currentItem: root.querySelector('[data-sync-modal-current-item]'),
            page: root.querySelector('[data-sync-modal-page]'),
            total: root.querySelector('[data-sync-modal-total]'),
            mode: root.querySelector('[data-sync-modal-mode]'),
            elapsed: root.querySelector('[data-sync-modal-elapsed]'),
            eta: root.querySelector('[data-sync-modal-eta]'),
            pendingCount: root.querySelector('[data-sync-modal-pending-count]'),
            pendingList: root.querySelector('[data-sync-modal-pending-list]'),
            resultsCount: root.querySelector('[data-sync-modal-results-count]'),
            resultsList: root.querySelector('[data-sync-modal-results-list]'),
            errorsWrap: root.querySelector('[data-sync-modal-errors-wrap]'),
            errorsCount: root.querySelector('[data-sync-modal-errors-count]'),
            errorsList: root.querySelector('[data-sync-modal-errors-list]'),
            footerClose: root.querySelector('[data-sync-modal-close-button]'),
            closeButtons: root.querySelectorAll('[data-sync-modal-close], [data-sync-modal-close-button]')
        };
    }

    function init() {
        setupCopyButtons();
        setupSmoothScroll();
        setupProgressBars();
        setupSyncForms();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
