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
}