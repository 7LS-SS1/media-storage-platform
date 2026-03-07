(function () {
    'use strict';

    var HIDE_DELAY = 3000;
    var RAF_ID_KEY = '_sevenlsRafId';

    // ─── HLS Setup ──────────────────────────────────────────

    function setupHls(video) {
        var hlsSrc = video.getAttribute('data-hls-src');
        if (!hlsSrc) {
            return;
        }

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsSrc;
            return;
        }

        if (window.Hls && window.Hls.isSupported()) {
            var hls = new window.Hls();
            hls.loadSource(hlsSrc);
            hls.attachMedia(video);
            video._sevenlsHls = hls;
            return;
        }

        video.src = hlsSrc;
    }

    // ─── Helpers ─────────────────────────────────────────────

    function clampTime(video, time) {
        if (!isFinite(video.duration)) {
            return Math.max(0, time);
        }
        return Math.min(Math.max(0, time), video.duration);
    }

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) {
            return '0:00';
        }
        seconds = Math.floor(seconds);
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        var sStr = s < 10 ? '0' + s : '' + s;
        if (h > 0) {
            var mStr = m < 10 ? '0' + m : '' + m;
            return h + ':' + mStr + ':' + sStr;
        }
        return m + ':' + sStr;
    }

    function describeError(video) {
        if (!video.error) {
            return 'Video failed to load.';
        }
        switch (video.error.code) {
            case 1: return 'Video playback was aborted.';
            case 2: return 'Network error while downloading the video.';
            case 3: return 'Video is corrupted or the format is not supported.';
            case 4: return 'Video format is not supported or the source is invalid.';
            default: return 'Video failed to load.';
        }
    }

    function isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    function setupSourceProtection(container, video) {
        // Hint compatible browsers to hide download and casting controls.
        video.setAttribute('controlslist', 'nodownload noplaybackrate');
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('disableremoteplayback', '');
        video.setAttribute('draggable', 'false');

        // Block easy download paths from the player UI.
        container.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        });

        video.addEventListener('dragstart', function (e) {
            e.preventDefault();
        });
    }

    // ─── SVG Icons ───────────────────────────────────────────

    var icons = {
        play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
        volumeHigh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        volumeMute: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
        fullscreen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
        fullscreenExit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
        playLarge: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
    };

    // ─── Build Controls DOM ──────────────────────────────────

    function buildControlsUI(container) {
        // Center play overlay
        var playOverlay = document.createElement('div');
        playOverlay.className = 'sevenls-vp-play-overlay';
        playOverlay.innerHTML = icons.playLarge;
        playOverlay.setAttribute('role', 'button');
        playOverlay.setAttribute('aria-label', 'Play');
        container.appendChild(playOverlay);

        // Loading spinner
        var loading = document.createElement('div');
        loading.className = 'sevenls-vp-loading';
        loading.innerHTML = '<div class="sevenls-vp-spinner"></div>';
        container.appendChild(loading);

        // Bottom controls bar
        var controls = document.createElement('div');
        controls.className = 'sevenls-vp-controls';

        // Progress bar
        var progressWrap = document.createElement('div');
        progressWrap.className = 'sevenls-vp-progress';
        progressWrap.setAttribute('role', 'slider');
        progressWrap.setAttribute('aria-label', 'Video progress');
        progressWrap.setAttribute('aria-valuemin', '0');
        progressWrap.setAttribute('aria-valuemax', '100');
        progressWrap.setAttribute('aria-valuenow', '0');
        progressWrap.setAttribute('tabindex', '0');

        var progressBuffer = document.createElement('div');
        progressBuffer.className = 'sevenls-vp-progress-buffer';
        progressWrap.appendChild(progressBuffer);

        var progressBar = document.createElement('div');
        progressBar.className = 'sevenls-vp-progress-bar';
        progressWrap.appendChild(progressBar);

        var progressHandle = document.createElement('div');
        progressHandle.className = 'sevenls-vp-progress-handle';
        progressBar.appendChild(progressHandle);

        controls.appendChild(progressWrap);

        // Bottom row
        var bottomRow = document.createElement('div');
        bottomRow.className = 'sevenls-vp-controls-row';

        // Left group
        var leftGroup = document.createElement('div');
        leftGroup.className = 'sevenls-vp-controls-left';

        var playBtn = document.createElement('button');
        playBtn.className = 'sevenls-vp-btn sevenls-vp-play-btn';
        playBtn.type = 'button';
        playBtn.setAttribute('aria-label', 'Play');
        playBtn.innerHTML = icons.play;
        leftGroup.appendChild(playBtn);

        // Volume
        var volumeWrap = document.createElement('div');
        volumeWrap.className = 'sevenls-vp-volume';

        var muteBtn = document.createElement('button');
        muteBtn.className = 'sevenls-vp-btn sevenls-vp-mute-btn';
        muteBtn.type = 'button';
        muteBtn.setAttribute('aria-label', 'Mute');
        muteBtn.innerHTML = icons.volumeHigh;
        volumeWrap.appendChild(muteBtn);

        var volumeSlider = document.createElement('div');
        volumeSlider.className = 'sevenls-vp-volume-slider';
        volumeSlider.setAttribute('role', 'slider');
        volumeSlider.setAttribute('aria-label', 'Volume');
        volumeSlider.setAttribute('aria-valuemin', '0');
        volumeSlider.setAttribute('aria-valuemax', '100');
        volumeSlider.setAttribute('aria-valuenow', '100');
        volumeSlider.setAttribute('tabindex', '0');

        var volumeTrack = document.createElement('div');
        volumeTrack.className = 'sevenls-vp-volume-track';
        volumeSlider.appendChild(volumeTrack);

        var volumeFill = document.createElement('div');
        volumeFill.className = 'sevenls-vp-volume-fill';
        volumeTrack.appendChild(volumeFill);

        volumeWrap.appendChild(volumeSlider);
        leftGroup.appendChild(volumeWrap);

        // Time display
        var timeDisplay = document.createElement('span');
        timeDisplay.className = 'sevenls-vp-time';
        timeDisplay.textContent = '0:00 / 0:00';
        leftGroup.appendChild(timeDisplay);

        bottomRow.appendChild(leftGroup);

        // Right group
        var rightGroup = document.createElement('div');
        rightGroup.className = 'sevenls-vp-controls-right';

        var fsBtn = document.createElement('button');
        fsBtn.className = 'sevenls-vp-btn sevenls-vp-fullscreen-btn';
        fsBtn.type = 'button';
        fsBtn.setAttribute('aria-label', 'Fullscreen');
        fsBtn.innerHTML = icons.fullscreen;
        rightGroup.appendChild(fsBtn);

        bottomRow.appendChild(rightGroup);
        controls.appendChild(bottomRow);
        container.appendChild(controls);

        return {
            playOverlay: playOverlay,
            loading: loading,
            controls: controls,
            progressWrap: progressWrap,
            progressBuffer: progressBuffer,
            progressBar: progressBar,
            playBtn: playBtn,
            muteBtn: muteBtn,
            volumeSlider: volumeSlider,
            volumeFill: volumeFill,
            timeDisplay: timeDisplay,
            fsBtn: fsBtn
        };
    }

    // ─── Error / Loading States ──────────────────────────────

    function showError(container, message) {
        var errorEl = container.querySelector('[data-video-error]');
        if (!errorEl) {
            return;
        }
        errorEl.textContent = message;
        errorEl.classList.add('is-visible');
    }

    function clearError(container) {
        var errorEl = container.querySelector('[data-video-error]');
        if (!errorEl) {
            return;
        }
        errorEl.textContent = '';
        errorEl.classList.remove('is-visible');
    }

    function setLoading(els, show) {
        if (els.loading) {
            els.loading.classList.toggle('is-visible', show);
        }
    }

    // ─── Play / Pause ────────────────────────────────────────

    function setupPlayPause(container, video, els) {
        function updateUI() {
            if (video.paused) {
                els.playBtn.innerHTML = icons.play;
                els.playBtn.setAttribute('aria-label', 'Play');
                els.playOverlay.classList.add('is-visible');
                container.classList.remove('is-playing');
            } else {
                els.playBtn.innerHTML = icons.pause;
                els.playBtn.setAttribute('aria-label', 'Pause');
                els.playOverlay.classList.remove('is-visible');
                container.classList.add('is-playing');
            }
        }

        function togglePlay(e) {
            if (e) e.preventDefault();
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }

        els.playBtn.addEventListener('click', togglePlay);
        els.playOverlay.addEventListener('click', togglePlay);

        video.addEventListener('play', updateUI);
        video.addEventListener('pause', updateUI);
        video.addEventListener('ended', function () {
            els.playOverlay.classList.add('is-visible');
            container.classList.remove('is-playing');
        });

        // Click on video to toggle (but not on controls)
        video.addEventListener('click', function (e) {
            e.preventDefault();
            togglePlay();
        });

        updateUI();
    }

    // ─── Progress / Seek ─────────────────────────────────────

    function setupProgress(container, video, els) {
        var seeking = false;

        function updateProgress() {
            if (seeking || !isFinite(video.duration) || video.duration <= 0) {
                return;
            }
            var pct = (video.currentTime / video.duration) * 100;
            els.progressBar.style.width = pct + '%';
            els.progressWrap.setAttribute('aria-valuenow', Math.round(pct));
            els.timeDisplay.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
        }

        function updateBuffer() {
            if (!isFinite(video.duration) || video.duration <= 0) {
                return;
            }
            var buffered = 0;
            if (video.buffered.length > 0) {
                buffered = video.buffered.end(video.buffered.length - 1);
            }
            var pct = (buffered / video.duration) * 100;
            els.progressBuffer.style.width = pct + '%';
        }

        function seekToPosition(e) {
            var rect = els.progressWrap.getBoundingClientRect();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            if (isFinite(video.duration) && video.duration > 0) {
                video.currentTime = pct * video.duration;
                els.progressBar.style.width = (pct * 100) + '%';
            }
        }

        function onSeekStart(e) {
            seeking = true;
            seekToPosition(e);
            document.addEventListener('mousemove', onSeekMove);
            document.addEventListener('mouseup', onSeekEnd);
            document.addEventListener('touchmove', onSeekMove, { passive: false });
            document.addEventListener('touchend', onSeekEnd);
        }

        function onSeekMove(e) {
            if (!seeking) return;
            if (e.cancelable) e.preventDefault();
            seekToPosition(e);
        }

        function onSeekEnd() {
            seeking = false;
            document.removeEventListener('mousemove', onSeekMove);
            document.removeEventListener('mouseup', onSeekEnd);
            document.removeEventListener('touchmove', onSeekMove);
            document.removeEventListener('touchend', onSeekEnd);
        }

        els.progressWrap.addEventListener('mousedown', onSeekStart);
        els.progressWrap.addEventListener('touchstart', onSeekStart, { passive: false });

        // Keyboard seek on progress bar
        els.progressWrap.addEventListener('keydown', function (e) {
            var step = 5;
            if (e.key === 'ArrowRight') {
                video.currentTime = clampTime(video, video.currentTime + step);
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                video.currentTime = clampTime(video, video.currentTime - step);
                e.preventDefault();
            }
        });

        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('progress', updateBuffer);
        video.addEventListener('loadedmetadata', function () {
            updateProgress();
            updateBuffer();
        });

        // requestAnimationFrame for smoother progress updates
        function animLoop() {
            updateProgress();
            container[RAF_ID_KEY] = requestAnimationFrame(animLoop);
        }
        video.addEventListener('play', function () {
            container[RAF_ID_KEY] = requestAnimationFrame(animLoop);
        });
        video.addEventListener('pause', function () {
            if (container[RAF_ID_KEY]) {
                cancelAnimationFrame(container[RAF_ID_KEY]);
            }
        });
    }

    // ─── Volume ──────────────────────────────────────────────

    function setupVolume(container, video, els) {
        var savedVolume = 1;

        function updateVolumeUI() {
            var vol = video.muted ? 0 : video.volume;
            els.volumeFill.style.width = (vol * 100) + '%';
            els.volumeSlider.setAttribute('aria-valuenow', Math.round(vol * 100));
            els.muteBtn.innerHTML = vol === 0 ? icons.volumeMute : icons.volumeHigh;
            els.muteBtn.setAttribute('aria-label', vol === 0 ? 'Unmute' : 'Mute');
        }

        els.muteBtn.addEventListener('click', function () {
            if (video.muted || video.volume === 0) {
                video.muted = false;
                video.volume = savedVolume > 0 ? savedVolume : 0.5;
            } else {
                savedVolume = video.volume;
                video.muted = true;
            }
            updateVolumeUI();
        });

        // Volume slider
        var draggingVol = false;

        function setVolumeFromEvent(e) {
            var rect = els.volumeSlider.getBoundingClientRect();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            video.volume = pct;
            video.muted = pct === 0;
            savedVolume = pct > 0 ? pct : savedVolume;
            updateVolumeUI();
        }

        function onVolStart(e) {
            draggingVol = true;
            setVolumeFromEvent(e);
            document.addEventListener('mousemove', onVolMove);
            document.addEventListener('mouseup', onVolEnd);
            document.addEventListener('touchmove', onVolMove, { passive: false });
            document.addEventListener('touchend', onVolEnd);
        }

        function onVolMove(e) {
            if (!draggingVol) return;
            if (e.cancelable) e.preventDefault();
            setVolumeFromEvent(e);
        }

        function onVolEnd() {
            draggingVol = false;
            document.removeEventListener('mousemove', onVolMove);
            document.removeEventListener('mouseup', onVolEnd);
            document.removeEventListener('touchmove', onVolMove);
            document.removeEventListener('touchend', onVolEnd);
        }

        els.volumeSlider.addEventListener('mousedown', onVolStart);
        els.volumeSlider.addEventListener('touchstart', onVolStart, { passive: false });

        // Keyboard volume
        els.volumeSlider.addEventListener('keydown', function (e) {
            var step = 0.05;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                video.volume = Math.min(1, video.volume + step);
                video.muted = false;
                updateVolumeUI();
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                video.volume = Math.max(0, video.volume - step);
                if (video.volume === 0) video.muted = true;
                updateVolumeUI();
                e.preventDefault();
            }
        });

        video.addEventListener('volumechange', updateVolumeUI);
        updateVolumeUI();
    }

    // ─── Fullscreen ──────────────────────────────────────────

    function setupFullscreen(container, video, els) {
        function isFullscreen() {
            return !!(document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);
        }

        function toggleFullscreen() {
            if (isFullscreen()) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            } else {
                // Try container fullscreen first
                var el = container;
                if (el.requestFullscreen) {
                    el.requestFullscreen();
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                } else if (el.mozRequestFullScreen) {
                    el.mozRequestFullScreen();
                } else if (el.msRequestFullscreen) {
                    el.msRequestFullscreen();
                } else if (video.webkitEnterFullscreen) {
                    // iOS Safari fallback
                    video.webkitEnterFullscreen();
                }
            }
        }

        function updateFsUI() {
            if (isFullscreen()) {
                els.fsBtn.innerHTML = icons.fullscreenExit;
                els.fsBtn.setAttribute('aria-label', 'Exit fullscreen');
                container.classList.add('is-fullscreen');
            } else {
                els.fsBtn.innerHTML = icons.fullscreen;
                els.fsBtn.setAttribute('aria-label', 'Fullscreen');
                container.classList.remove('is-fullscreen');
            }
        }

        els.fsBtn.addEventListener('click', toggleFullscreen);

        // Double-click on video = fullscreen
        video.addEventListener('dblclick', function (e) {
            e.preventDefault();
            toggleFullscreen();
        });

        document.addEventListener('fullscreenchange', updateFsUI);
        document.addEventListener('webkitfullscreenchange', updateFsUI);
        document.addEventListener('mozfullscreenchange', updateFsUI);
        document.addEventListener('MSFullscreenChange', updateFsUI);
    }

    // ─── Auto-hide Controls ─────────────────────────────────

    function setupAutoHide(container, video, els) {
        var hideTimer = null;
        var touchMode = isTouchDevice();

        function showControls() {
            container.classList.add('sevenls-vp-controls-visible');
            resetHideTimer();
        }

        function hideControls() {
            if (video.paused) return;
            container.classList.remove('sevenls-vp-controls-visible');
        }

        function resetHideTimer() {
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(hideControls, HIDE_DELAY);
            }
        }

        // Mouse events
        container.addEventListener('mouseenter', showControls);
        container.addEventListener('mousemove', showControls);
        container.addEventListener('mouseleave', function () {
            if (!video.paused) {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideControls, 800);
            }
        });

        // Touch: tap to toggle
        if (touchMode) {
            container.addEventListener('touchstart', function (e) {
                // Don't toggle if tapping controls area
                if (e.target.closest('.sevenls-vp-controls') ||
                    e.target.closest('.sevenls-vp-play-overlay')) {
                    return;
                }
                if (container.classList.contains('sevenls-vp-controls-visible') && !video.paused) {
                    hideControls();
                    clearTimeout(hideTimer);
                } else {
                    showControls();
                }
            }, { passive: true });
        }

        // Always show controls when paused
        video.addEventListener('pause', function () {
            clearTimeout(hideTimer);
            showControls();
        });

        video.addEventListener('play', function () {
            resetHideTimer();
        });

        video.addEventListener('ended', function () {
            clearTimeout(hideTimer);
            showControls();
        });

        // Start visible
        showControls();
    }

    // ─── Loading State ───────────────────────────────────────

    function setupLoadingState(container, video, els) {
        video.addEventListener('waiting', function () {
            setLoading(els, true);
        });
        video.addEventListener('canplay', function () {
            setLoading(els, false);
        });
        video.addEventListener('playing', function () {
            setLoading(els, false);
        });
        video.addEventListener('seeking', function () {
            setLoading(els, true);
        });
        video.addEventListener('seeked', function () {
            setLoading(els, false);
        });
    }

    // ─── Error Handler ───────────────────────────────────────

    function setupErrorHandler(container, video) {
        video.addEventListener('error', function () {
            var message = describeError(video);
            showError(container, message);
        });

        video.addEventListener('loadeddata', function () {
            clearError(container);
        });
    }

    // ─── Keyboard Shortcuts ──────────────────────────────────

    function setupKeyboard(container, video, els) {
        container.setAttribute('tabindex', '0');

        container.addEventListener('keydown', function (e) {
            // Only handle when container or its children are focused
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                    break;
                case 'ArrowRight':
                    if (document.activeElement === els.progressWrap || document.activeElement === els.volumeSlider) break;
                    e.preventDefault();
                    video.currentTime = clampTime(video, video.currentTime + 5);
                    break;
                case 'ArrowLeft':
                    if (document.activeElement === els.progressWrap || document.activeElement === els.volumeSlider) break;
                    e.preventDefault();
                    video.currentTime = clampTime(video, video.currentTime - 5);
                    break;
                case 'ArrowUp':
                    if (document.activeElement === els.volumeSlider) break;
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.05);
                    video.muted = false;
                    break;
                case 'ArrowDown':
                    if (document.activeElement === els.volumeSlider) break;
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.05);
                    break;
                case 'f':
                    e.preventDefault();
                    els.fsBtn.click();
                    break;
                case 'm':
                    e.preventDefault();
                    els.muteBtn.click();
                    break;
            }
        });
    }

    // ─── Init Player ─────────────────────────────────────────

    function initPlayer(container) {
        var video = container.querySelector('video');
        if (!video) {
            return;
        }

        // Skip if already initialized
        if (container.classList.contains('sevenls-vp-initialized')) {
            return;
        }
        container.classList.add('sevenls-vp-initialized');

        // Setup HLS
        setupHls(video);

        // Reduce direct download vectors from native/video UI interactions.
        setupSourceProtection(container, video);

        // Remove native controls (JS took over) — keeps `controls` as fallback if JS fails
        video.removeAttribute('controls');

        // Build custom controls
        var els = buildControlsUI(container);

        // Setup all control modules
        setupPlayPause(container, video, els);
        setupProgress(container, video, els);
        setupVolume(container, video, els);
        setupFullscreen(container, video, els);
        setupAutoHide(container, video, els);
        setupLoadingState(container, video, els);
        setupErrorHandler(container, video);
        setupKeyboard(container, video, els);

        // Show play overlay initially
        els.playOverlay.classList.add('is-visible');
    }

    // ─── Init All Players ────────────────────────────────────

    function initPlayers() {
        var containers = document.querySelectorAll('.sevenls-video-player');
        containers.forEach(function (container) {
            initPlayer(container);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPlayers);
    } else {
        initPlayers();
    }
})();
