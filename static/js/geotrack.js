// /**
//  * GeoTrack Analytics - Client-Side Tracking Script
//  * Secure, privacy-focused website analytics
//  */

// (function() {
//     'use strict';

//     // Configuration
//     const config = {
//         siteKey: null,
//         apiUrl: null,
//         debug: false,
//         autoTrack: true,
//         trackOutbound: true,
//         respectDNT: true
//     };

//     // Get site key from script tag
//     function init() {
//         const script = document.currentScript || document.querySelector('script[data-site-key]');
//         if (!script) {
//             console.error('[GeoTrack] Script tag not found');
//             return;
//         }

//         config.siteKey = script.getAttribute('data-site-key');
//         config.apiUrl = script.getAttribute('data-api-url') || detectApiUrl();
//         config.debug = script.getAttribute('data-debug') === 'true';
//         config.autoTrack = script.getAttribute('data-auto-track') !== 'false';

//         if (!config.siteKey) {
//             console.error('[GeoTrack] Site key is required');
//             return;
//         }

//         if (config.debug) {
//             console.log('[GeoTrack] Initialized with config:', config);
//         }

//         // Check Do Not Track
//         if (config.respectDNT && navigator.doNotTrack === '1') {
//             if (config.debug) console.log('[GeoTrack] DNT enabled, tracking disabled');
//             return;
//         }

//         // Auto-track pageview
//         if (config.autoTrack) {
//             trackPageview();
//         }

//         // Track outbound links
//         if (config.trackOutbound) {
//             setupOutboundTracking();
//         }

//         // Track page visibility
//         setupVisibilityTracking();
//     }

//     // Detect API URL based on environment
//     function detectApiUrl() {
//         const hostname = window.location.hostname;
        
//         // Local development
//         if (hostname === 'localhost' || hostname === '127.0.0.1') {
//             return 'http://localhost:8000';
//         }
        
//         // Production - use same origin
//         return window.location.origin;
//     }

//     // Get visitor fingerprint (privacy-friendly)
//     function getVisitorHash() {
//         const data = [
//             navigator.userAgent,
//             navigator.language,
//             screen.width + 'x' + screen.height,
//             new Date().getTimezoneOffset()
//         ].join('|');

//         // Simple hash function
//         let hash = 0;
//         for (let i = 0; i < data.length; i++) {
//             const char = data.charCodeAt(i);
//             hash = ((hash << 5) - hash) + char;
//             hash = hash & hash;
//         }
//         return Math.abs(hash).toString(36);
//     }

//     // Get device type
//     function getDeviceType() {
//         const ua = navigator.userAgent;
//         if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
//             return 'tablet';
//         }
//         if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
//             return 'mobile';
//         }
//         return 'desktop';
//     }

//     // Get browser info
//     function getBrowserInfo() {
//         const ua = navigator.userAgent;
//         let browser = 'Unknown';
        
//         if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
//         else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung';
//         else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
//         else if (ua.indexOf('Trident') > -1) browser = 'IE';
//         else if (ua.indexOf('Edge') > -1) browser = 'Edge';
//         else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
//         else if (ua.indexOf('Safari') > -1) browser = 'Safari';
        
//         return browser;
//     }

//     // Get OS info
//     function getOSInfo() {
//         const ua = navigator.userAgent;
//         let os = 'Unknown';
        
//         if (ua.indexOf('Win') > -1) os = 'Windows';
//         else if (ua.indexOf('Mac') > -1) os = 'MacOS';
//         else if (ua.indexOf('Linux') > -1) os = 'Linux';
//         else if (ua.indexOf('Android') > -1) os = 'Android';
//         else if (ua.indexOf('iOS') > -1) os = 'iOS';
        
//         return os;
//     }

//     // Get referrer
//     function getReferrer() {
//         return document.referrer || '(direct)';
//     }

//     // Send event to API
//     function sendEvent(eventType, eventData = {}) {
//         const payload = {
//             event_type: eventType,
//             url: window.location.href,
//             referrer: getReferrer(),
//             visitor_hash: getVisitorHash(),
//             device_type: getDeviceType(),
//             browser: getBrowserInfo(),
//             os: getOSInfo(),
//             screen_width: screen.width,
//             screen_height: screen.height,
//             language: navigator.language,
//             timestamp: new Date().toISOString(),
//             ...eventData
//         };

//         if (config.debug) {
//             console.log('[GeoTrack] Sending event:', eventType, payload);
//         }

//         // Send via beacon API (non-blocking)
//         const url = `${config.apiUrl}/api/v1/collect/collect`;
//         const data = JSON.stringify(payload);

