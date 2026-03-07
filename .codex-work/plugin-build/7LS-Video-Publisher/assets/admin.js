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
                        button.textContent = '✓ Copied!';
                        button.classList.add('is-copied');
                        window.setTimeout(function () {
                            button.textContent = button.dataset.defaultLabel || 'Copy';
                            button.classList.remove('is-copied');
                        }, 2000);
                    })
                    .catch(function () {
                        button.textContent = 'Copy failed';
                        window.setTimeout(function () {
                            button.textContent = button.dataset.defaultLabel || 'Copy';
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

    function init() {
        setupCopyButtons();
        setupSmoothScroll();
        setupProgressBars();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
