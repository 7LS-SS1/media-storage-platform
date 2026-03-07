(function () {
    function getPostId(button) {
        var value = button.getAttribute('data-like-video');
        if (value) {
            return parseInt(value, 10);
        }
        if (window.SevenLSVP_Likes && window.SevenLSVP_Likes.postId) {
            return parseInt(window.SevenLSVP_Likes.postId, 10);
        }
        return 0;
    }

    function updateCount(button, count) {
        button.setAttribute('data-like-count', String(count));
        var target = button.querySelector('[data-like-count-value]');
        if (target) {
            target.textContent = String(count);
        }
    }

    function sendLike(button) {
        var postId = getPostId(button);
        if (!postId) {
            return;
        }
        if (button.dataset.likePending === '1') {
            return;
        }
        button.dataset.likePending = '1';

        var payload = new URLSearchParams();
        payload.append('action', 'sevenls_vp_like_video');
        payload.append('nonce', window.SevenLSVP_Likes ? window.SevenLSVP_Likes.nonce : '');
        payload.append('post_id', String(postId));

        fetch(window.SevenLSVP_Likes ? window.SevenLSVP_Likes.ajaxUrl : '', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: payload.toString()
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data && data.success && data.data && typeof data.data.count !== 'undefined') {
                    updateCount(button, data.data.count);
                }
            })
            .catch(function () {
                // Ignore errors for now.
            })
            .finally(function () {
                button.dataset.likePending = '0';
            });
    }

    function init() {
        var buttons = document.querySelectorAll('[data-like-video]');
        if (!buttons.length) {
            return;
        }
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                sendLike(button);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
