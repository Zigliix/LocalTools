// Theme: respect saved choice, fallback to OS preference (default dark)
(function initTheme() {
    const root = document.documentElement;
    let saved = null;
    try {
        saved = localStorage.getItem("localall-theme");
    } catch {
        saved = null;
    }
    if (saved === "light" || saved === "dark") {
        root.setAttribute("data-theme", saved);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        root.setAttribute("data-theme", "light");
    } else {
        root.setAttribute("data-theme", "dark");
    }
})();

function updateThemeButtons() {
    const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
        btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
        btn.textContent = theme === "light" ? "☾" : "☀";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateThemeButtons();
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", next);
            try {
                localStorage.setItem("localall-theme", next);
            } catch {
                // private mode: ignore
            }
            updateThemeButtons();
        });
    });
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("js");

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealItems.forEach((item) => revealObserver.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}