//         if (navigator.sendBeacon) {
//             const blob = new Blob([data], { type: 'application/json' });
//             const headers = new Headers({
//                 'X-Site-Key': config.siteKey,
//                 'Content-Type': 'application/json'
//             });
//             navigator.sendBeacon(url, blob);
//         } else {
//             // Fallback to fetch
//             fetch(url, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'X-Site-Key': config.siteKey
//                 },
//                 body: data,
//                 keepalive: true
//             }).catch(err => {
//                 if (config.debug) console.error('[GeoTrack] Error sending event:', err);
//             });
//         }
//     }

//     // Track pageview
//     function trackPageview() {
//         sendEvent('pageview');
//     }

//     // Track custom event
//     function track(eventName, eventData = {}) {
//         sendEvent(eventName, eventData);
//     }

//     // Setup outbound link tracking
//     function setupOutboundTracking() {
//         document.addEventListener('click', function(e) {
//             const link = e.target.closest('a');
//             if (!link) return;

//             const href = link.getAttribute('href');
//             if (!href || href.startsWith('#')) return;

//             // Check if outbound
//             const isOutbound = link.hostname && link.hostname !== window.location.hostname;
//             if (isOutbound) {
//                 track('outbound_click', {
//                     url: href,
//                     text: link.textContent.trim().substring(0, 100)
//                 });
//             }
//         }, true);
//     }

//     // Setup visibility tracking
//     function setupVisibilityTracking() {
//         let startTime = Date.now();
//         let isVisible = !document.hidden;

//         document.addEventListener('visibilitychange', function() {
//             if (document.hidden) {
//                 // Page hidden - track time spent
//                 const timeSpent = Math.round((Date.now() - startTime) / 1000);
//                 if (timeSpent > 0) {
//                     track('time_on_page', { duration: timeSpent });
//                 }
//                 isVisible = false;
//             } else {
//                 // Page visible again
//                 startTime = Date.now();
//                 isVisible = true;
//             }
//         });

//         // Track on page unload
//         window.addEventListener('beforeunload', function() {
//             if (isVisible) {
//                 const timeSpent = Math.round((Date.now() - startTime) / 1000);
//                 if (timeSpent > 0) {
//                     track('time_on_page', { duration: timeSpent });
//                 }
//             }
//         });
//     }

//     // Public API
//     window.GeoTrack = {
//         track: track,
//         trackPageview: trackPageview,
//         config: config
//     };

//     // Auto-initialize
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', init);
//     } else {
//         init();
//     }

// })();


/**
 * GeoTrack Analytics - Client-Side Tracking Script
 * Secure, privacy-focused website analytics
 */

