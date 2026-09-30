(() => {
    "use strict";

    const select = document.getElementById("gift17Picture");

    if (!select) {
        console.error("[Gift17] Picture selector not found.");
        return;
    }

    const manifestURL = "./gift17-images.json";

    function waitForPuzzle(callback) {
        if (typeof puzzle !== "undefined" && puzzle && puzzle.srcImage) {
            callback(puzzle);
            return;
        }

        setTimeout(() => waitForPuzzle(callback), 50);
    }

    async function loadLibrary() {
        try {
            const response = await fetch(manifestURL, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const pictures = await response.json();

            select.innerHTML = "";

            pictures.forEach((picture) => {
                const option = document.createElement("option");

                option.value = picture.file;
                option.textContent = picture.name;

                select.appendChild(option);
            });

            if (!pictures.length) {
                throw new Error("No pictures found.");
            }

            select.value = pictures[0].file;

            waitForPuzzle((puzzle) => {
                setPicture(puzzle, pictures[0]);
            });

            console.log(
                `[Gift17] Picture library ready: ${pictures.length} pictures`
            );

        } catch (error) {
            console.error("[Gift17] Picture library failed:", error);

            select.innerHTML =
                '<option value="">Picture library unavailable</option>';
        }
    }

    function setPicture(puzzle, picture) {
        if (!picture || !picture.file) {
            return;
        }

        /*
         * This is intentionally the ONLY thing we change.
         * The original Jigsaw engine owns:
         *
         * - image loading
         * - imageLoaded()
         * - Show Image
         * - Start Game
         * - puzzle creation
         * - piece generation
         * - dragging
         * - rotation
         * - saving/restoring
         */

        puzzle.imageLoaded = false;

        puzzle.srcImage.dataset.origin =
            "gift17-picture-" + String(picture.number).padStart(2, "0");

        puzzle.srcImage.src = picture.file;

        console.log(
            "[Gift17] Selected:",
            picture.name,
            picture.file
        );
    }

    select.addEventListener("change", () => {
        const file = select.value;

        if (!file) {
            return;
        }

        waitForPuzzle((puzzle) => {
            const option = select.options[select.selectedIndex];

            setPicture(puzzle, {
                number: select.selectedIndex + 1,
                name: option.textContent,
                file
            });
        });
    });

    loadLibrary();
})();
