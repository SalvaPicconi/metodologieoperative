// Menu del sito nei telefoni: bottone «Menu», chiusura dopo la scelta,
// barra che si nasconde scorrendo in giù. Il menu stesso lo scrive scripts/nav.py.
(function () {
    function setupMobileNav() {
        const nav = document.querySelector('nav');
        const navList = nav?.querySelector('ul');
        if (!nav || !navList) {
            return;
        }

        if (!navList.id) {
            navList.id = 'site-navigation';
        }

        if (nav.querySelector('.nav-toggle')) {
            return;
        }

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', navList.id);
        toggle.setAttribute('aria-label', 'Apri il menu di navigazione');
        toggle.innerHTML = '<span class="nav-toggle-label">Menu</span><span class="nav-toggle-icon" aria-hidden="true">☰</span>';
        nav.insertBefore(toggle, nav.firstChild);

        // Con i sottomenu scrollHeight sottostima l'altezza: si sommano le voci
        const altezzaMenu = () => Math.max(
            navList.scrollHeight,
            [...navList.children].reduce((tot, li) => tot + li.offsetHeight, 0)
        );

        const mobileQuery = window.matchMedia('(max-width: 768px)');
        let lastScrollY = window.scrollY || 0;

        const collapseNav = () => {
            nav.classList.remove('nav-open');
            if (mobileQuery.matches) {
                navList.style.maxHeight = '0px';
                navList.style.opacity = '0';
                navList.style.visibility = 'hidden';
                navList.style.pointerEvents = 'none';
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                navList.style.maxHeight = '';
                navList.style.opacity = '';
                navList.style.visibility = '';
                navList.style.pointerEvents = '';
                toggle.setAttribute('aria-expanded', 'true');
            }
        };

        const expandNav = () => {
            nav.classList.add('nav-open');
            navList.style.maxHeight = `${altezzaMenu()}px`;
            navList.style.opacity = '1';
            navList.style.visibility = 'visible';
            navList.style.pointerEvents = 'auto';
            toggle.setAttribute('aria-expanded', 'true');
            nav.classList.remove('nav-hidden');
        };

        const updateMode = () => {
            if (mobileQuery.matches) {
                nav.classList.add('nav-collapsible');
                collapseNav();
            } else {
                nav.classList.remove('nav-collapsible', 'nav-hidden', 'nav-open');
                navList.style.maxHeight = '';
                navList.style.opacity = '';
                navList.style.visibility = '';
                navList.style.pointerEvents = '';
                toggle.setAttribute('aria-expanded', 'true');
            }
        };

        const handleScroll = () => {
            if (!mobileQuery.matches) {
                nav.classList.remove('nav-hidden');
                lastScrollY = window.scrollY || 0;
                return;
            }

            const current = window.scrollY || 0;
            if (nav.classList.contains('nav-open')) {
                lastScrollY = current;
                return;
            }

            if (current > lastScrollY && current > 80) {
                nav.classList.add('nav-hidden');
            } else {
                nav.classList.remove('nav-hidden');
            }
            lastScrollY = current;
        };

        toggle.addEventListener('click', () => {
            if (nav.classList.contains('nav-open')) {
                collapseNav();
            } else {
                expandNav();
            }
        });

        navList.addEventListener('click', event => {
            if (mobileQuery.matches && event.target.closest('a')) {
                collapseNav();
            }
        });

        const onMediaChange = () => {
            updateMode();
            handleScroll();
        };

        if (typeof mobileQuery.addEventListener === 'function') {
            mobileQuery.addEventListener('change', onMediaChange);
        } else if (typeof mobileQuery.addListener === 'function') {
            mobileQuery.addListener(onMediaChange);
        }

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', () => {
            if (nav.classList.contains('nav-open') && mobileQuery.matches) {
                navList.style.maxHeight = `${altezzaMenu()}px`;
            }
        });

        updateMode();
        handleScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMobileNav);
    } else {
        setupMobileNav();
    }
})();
