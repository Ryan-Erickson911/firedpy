document.addEventListener("scroll", () => {
    const btn = document.querySelector(".to-top");
    if (window.scrollY > 300) {
        btn.classList.add("show");
    } else {
        btn.classList.remove("show");
    }
});