(function() {
    'use strict';

    // Configuration
    const config = {
        siteKey: null,
        apiUrl: null,
        debug: false,
        autoTrack: true,
        trackOutbound: true,
        respectDNT: true
    };

    // Get site key from script tag
    function init() {
        const script = document.currentScript || document.querySelector('script[data-site-key]');
        if (!script) {
            console.error('[GeoTrack] Script tag not found');
            return;
        }

        config.siteKey  = script.getAttribute('data-site-key');
        config.apiUrl   = script.getAttribute('data-api-url') || detectApiUrl();
        config.debug    = script.getAttribute('data-debug') === 'true';
        config.autoTrack = script.getAttribute('data-auto-track') !== 'false';

        if (!config.siteKey) {
            console.error('[GeoTrack] Site key is required');
            return;
        }

        if (config.debug) {
            console.log('[GeoTrack] ✅ Initialized:', {
                siteKey: config.siteKey,
                apiUrl:  config.apiUrl
            });
        }

        // Check Do Not Track
        if (config.respectDNT && navigator.doNotTrack === '1') {
            if (config.debug) console.log('[GeoTrack] DNT enabled, tracking disabled');
            return;
        }

        // Auto-track pageview
        if (config.autoTrack) {
            trackPageview();
        }

        // Track outbound links
        if (config.trackOutbound) {
            setupOutboundTracking();
        }

        // Track page visibility
        setupVisibilityTracking();
    }

    // ✅ FIXED: Detect API URL based on environment
    function detectApiUrl() {
        const hostname = window.location.hostname;
        
        // Local development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        }
        
        // ✅ PRODUCTION: Backend URL
        // data-api-url attribute se aayega - yahan fallback hai
        // Yeh tab use hoga jab data-api-url attribute missing ho
        return '__VITE_API_URL__' ||'https://unhypothecated-archer-unmovingly.ngrok-free.dev'; // fallback
    }

    // Get visitor fingerprint (privacy-friendly)
    function getVisitorHash() {
        const data = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ].join('|');

        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Get device type
    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    // Get browser info
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        
        if (ua.indexOf('Firefox') > -1)        browser = 'Firefox';
        else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung';
        else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
        else if (ua.indexOf('Trident') > -1)   browser = 'IE';
        else if (ua.indexOf('Edge') > -1)      browser = 'Edge';
        else if (ua.indexOf('Chrome') > -1)    browser = 'Chrome';
        else if (ua.indexOf('Safari') > -1)    browser = 'Safari';
        
        return browser;
    }

    // Get OS info
    function getOSInfo() {
        const ua = navigator.userAgent;
        let os = 'Unknown';
        
        if (ua.indexOf('Win') > -1)     os = 'Windows';
        else if (ua.indexOf('Mac') > -1)    os = 'MacOS';
        else if (ua.indexOf('Linux') > -1)  os = 'Linux';
        else if (ua.indexOf('Android') > -1) os = 'Android';
        else if (ua.indexOf('iOS') > -1)    os = 'iOS';
        
        return os;
    }

    // Get referrer
    function getReferrer() {
        return document.referrer || '(direct)';
    }

    // ✅ FIXED: Send event to API - proper headers + fetch only
    function sendEvent(eventType, eventData = {}) {
        const payload = {
            event_type:    eventType,
            url:           window.location.href,
            page_title:    document.title,
            referrer:      getReferrer(),
            visitor_hash:  getVisitorHash(),
            device_type:   getDeviceType(),
            browser:       getBrowserInfo(),
            os:            getOSInfo(),
            screen_width:  screen.width,
            screen_height: screen.height,
            language:      navigator.language,
            timestamp:     new Date().toISOString(),
            ...eventData
        };

        if (config.debug) {
            console.log('[GeoTrack] 📤 Sending event:', eventType, payload);
        }

        // ✅ API URL - trailing slash remove karo
        const url = config.apiUrl.replace(/\/$/, '') + '/api/v1/collect/collect';

        // ✅ FIXED: Use fetch only (sendBeacon X-Site-Key header support nahi karta)
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Site-Key':   config.siteKey  // ✅ Site key header mein
            },
            body: JSON.stringify(payload),
            keepalive: true  // Page unload par bhi kaam karega
        })
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(data) {
            if (config.debug) {
                console.log('[GeoTrack] ✅ Event saved:', data);
            }
        })
        .catch(function(err) {
            if (config.debug) {
                console.error('[GeoTrack] ❌ Error:', err);
            }
        });
    }

    // Track pageview
    function trackPageview() {
        sendEvent('pageview', {
            event_name: 'page_view'
        });
    }

    // Track custom event
    function track(eventName, eventData = {}) {
        sendEvent('custom', {
            event_name: eventName,
            event_data: eventData
        });
    }

    // Setup outbound link tracking
    function setupOutboundTracking() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) return;

            const isOutbound = link.hostname && link.hostname !== window.location.hostname;
            if (isOutbound) {
                sendEvent('click', {
                    event_name: 'outbound_click',
                    event_data: {
                        url:  href,
                        text: link.textContent.trim().substring(0, 100)
                    }
                });
            }
        }, true);
    }

    // Setup visibility tracking (time on page)
    function setupVisibilityTracking() {
        let startTime  = Date.now();
        let isVisible  = !document.hidden;

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                const timeSpent = Math.round((Date.now() - startTime) / 1000);
                if (timeSpent > 0) {
                    sendEvent('custom', {
                        event_name: 'time_on_page',
                        event_data: { duration_seconds: timeSpent }
                    });
                }
                isVisible = false;
            } else {
                startTime = Date.now();
                isVisible = true;
            }
        });

        window.addEventListener('beforeunload', function() {
            if (isVisible) {
                const timeSpent = Math.round((Date.now() - startTime) / 1000);
                if (timeSpent > 0) {
                    // ✅ beforeunload mein sendBeacon use karo (fetch block ho sakti hai)
                    const url  = config.apiUrl.replace(/\/$/, '') + '/api/v1/collect/collect';
                    const data = JSON.stringify({
                        event_type:   'custom',
                        event_name:   'time_on_page',
                        event_data:   { duration_seconds: timeSpent },
                        url:          window.location.href,
                        visitor_hash: getVisitorHash(),
                        timestamp:    new Date().toISOString()
                    });
                    
                    // sendBeacon site_key query param mein
                    if (navigator.sendBeacon) {
                        navigator.sendBeacon(
                            url + '?site_key=' + config.siteKey, 
                            new Blob([data], { type: 'application/json' })
                        );
                    }
                }
            }
        });
    }

    // ✅ Public API
    window.GeoTrack = {
        track:         track,
        trackPageview: trackPageview,
        config:        config
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();