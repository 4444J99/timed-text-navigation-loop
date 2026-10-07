// Twelve historical destinations. Selection is uniformly random and always valid.
// The original off-by-one selector could navigate to an undefined thirteenth URL.
function randomlinks() {
    var links = [
        "labyrinth/040615.html",
        "labyrinth/040715.html",
        "labyrinth/040815.html",
        "labyrinth/040915.html",
        "labyrinth/041015.html",
        "labyrinth/041315.html",
        "labyrinth/041415.html",
        "labyrinth/041715.html",
        "labyrinth/042115.html",
        "labyrinth/042215.html",
        "labyrinth/051815.html",
        "labyrinth/072716.html"
    ];
    window.location = links[Math.floor(Math.random() * links.length)];
}
