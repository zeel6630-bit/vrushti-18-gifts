"use strict";
        // last update: 2026/05/01
        let puzzle, autoStart;
        let playing;
        let useMouse = true;
        let lastMousePos;
        let ui; // user interface (menu)

        /*
         * Gift 17 built-in picture library.
         * The images are stored locally inside this gift.
         */
        const GIFT17_IMAGES = Array.from({ length: 18 }, (_, i) =>
            `./images/${String(i + 1).padStart(2, "0")}.jpg`
        );

        let gift17PictureIndex = 0;
        let gift17Theme = localStorage.getItem("gift17-theme") || "dark";
        
        const fileExtension = ".puz";
        const fileSignature = "pzfilecct"; // just to check reloaded game has a chance to be a good one

        const mhypot = Math.hypot,
            mrandom = Math.random,
            mmax = Math.max,
            mmin = Math.min,
            mround = Math.round,
            mfloor = Math.floor,
            mceil = Math.ceil,
            msqrt = Math.sqrt,
            mabs = Math.abs;
        //-----------------------------------------------------------------------------
        function isMiniature() {
            return location.pathname.includes('/fullcpgrid/'); // special for Codepen
        }
        //-----------------------------------------------------------------------------
        function alea(min, max) {
            // random number [min..max[ . If no max is provided, [0..min[

            if (typeof max == 'undefined') return min * mrandom();
            return min + (max - min) * mrandom();
        }
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        function intAlea(min, max) {
            // random integer number [min..max[ . If no max is provided, [0..min[

            if (typeof max == 'undefined') {
                max = min; min = 0;
            }
            return mfloor(min + (max - min) * mrandom());
        } // intAlea
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        function arrayShuffle(array) {
            /* randomly changes the order of items in an array
            only the order is modified, not the elements
            */
            let k1, temp;
            for (let k = array.length - 1; k >= 1; --k) {
                k1 = intAlea(0, k + 1);
                temp = array[k];
                array[k] = array[k1];
                array[k1] = temp;
            } // for k
            return array
        } // arrayShuffle
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        function lerp(p0, p1, alpha) {
            return { x: p0.x * (1 - alpha) + p1.x * alpha, y: p0.y * (1 - alpha) + p1.y * alpha }
        }
        //------------------------------------------------------------------------
        /* function below used to generate reproducible sequences of pseudo-random numbers
        one instance is used to create the details of the shapes of the pieces
        so that only the seed of the function needs to be saved for save / restore operations of the puzzle
        */

        /* based on a function found at https://www.grc.com/otg/uheprng.htm
and customized to my needs

use :
  x = mMash('1213'); // returns a resettable, reproducible pseudo-random number generator function
  x = mMash();  // like line above, but uses Math.random() for a seed
  x();         // returns pseudo-random number in range [0..1[;
  x.reset();   // re-initializes the sequence with the same seed. Even if Mash was invoked without seed, will generate the same sequence.
  x.seed;      // retrieves the internal seed actually used. May be useful if no seed or non-string seed provided to Mash
               be careful : this internal seed is a String, even if it may look like a number. Changing or omitting any single digit will produce a completely different sequence
  x.intAlea(min, max) returns integer in the range [min..max[ (or [0..min[ if max not provided)
  x.alea(min, max) returns float in the range [min..max[ (or [0..min[ if max not provided)
*/

        /*	============================================================================
            This is based upon Johannes Baagoe's carefully designed and efficient hash
            function for use with JavaScript.  It has a proven "avalanche" effect such
            that every bit of the input affects every bit of the output 50% of the time,
            which is good.	See: http://baagoe.com/en/RandomMusings/hash/avalanche.xhtml
            ============================================================================
        */
        /* seed may be almost anything not evaluating to false */
        function mMash(seed) {
            let n = 0xefc8249d;
            let intSeed = (seed || Math.random()).toString();

            function mash(data) {
                if (data) {
                    data = data.toString();
                    for (var i = 0; i < data.length; i++) {
                        n += data.charCodeAt(i);
                        var h = 0.02519603282416938 * n;
                        n = h >>> 0;
                        h -= n;
                        h *= n;
                        n = h >>> 0;
                        h -= n;
                        n += h * 0x100000000; // 2^32
                    }
                    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
                } else n = 0xefc8249d;
            };
            mash(intSeed); // initial value based on seed

            let mmash = () => mash('A'); // could as well be 'B' or '!' or any non falsy value
            mmash.reset = () => { mash(); mash(intSeed) }
            Object.defineProperty(mmash, 'seed', { get: () => intSeed });
            mmash.intAlea = function (min, max) {
                if (typeof max == 'undefined') {
                    max = min; min = 0;
                }
                return mfloor(min + (max - min) * this());
            }
            mmash.alea = function (min, max) {
                // random number [min..max[ . If no max is provided, [0..min[

                if (typeof max == 'undefined') return min * this();
                return min + (max - min) * this();
            }

            return mmash;
        } // mMash

        //------------------------------------------------------------------------
        async function saveFile(data, fileName) {

            if (!("showSaveFilePicker" in window) || window.top !== window.self) { // showSaveFilePicker, use old donload method
                download(data, fileName,
                    {
                        mediaType: 'text/plain;charset=utf8',
                        preEncoded: false
                    });
                return;
            }
            try {
                // Show the file save dialog.
                const pickerOpts = {
                    id: "puzz",
                    excludeAcceptAllOption: false,
                    suggestedName: fileName,
                    types: [
                        {
                            description: "PUZ file",
                            accept: { "text/plain": [".puz"] },
                        },
                    ],
                };

                const handle = await showSaveFilePicker(pickerOpts);
                // Write the blob to the file.
                const writable = await handle.createWritable();
                await writable.write(data);
                await writable.close();
                return;
            } catch (err) {
                if (err.name == "AbortError") return; // no message required if user cancelled
                popup(["Something went wrong saving your game.",
                    `Error message: ${err}`]);
            }

        } // saveFile
        //------------------------------------------------------------------------
        function download(data, fileName, options = {}) {
            /* data (string) containing the data to record
               filename (string) the name to give to the file
            */

            /* based on code found in a pen by Johann Karlsson https://codepen.io/DonKarlssonSan */
            /* proposes to the user to save a file containing data from the program */

            let mediaType = ''; // no type results in text/plain;charset=US-ASCII
            if (typeof options.mediaType == 'string') mediaType = options.mediaType;
            /* mediaType MUST include ';base64' if provided data is base64-encoded */
            /* mediaType DOES NOT end with a ',' character (appended in program) */

            let preEncoded = false;
            if (typeof options.preEncoded == 'boolean') preEncoded = options.preEncoded;

            if (!preEncoded) data = encodeURIComponent(data);

            let element = document.createElement("a");
            element.setAttribute("href", "data:" + mediaType + ',' + data);
            element.setAttribute("download", fileName);
            element.style.display = "none";
            document.body.appendChild(element);
            element.addEventListener("click", e => e.stopPropagation());
            element.click();
            document.body.removeChild(element);
        } // download

        //------------------------------------------------------------------------

        class Modal {
            constructor(properties) {

                // properties : {lines, buttons}
                // lines : [strings] will be displayed in separate <p> tags
                // buttons :[{text:string, callback(optional):function}]

                let modal = document.createElement("dialog");
                modal.style.borderRadius = "5px";
                if (properties.lines) {
                    properties.lines.forEach(line => {
                        const p = document.createElement("p");
                        p.append(line);
                        modal.append(p);
                    })
                }
                if (properties?.buttons?.length > 0) {
                    const p = document.createElement("p");
                    modal.append(p);
                    p.style.display = "flex";
                    p.style.justifyContent = "center";
                    properties.buttons.forEach(buttonObj => {
                        const button = document.createElement("button");
                        button.setAttribute("type", "button");
                        button.style.marginRight = "1em";
                        button.style.marginLeft = "1em";
                        button.innerText = buttonObj.text || "button";
                        p.append(button);
                        button.addEventListener("click", () => {
                            modal.remove();
                            modal = null;
                            if (buttonObj.callback) buttonObj.callback();
                        });
                    })

                } else {
                    modal.addEventListener("click", () => {
                        modal.remove();
                        modal = null;
                    })
                }
                document.body.append(modal);
                modal.showModal();
            } // constructor
        } // class Modal

        function popup(lines) {
            // basic Modal with lines of text, and a "close" button - no callback
            new Modal({
                lines: lines, buttons: [{ text: "close" }]
            });

        } // popup
        //------------------------------------------------------------------------
        //------------------------------------------------------------------------
        // User Interface (controls)
        //------------------------------------------------------------------------
        function prepareUI() {

            // toggle menu handler
            let menu = document.getElementById("menu");
            let controls = document.getElementById("controls");

            ui = {};  // User Interface HTML elements

            ["default", "load", "enablerot", "enablerotlabel", "shape", "nbpieces", "start", "stop",
                "helpstorage", "save", "restore", "helpfile", "fsave", "frestore",
                "help", "helpstorage", "helpfile", "saveas", "saveext", "drawmode", "show", "gift17Picture", "themeToggle"].forEach(ctrlName => ui[ctrlName] = document.getElementById(ctrlName));

            ui.open = () => {
                menu.classList.remove("hidden");
                controls.innerHTML = "close controls";
            }
            ui.close = () => {
                menu.classList.add("hidden");
                controls.innerHTML = "open controls";
            }

            ui.waiting = () => {
                ui.default.removeAttribute("disabled");
                ui.load.removeAttribute("disabled");
                ui.shape.removeAttribute("disabled");
                ui.nbpieces.removeAttribute("disabled");
                ui.enablerot.removeAttribute("disabled");
                ui.start.removeAttribute("disabled");
                ui.stop.setAttribute("disabled", "");
                ui.save.setAttribute("disabled", "");
                ui.restore.removeAttribute("disabled");
                ui.fsave.setAttribute("disabled", "");
                ui.frestore.removeAttribute("disabled");
                ui.show.setAttribute("disabled", "");
            }
            ui.playing = () => {
                ui.default.setAttribute("disabled", "");
                ui.load.setAttribute("disabled", "");
                ui.shape.setAttribute("disabled", "");
                ui.nbpieces.setAttribute("disabled", "");
                ui.enablerot.setAttribute("disabled", "");
                ui.start.setAttribute("disabled", "");
                ui.stop.removeAttribute("disabled");
                ui.save.removeAttribute("disabled");
                ui.restore.setAttribute("disabled", "");
                ui.fsave.removeAttribute("disabled");
                ui.frestore.setAttribute("disabled", "");
                ui.show.removeAttribute("disabled");
            }

            ui.saveext.innerHTML = fileExtension;

            /*
             * Gift 17 theme selector.
             * This changes presentation only.
             */
            const applyGift17Theme = () => {
                document.documentElement.dataset.gift17Theme = gift17Theme;
                document.body.dataset.gift17Theme = gift17Theme;

                if (ui.themeToggle) {
                    const icon = ui.themeToggle.querySelector(".theme-icon");
                    const label = ui.themeToggle.querySelector(".theme-label");

                    if (gift17Theme === "dark") {
                        if (icon) icon.textContent = "☀";
                        if (label) label.textContent = "Light theme";
                    } else {
                        if (icon) icon.textContent = "☾";
                        if (label) label.textContent = "Dark theme";
                    }
                }
            };

            applyGift17Theme();

            ui.themeToggle?.addEventListener("click", () => {
                gift17Theme = gift17Theme === "dark" ? "light" : "dark";
                localStorage.setItem("gift17-theme", gift17Theme);
                applyGift17Theme();
            });

            ui.gift17Picture?.addEventListener("change", () => {
                gift17PictureIndex = Math.max(
                    0,
                    Math.min(
                        GIFT17_IMAGES.length - 1,
                        Number(ui.gift17Picture.value) - 1
                    )
                );
            });

            controls.addEventListener("click", () => { // toggle open/close
                if (menu.classList.contains("hidden")) ui.open(); else ui.close();
            });

            ui.default.addEventListener("click", loadInitialFile);
            ui.load.addEventListener("click", loadFile);
            ui.start.addEventListener("click", startGame);
            ui.stop.addEventListener("click", confirmStop);
            ui.save.addEventListener("click", () => events.push({ event: "save" }));
            ui.restore.addEventListener("click", () => events.push({ event: "restore" }));
            ui.fsave.addEventListener("click", () => events.push({ event: "save", file: true }));
            ui.frestore.addEventListener("click", () => {
                loadSaved(); // for Safari, the load file process only works if run from an event listener
                events.push({ event: "restore", file: true });
            });
            ui.help.addEventListener("click", () => popup(helptext));
            ui.helpstorage.addEventListener("click", () => popup(helpstoragetext));
            ui.helpfile.addEventListener("click", () => popup(helpfiletext));
            ui.show.addEventListener("click", () => puzzle.showImage(true));
        }
        //-----------------------------------------------------------------------------
        function makeSaveFileName(src) {
            /* builds a name suitable for a file (without extension) base on input string.
            the input string is supposed to be an url with a "http" or "https" protocol, or a text that can reasonably be converted to a filename
            if it is an url, it is parsed to keep the last portion of its path name (after the last "/")
            the extension part (after the last "." if any) is stripped
            this names is copied to the user interface "save name" input field
            */
            if (URL.canParse(src)) {
                src = URL.parse(src).pathname;
                // keep last part of pathname
                src = src.split("/").at(-1);// keep only part after last("/")
            } // if canParse
            src = src.trim();
            if (src.length == 0) src = "save";
            // strip extension if any
            let lsti = src.lastIndexOf(".");
            if (lsti != -1) src = src.substring(0, lsti);
            src = src.trim();
            if (src.length == 0) src = "save";
            // very elementary cleaning
            let nname = "";
            for (let k = 0; k < src.length; ++k) {
                const c = src.charAt(k);
                if ("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-".indexOf(c) != -1) nname += c;
                else nname += "_"
            }
            ui.saveas.value = nname;
            return nname;
        } // makeSaveFileName

        //-----------------------------------------------------------------------------
        function startGame() {
            events.push({ event: "nbpieces", nbpieces: Number(ui.nbpieces.value) });
        }
        function confirmStop() {
            if (!playing) return; // ignore if not playing
            new Modal({
                lines: ["Are you sure you want to stop this game ?"],
                buttons: [{ text: "stop", callback: () => events.push({ event: "stop" }) },
                { text: "continue" }
                ]
            });
        }
        //------------------------------------------------------------------------
        const helptext = ["Thank you for playing my jigsaw puzzle game.",
            "You can play with a default picture, or load any jpeg, png or other kind of picture from your computer.",
            "Check the \"enable rotation\" checkbox to randomly rotate the pieces. Rotate the pieces by clicking/tapping them.",
            "Choose from the different piece shapes available.",
            "Choose the number of pieces. This is not an accurate value, depending on the dimensions of your picture, the exact number of pieces may be slightly different.",
            "You can zoom in and out with the mouse wheel or by pinching, or with the keyboard keys Ctrl + and Ctrl -.",
            "You can move the whole game at a time in any direction by touching the surface outside of any piece, and moving around. Combined with the zoom feature, this gives you access to a virtually unlimited game area.",
            "Last, you can save a game in progress, and restore it later. Two methods are proposed, see individual help buttons for details."
        ];

        const helpstoragetext = ["With this method, the game is saved in your browser's data.",
            "This method is fast - really a one-click action - but with a few drawbacks.",
            "Although it is very popular, this method is not available on some devices.",
            "Only one game can be saved at a time: every saved game replaces the previous one.",
            "Furthermore, this method can fail, with locally loaded images bigger than a few Mb. A message will be issued in case of failure"];

        const helpfiletext = ["This method stores the saved game in your download folder. Use the \"save name\" field to save different games with different names.",
            "On some devices, you are not limited to the download folder: you will be prompted for the destination folder and name.",
        ];
        //------------------------------------------------------------------------
        //------------------------------------------------------------------------

        function getTransformMatrix(orgx, orgy, scale, rot, destx, desty) {

            const rotMatrices = [, new DOMMatrix([0, 1, -1, 0, 0, 0]),
                new DOMMatrix([-1, 0, 0, -1, 0, 0]),
                new DOMMatrix([0, -1, 1, 0, 0, 0])];
            let mat = new DOMMatrix([1, 0, 0, 1, destx, desty]); // translation (destx,desty)
            if (rot) mat.multiplySelf(rotMatrices[rot]);
            mat.scaleSelf(scale, scale);
            return mat.translateSelf(-orgx, -orgy);
        } //
        //-----------------------------------------------------------------------------
        // one side of a piece
        class Side {
            constructor() {
                this.type = ""; // "d" pour straight line or "z" pour classic
                this.points = []; // real points or Bezier curve points
            } // Side

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            reversed() {
                // returns a new Side, copy of current one but reversed
                const ns = new Side();
                ns.type = this.type;
                ns.points = this.points.slice().reverse();
                return ns;
            } // Side.reversed

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            /*
            draws the path corresponding to a side
            Parameters :
              path : path2D or ctx where the path will be drawn
              first : true to begin with moveTo, false to continue already begun path
            */
            drawSrcPath(path, first) {
                // raw draw in path
                if (first) {
                    path.moveTo(this.points[0].x, this.points[0].y);
                }
                if (this.type == "d") {
                    path.lineTo(this.points[1].x, this.points[1].y);
                } else { // edge zigzag
                    for (let k = 1; k < this.points.length - 1; k += 3) {
                        path.bezierCurveTo(this.points[k].x, this.points[k].y,
                            this.points[k + 1].x, this.points[k + 1].y,
                            this.points[k + 2].x, this.points[k + 2].y);
                    } // for k
                } // if jigsaw side
            } // Side.drawSrcPath

        } // class Side
        //-----------------------------------------------------------------------------
        /* modifies a side
          changes it from a straight line (type "d") to a complex one (type "z")
          The change is done towards the opposite side (side between corners ca and cb)
        */
        function twist0(side, ca, cb) {

            const p0 = side.points[0];
            const p1 = side.points[1];
            const dxh = p1.x - p0.x;
            const dyh = p1.y - p0.y;

            const mid0 = lerp(p0, p1, 0.5);
            const mid1 = lerp(ca, cb, 0.5);

            const dxv = mid1.x - mid0.x;
            const dyv = mid1.y - mid0.y;

            const scalex = puzzle.prng.alea(0.8, 1);
            const scaley = puzzle.prng.alea(0.9, 1);
            const mid = puzzle.prng.alea(0.45, 0.55);

            const pa = pointAt(mid - 1 / 12 * scalex, 1 / 12 * scaley);
            const pb = pointAt(mid - 2 / 12 * scalex, 3 / 12 * scaley);
            const pc = pointAt(mid, 4 / 12 * scaley);
            const pd = pointAt(mid + 2 / 12 * scalex, 3 / 12 * scaley);
            const pe = pointAt(mid + 1 / 12 * scalex, 1 / 12 * scaley);

            side.points = [p0,
                {
                    x: p0.x + 5 / 12 * dxh * 0.52,
                    y: p0.y + 5 / 12 * dyh * 0.52
                },
                {
                    x: pa.x - 1 / 12 * dxv * 0.72,
                    y: pa.y - 1 / 12 * dyv * 0.72
                },
                pa,
                {
                    x: pa.x + 1 / 12 * dxv * 0.72,
                    y: pa.y + 1 / 12 * dyv * 0.72
                },

                {
                    x: pb.x - 1 / 12 * dxv * 0.92,
                    y: pb.y - 1 / 12 * dyv * 0.92
                },
                pb,
                {
                    x: pb.x + 1 / 12 * dxv * 0.52,
                    y: pb.y + 1 / 12 * dyv * 0.52
                },
                {
                    x: pc.x - 2 / 12 * dxh * 0.40,
                    y: pc.y - 2 / 12 * dyh * 0.40
                },
                pc,
                {
                    x: pc.x + 2 / 12 * dxh * 0.40,
                    y: pc.y + 2 / 12 * dyh * 0.40
                },
                {
                    x: pd.x + 1 / 12 * dxv * 0.52,
                    y: pd.y + 1 / 12 * dyv * 0.52
                },
                pd,
                {
                    x: pd.x - 1 / 12 * dxv * 0.92,
                    y: pd.y - 1 / 12 * dyv * 0.92
                },
                {
                    x: pe.x + 1 / 12 * dxv * 0.72,
                    y: pe.y + 1 / 12 * dyv * 0.72
                },
                pe,
                {
                    x: pe.x - 1 / 12 * dxv * 0.72,
                    y: pe.y - 1 / 12 * dyv * 0.72
                },
                {
                    x: p1.x - 5 / 12 * dxh * 0.52,
                    y: p1.y - 5 / 12 * dyh * 0.52
                },
                p1];
            side.type = "z";

            function pointAt(coeffh, coeffv) {
                return {
                    x: p0.x + coeffh * dxh + coeffv * dxv,
                    y: p0.y + coeffh * dyh + coeffv * dyv
                }
            } // pointAt

        } // twist0
        //-----------------------------------------------------------------------------
        /* modifies a side
          changes it from a straight line (type "d") to a complex one (type "z")
          The change is done towards the opposite side (side between corners ca and cb)
        */
        function twist1(side, ca, cb) {

            const p0 = side.points[0];
            const p1 = side.points[1];
            const dxh = p1.x - p0.x;
            const dyh = p1.y - p0.y;

            const mid0 = lerp(p0, p1, 0.5);
            const mid1 = lerp(ca, cb, 0.5);

            const dxv = mid1.x - mid0.x;
            const dyv = mid1.y - mid0.y;

            const pa = pointAt(puzzle.prng.alea(0.3, 0.35), puzzle.prng.alea(-0.05, 0.05));
            const pb = pointAt(puzzle.prng.alea(0.45, 0.55), puzzle.prng.alea(0.2, 0.3));
            const pc = pointAt(puzzle.prng.alea(0.65, 0.78), puzzle.prng.alea(-0.05, 0.05));

            side.points = [p0,
                p0, pa, pa,
                pa, pb, pb,
                pb, pc, pc,
                pc, p1, p1];
            side.type = "z";

            function pointAt(coeffh, coeffv) {
                return {
                    x: p0.x + coeffh * dxh + coeffv * dxv,
                    y: p0.y + coeffh * dyh + coeffv * dyv
                }
            } // pointAt

        } // twist1
        //-----------------------------------------------------------------------------
        /* modifies a side
          changes it from a straight line (type "d") to a complex one (type "z")
          The change is done towards the opposite side (side between corners ca and cb)
        */
        function twist2(side, ca, cb) {

            const p0 = side.points[0];
            const p1 = side.points[1];
            const dxh = p1.x - p0.x;
            const dyh = p1.y - p0.y;

            const mid0 = lerp(p0, p1, 0.5);
            const mid1 = lerp(ca, cb, 0.5);

            const dxv = mid1.x - mid0.x;
            const dyv = mid1.y - mid0.y;

            const hmid = puzzle.prng.alea(0.45, 0.55);
            const vmid = puzzle.prng.alea(0.4, 0.5)
            const pc = pointAt(hmid, vmid);

            const pb = lerp(p0, pc, 2 / 3);
            const pd = lerp(p1, pc, 2 / 3);

            side.points = [p0, pb, pd, p1];
            side.type = "z";

            function pointAt(coeffh, coeffv) {
                return {
                    x: p0.x + coeffh * dxh + coeffv * dxv,
                    y: p0.y + coeffh * dyh + coeffv * dyv
                }
            } // pointAt

        } // twist2
        //-----------------------------------------------------------------------------
        /* modifies a side
          changes it from a straight line (type "d") to a complex one (type "z")
          The change is done towards the opposite side (side between corners ca and cb)
          This one does not change anything in fact
        */
        function twist3(side, ca, cb) {

            side.points = [side.points[0], side.points[1]];

        } // twist3
        //-----------------------------------------------------------------------------
        class Piece {
            constructor(kx, ky) { // object with 4 sides
                this.ts = new Side(); // top side
                this.rs = new Side(); // right side
                this.bs = new Side(); // bottom side
                this.ls = new Side(); // left side
                this.kx = kx;
                this.ky = ky;
            }

        } // class Piece
        //--------------------------------------------------------------
        //--------------------------------------------------------------
        class PolyPiece {

            // represents a group of pieces well positionned with respect  to each other.
            // pckxmin, pckxmax, pckymin and pckymax record the lowest and highest kx and ky
            constructor(initialPiece) {
                this.pieces = [initialPiece];
                this.selected = false;
                this.minx = initialPiece.minx;
                this.maxx = initialPiece.maxx;
                this.miny = initialPiece.miny;
                this.maxy = initialPiece.maxy;
                this.pCentre = { x: (this.minx + this.maxx) / 2, y: (this.miny + this.maxy) / 2 }
                this.listLoops();
                this.getSrcPath();
                this.getSrcIntPath();
                this.rot = 0; // PolyPiece is in "normal" position - 1 for 90 deg.cw, 2 and 3 for 180 and 270 deg
            } // PolyPiece.constructor

            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -   -
            /*
              this method
                - adds pieces of otherPoly to this PolyPiece
                - reorders the pieces inside the polypiece
                - adjusts coordinates of new pieces to make them consistent with this polyPiece
                - re-evaluates the z - index of the polyPieces
            */

            merge(otherPoly) {

                // remove otherPoly from list of polypieces
                const kOther = puzzle.polyPieces.indexOf(otherPoly);
                puzzle.polyPieces.splice(kOther, 1);

                for (let k = 0; k < otherPoly.pieces.length; ++k) {
                    otherPoly.pieces[k].poly = this;
                    this.pieces.push(otherPoly.pieces[k]);
                } // for k

                if (otherPoly.minx < this.minx) this.minx = otherPoly.minx;
                if (otherPoly.maxx > this.maxx) this.maxx = otherPoly.maxx;
                if (otherPoly.miny < this.miny) this.miny = otherPoly.miny;
                if (otherPoly.maxy > this.maxy) this.maxy = otherPoly.maxy;
                this.pCentre = { x: (this.minx + this.maxx) / 2, y: (this.miny + this.maxy) / 2 }

                this.listLoops();
                this.getSrcPath();
                this.getSrcIntPath();

                puzzle.evaluateOrder();

            } // merge

            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -   -
            ifNear(otherPoly) {

                if (this.rot != otherPoly.rot) return false; // different orientations, can't collapse!

                let p1, p2;

                if (mhypot(this.x - otherPoly.x, this.y - otherPoly.y) >= puzzle.dConnect) return false; // not close enough

                // this and otherPoly are in good relative position, have they a common side ?
                for (let k = this.pieces.length - 1; k >= 0; --k) {
                    p1 = this.pieces[k];
                    for (let ko = otherPoly.pieces.length - 1; ko >= 0; --ko) {
                        p2 = otherPoly.pieces[ko];
                        if (p1.kx == p2.kx && mabs(p1.ky - p2.ky) == 1) return true; // true neighbors found
                        if (p1.ky == p2.ky && mabs(p1.kx - p2.kx) == 1) return true; // true neighbors found
                    } // for k
                } // for k

                // nothing matches

                return false;

            } // ifNear

            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -

            /* algorithm to determine the boundary of a PolyPiece
              input : a table of cells, hopefully defining a 'good' PolyPiece, i.e. all connected together
              every cell is given as an object {kx: indice, ky: indice} representing an element of a 2D array.

              returned value : table of Loops, because the boundary may be made of several
            simple loops : there may be a 'hole' in a PolyPiece
            every loop is a list of consecutive edges,
            every edge if an object {kp: index, edge: b} where kp is the index of the cell in
            the input array, and edge the side (0(top), 1(right), 2(bottom), 3(left))
            every edge contains kx and ky too, normally not used here

            This method does not depend on the fact that pieces have been scaled or not.
            */

            listLoops() {

                // internal : checks if an edge given by kx, ky is common with another cell
                // returns true or false
                const that = this;
                function edgeIsCommon(kx, ky, edge) {
                    let k;
                    switch (edge) {
                        case 0: ky--; break; // top edge
                        case 1: kx++; break; // right edge
                        case 2: ky++; break; // bottom edge
                        case 3: kx--; break; // left edge
                    } // switch
                    for (k = 0; k < that.pieces.length; k++) {
                        if (kx == that.pieces[k].kx && ky == that.pieces[k].ky) return true; // we found the neighbor
                    }
                    return false; // not a common edge
                } // function edgeIsCommon

                // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
                // internal : checks if an edge given by kx, ky is in tbEdges
                // return index in tbEdges, or false

                function edgeIsInTbEdges(kx, ky, edge) {
                    let k;
                    for (k = 0; k < tbEdges.length; k++) {
                        if (kx == tbEdges[k].kx && ky == tbEdges[k].ky && edge == tbEdges[k].edge) return k; // found it
                    }
                    return false; // not found
                } // function edgeIsInTbEdges

                // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -

                let tbLoops = []; // for the result
                let tbEdges = []; // set of edges which are not shared by 2 pieces of input
                let k;
                let kEdge; // to count 4 edges
                let lp; // for loop during its creation
                let currEdge; // current edge
                let tries; // tries counter
                let edgeNumber; // number of edge found during research
                let potNext;

                // table of tries

                let tbTries = [
                    // if we are on edge 0 (top)
                    [
                        { dkx: 0, dky: 0, edge: 1 }, // try # 0
                        { dkx: 1, dky: 0, edge: 0 }, // try # 1
                        { dkx: 1, dky: -1, edge: 3 } // try # 2
                    ],
                    // if we are on edge 1 (right)
                    [
                        { dkx: 0, dky: 0, edge: 2 },
                        { dkx: 0, dky: 1, edge: 1 },
                        { dkx: 1, dky: 1, edge: 0 }
                    ],
                    // if we are on edge 2 (bottom)
                    [
                        { dkx: 0, dky: 0, edge: 3 },
                        { dkx: - 1, dky: 0, edge: 2 },
                        { dkx: - 1, dky: 1, edge: 1 }
                    ],
                    // if we are on edge 3 (left)
                    [
                        { dkx: 0, dky: 0, edge: 0 },
                        { dkx: 0, dky: - 1, edge: 3 },
                        { dkx: - 1, dky: - 1, edge: 2 }
                    ],
                ];

                // create list of not shared edges (=> belong to boundary)
                for (k = 0; k < this.pieces.length; k++) {
                    for (kEdge = 0; kEdge < 4; kEdge++) {
                        if (!edgeIsCommon(this.pieces[k].kx, this.pieces[k].ky, kEdge))
                            tbEdges.push({ kx: this.pieces[k].kx, ky: this.pieces[k].ky, edge: kEdge, kp: k })
                    } // for kEdge
                } // for k

                while (tbEdges.length > 0) {
                    lp = []; // new loop
                    currEdge = tbEdges[0];   // we begin with first available edge
                    lp.push(currEdge);       // add it to loop
                    tbEdges.splice(0, 1);    // remove from list of available sides
                    do {
                        for (tries = 0; tries < 3; tries++) {
                            potNext = tbTries[currEdge.edge][tries];
                            edgeNumber = edgeIsInTbEdges(currEdge.kx + potNext.dkx, currEdge.ky + potNext.dky, potNext.edge);
                            if (edgeNumber === false) continue; // can't here
                            // new element in loop
                            currEdge = tbEdges[edgeNumber];     // new current edge
                            lp.push(currEdge);              // add it to loop
                            tbEdges.splice(edgeNumber, 1);  // remove from list of available sides
                            break; // stop tries !
                        } // for tries
                        if (edgeNumber === false) break; // loop is closed
                    } while (1); // do-while exited by break
                    tbLoops.push(lp); // add this loop to loops list
                } // while tbEdges...

                // replace components of loops by actual pieces sides
                this.tbLoops = tbLoops.map(loop => loop.map(edge => {
                    let cell = this.pieces[edge.kp];
                    if (edge.edge == 0) return cell.ts;
                    if (edge.edge == 1) return cell.rs;
                    if (edge.edge == 2) return cell.bs;
                    return cell.ls;
                }));

            } // polyPiece.listLoops

            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
            getSrcPath() {
                // returns an array of paths defined on the source image
                this.srcPath = new Path2D();
                let pth;
                this.tbLoops.forEach(loop => {
                    pth = new Path2D();
                    loop.forEach((side, k) => {
                        side.drawSrcPath(pth, k == 0);
                    });
                    this.srcPath.addPath(pth);
                });
                return this.srcPath;
            } // getSrcPath
            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
            getSrcIntPath() {
                // returns a path made of all the internal edges
                this.srcIntPath = new Path2D();
                let edg = this.tbLoops.flat();
                this.pieces.forEach((pc, kk) => {
                    if (!edg.includes(pc.rs)) pc.rs.drawSrcPath(this.srcIntPath, true);
                    if (!edg.includes(pc.bs)) pc.bs.drawSrcPath(this.srcIntPath, true);
                });
                return this.srcIntPath;
            } // getSrcIntPath
            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
            setTransforms() {
                // set transform matrix for this polyPiece
                this.fromSrcMatrix = getTransformMatrix(0, 0, puzzle.scale, this.rot, this.x, this.y);
            } // setTransforms

            // -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -

            drawImage(special) {

                this.setTransforms(); // may be not the best place to do this.

                let pth = new Path2D();
                pth.addPath(this.srcPath, this.fromSrcMatrix);
                this.playPath = pth; //

                let pa = this.fromSrcMatrix.transformPoint({ x: this.minx, y: this.miny });
                let pb = this.fromSrcMatrix.transformPoint({ x: this.maxx, y: this.maxy });

                if (mmax(pa.x, pb.x) < 0 || mmax(pa.y, pb.y) < 0 || mmin(pa.x, pb.x) > puzzle.contWidth || mmin(pa.y, pb.y) > puzzle.contHeight) return; // not on screen
                let ctx = puzzle.playCtx;
                if (this.isMoving) {
                    ctx = puzzle.moveCtx;
                    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                }

                ctx.strokeStyle = "#000";

                // make shadow
                ctx.fillStyle = 'none';
                ctx.shadowColor = this.selected ? (special ? 'lime' : 'gold') : 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = this.selected ? mmin(8, puzzle.srcWidth / puzzle.nx * puzzle.scale / 10) : 4;
                ctx.shadowOffsetX = this.selected ? 0 : -4;
                ctx.shadowOffsetY = this.selected ? 0 : 4;
                ctx.fill(pth);
                if (this.selected) for (let k = 0; k < 6; ++k) ctx.fill(pth);
                ctx.shadowColor = 'rgba(0, 0, 0, 0)'; // stop shadow effect

                ctx.save();
                ctx.clip(pth);

                ctx.setTransform(this.fromSrcMatrix);
                ctx.drawImage(puzzle.srcImage, 0, 0);
                ctx.resetTransform();
                const dxemboss = puzzle.embossThickness / 2;
                const dyemboss = -puzzle.embossThickness / 2;

                if (puzzle.drawMode == 3) { // individual emboss on each piece
                    ctx.restore();
                    this.pieces.forEach(pc => {
                        let pthi = new Path2D();
                        pthi.addPath(pc.srcPath, this.fromSrcMatrix);
                        ctx.save();
                        ctx.clip(pthi);
                        drawEmboss(ctx, pthi);
                        ctx.restore();
                    });
                } else {
                    drawEmboss(ctx, pth); // global emboss on polypiece
                    if (puzzle.drawMode == "1") drawInternal(ctx, this);
                    ctx.restore();
                }


                function drawEmboss(ctx, path) {
                    ctx.lineWidth = puzzle.embossThickness * 1.5;
                    ctx.translate(dxemboss, dyemboss);
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
                    ctx.stroke(path);

                    ctx.translate(-2 * dxemboss, -2 * dyemboss);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                    ctx.stroke(path);
                } // drawEmboss

                function drawInternal(ctx, pp) {
                    let pth = new Path2D();
                    pth.addPath(pp.srcIntPath, pp.fromSrcMatrix);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = "#ffffff";
                    let sv = ctx.globalCompositeOperation;
                    ctx.globalCompositeOperation = 'difference';
                    ctx.stroke(pth);
                    ctx.globalCompositeOperation = 'sv';
                }

            } // drawImage

            moveTo(x, y) {
                this.x = x;
                this.y = y;
                this.setTransforms();
            } //

            rotate(angle) {
                let pCenterDisp = this.fromSrcMatrix.transformPoint(this.pCentre);
                /* angle = orientation : 0 to 3 by 90 deg steps clockwise  */
                this.rot = angle;
                const mtrx = getTransformMatrix(this.pCentre.x, this.pCentre.y, puzzle.scale, this.rot, pCenterDisp.x, pCenterDisp.y);
                // make a fake "moveTo" to compensate for the displacement of the origin of the polypiece
                this.x = mtrx.e;
                this.y = mtrx.f;
                this.setTransforms();

            }
            isPointInPath(p) {
                return (puzzle.playCtx.isPointInPath(this.playPath, p.x, p.y))

            } // isPointInPath
        } // class PolyPiece

        //-----------------------------------------------------------------------------
        class Puzzle {
            /*
                params contains :

            container : mandatory - given by id (string) or element
                        it will not be resized in this script

            ONLY ONE Puzzle object should be instanced.
                only "container is mandatory, nbPieces and pictures may be provided to get
                initial default values.
                When a puzzle is solved (and even if not solved) another game can be played
                by changing the image file or the number of pieces, NOT by invoking new Puzzle
            */

            constructor(params) {

                this.autoStart = false;

                this.container = (typeof params.container == "string") ?
                    document.getElementById(params.container) :
                    params.container;

                /* the following code will add the event Handlers several times if
                  new Puzzle objects are created with same container.
                  the presence of previous event listeners is NOT detectable
                */
                this.container.addEventListener("mousedown", event => {
                    useMouse = true;
                    event.preventDefault();
                    if (event.button != 0) return; //only left button involved
                    events.push({ event: 'touch', position: this.relativeMouseCoordinates(event) });
                });
                this.container.addEventListener("touchstart", event => {
                    useMouse = false;
                    event.preventDefault();
                    if (event.touches.length == 0) return;
                    const rTouch = [];
                    if (event.touches.length == 0) return;
                    for (let k = 0; k < event.touches.length; ++k) {
                        rTouch[k] = this.relativeMouseCoordinates(event.touches.item(k));
                    }
                    if (event.touches.length == 1)
                        events.push({ event: 'touch', position: rTouch[0] });
                    if (event.touches.length == 2) {
                        // will be used for zoom in/out
                        events.push({ event: 'touches', touches: rTouch });
                    }
                }, { passive: false });

                this.container.addEventListener("mouseup", event => {
                    useMouse = true;
                    event.preventDefault();
                    if (event.button != 0) return; // ignore if releasing right click
                    handleLeave();
                });
                this.container.addEventListener("touchend", handleLeave);
                this.container.addEventListener("touchleave", handleLeave);
                this.container.addEventListener("touchcancel", handleLeave);

                this.container.addEventListener("mousemove", event => {
                    useMouse = true;
                    event.preventDefault();
                    // do not accumulate move events in events queue - keep only current one
                    if (events.length && events[events.length - 1].event == "move") events.pop();
                    events.push({ event: 'move', position: this.relativeMouseCoordinates(event), ev: event })
                });
                this.container.addEventListener("touchmove", event => {
                    useMouse = false;
                    event.preventDefault();
                    const rTouch = [];
                    if (event.touches.length == 0) return;
                    for (let k = 0; k < event.touches.length; ++k) {
                        rTouch[k] = this.relativeMouseCoordinates(event.touches.item(k));
                    }
                    if (event.touches.length == 1) {
                        // do not accumulate move events in events queue - keep only current one
                        if (events.length && events[events.length - 1].event == "move") events.pop();
                        events.push({ event: 'move', position: rTouch[0] });
                    }
                    if (event.touches.length == 2) {
                        // do not accumulate move events in events queue - keep only current one
                        if (events.length && events[events.length - 1].event == "moves") events.pop();
                        events.push({ event: 'moves', touches: rTouch });
                    }

                }, { passive: false });

                this.container.addEventListener("wheel", event => {
                    useMouse = true;
                    event.preventDefault();
                    if (events.length && events.at(-1).event == "wheel") events.pop(); // avoid multiple consecutive wheel events
                    events.push({ event: "wheel", wheel: event });
                });
                const KDINSTALLED = "kdinstalledcct5874"; // to prevent double installation
                if (!(KDINSTALLED in document.body.dataset)) {
                    document.body.addEventListener("keydown", event => {
                        if (event.key != "+" && event.key != "-" || !event.ctrlKey) return; // not for us, ignore
                        // if zoom by keybord, imitate a mouse event
                        event.preventDefault();
                        if (events.length && events.at(-1).event == "wheel") events.pop(); // avoid multiple consecutive wheel events
                        events.push({ event: "wheel", wheel: { deltaY: (event.key == "+") ? 1 : -1 }, center: { x: puzzle.contWidth / 2, y: puzzle.contHeight / 2 } });
                    });
                    document.body.dataset[KDINSTALLED] = "1"; // value is not significant
                }
                this.srcImage = new Image();
                this.imageLoaded = false;
                this.srcImage.addEventListener("load", () => imageLoaded());

                function handleLeave() {
                    events.push({ event: 'leave' }); //
                }

            } // Puzzle

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            getContainerSize() {
                let styl = window.getComputedStyle(this.container);

                /* dimensions of container */
                this.contWidth = parseFloat(styl.width);
                this.contHeight = parseFloat(styl.height);
            }
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            showImage(state) {
                // enforces display (true) or hide (false)
                puzzle.showState = (state == undefined) ? !puzzle.showState : !!state;
                let showElem = puzzle.container.querySelector(".showimage");
                if (!showElem) {
                    showElem = document.createElement("div");
                    showElem.classList.add("showimage");
                    showElem.addEventListener("click", () => puzzle.showImage(false)); // close on first click
                    puzzle.container.append(showElem);
                }
                /* showElem is created only once. Its content is destroyed and re-created at every invocation */
                showElem.innerHTML = "";
                if (puzzle.showState) {
                    ui.close(); // menu no longer needed
                    showElem.style.display = "block";
                    let img = document.createElement("img");
                    showElem.append(img);
                    img.src = puzzle.srcImage.src;
                } else { // hide
                    showElem.style.display = "none";
                }
            }

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            // used to initialize new or restored game

            create(baseData) {

                this.prng = mMash(baseData ? baseData[3] : null); // pseudo-random number generator used to create the pieces
                this.container.innerHTML = ""; // forget contents

                this.playCanvas = document.createElement("canvas");
                this.container.append(this.playCanvas);
                this.playCtx = this.playCanvas.getContext("2d");
                this.playCanvas.style.position = "absolute";

                this.moveCanvas = document.createElement("canvas");
                this.container.append(this.moveCanvas);
                this.moveCtx = this.moveCanvas.getContext("2d");
                this.moveCanvas.style.position = "absolute";

                /* define the number of rows / columns to have almost square pieces
                  and a total number as close as possible to the requested number
                */
                this.getContainerSize();
                this.moveCanvas.width = this.playCanvas.width = this.contWidth;
                this.moveCanvas.height = this.playCanvas.height = this.contHeight;

                if (baseData) {
                    this.nx = baseData[0];
                    this.ny = baseData[1];
                    this.srcWidth = baseData[6];
                    this.srcHeight = baseData[7];
                    this.scale = baseData[2] / this.srcWidth;
                    this.rotationAllowed = !!baseData[4];
                    ui.enablerot.checked = this.rotationAllowed;
                } else {
                    this.computenxAndny();
                }

                if (baseData) {
                    this.typeOfShape = baseData[5];
                    ui.shape.value = Number(baseData[5]) + 1;
                } else {
                    this.typeOfShape = (document.getElementById("shape").value - 1);
                }

                this.defineShapes({ coeffDecentr: 0.12, twistf: [twist0, twist1, twist2, twist3][this.typeOfShape] });

                this.polyPieces = [];
                if (!baseData) { // build 1-piece polyPieces with random orientation if allowed, and stack in random order
                    this.pieces.forEach(row => row.forEach(piece => {
                        this.polyPieces.push(new PolyPiece(piece, this));
                    }));
                    arrayShuffle(this.polyPieces);
                    if (this.rotationAllowed) puzzle.polyPieces.forEach(pp => pp.rot = intAlea(4));
                } else {
                    // re-create Polypieces as described in baseData
                    const pps = baseData[8];
                    const offs = (this.rotationAllowed ? 3 : 2); // offset to reach kx of 1st piece
                    pps.forEach(ppData => {
                        let polyp = new PolyPiece(this.pieces[ppData[offs + 1]][ppData[offs]]);
                        polyp.x = ppData[0];
                        polyp.y = ppData[1];
                        polyp.rot = this.rotationAllowed ? ppData[2] : 0;
                        for (let k = offs + 2; k < ppData.length; k += 2) { // add other pieces to polypiece
                            let kx = ppData[k];
                            let ky = ppData[k + 1];
                            let pp = this.pieces[ky][kx];
                            if (pp.minx < polyp.minx) polyp.minx = pp.minx;
                            if (pp.maxx > polyp.maxx) polyp.maxx = pp.maxx;
                            if (pp.miny < polyp.miny) polyp.miny = pp.miny;
                            if (pp.maxy > polyp.maxy) polyp.maxy = pp.maxy;
                            polyp.pieces.push(pp);
                        }
                        polyp.pCentre = { x: (polyp.minx + polyp.maxx) / 2, y: (polyp.miny + polyp.maxy) / 2 }
                        polyp.listLoops();
                        polyp.getSrcPath();
                        polyp.getSrcIntPath();
                        this.polyPieces.push(polyp);
                    })
                }
                this.evaluateOrder();

            } // Puzzle.create

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            drawPolyPieces(butTop) {
                this.playCtx.clearRect(0, 0, this.playCanvas.width, this.playCanvas.height);
                let max = this.polyPieces.length - (butTop ? 1 : 0);
                for (let k = 0; k < max; ++k) this.polyPieces[k].drawImage();
            } // drawPolyPieces
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            /* computes the number of lines and columns of the puzzle,
              finding the best compromise between the requested number of pieces
              and a square shap for pieces
              result in this.nx and this.ny;
            */

            computenxAndny() {

                let kx, ky, width = this.srcImage.naturalWidth, height = this.srcImage.naturalHeight, npieces = this.nbPieces;
                let err, errmin = 1e9;
                let ncv, nch;

                let nHPieces = mround(msqrt(npieces * width / height));
                let nVPieces = mround(npieces / nHPieces);

                /* based on the above estimation, we will try up to + / - 2 values
                   and evaluate (arbitrary) quality criterion to keep best result
                */

                for (ky = -2; ky <= 2; ky++) {
                    ncv = nVPieces + ky;
                    if (ncv < 1) continue;
                    for (kx = -2; kx <= 2; kx++) {
                        nch = nHPieces + kx;
                        if (nch < 1) continue;
                        err = nch * height / ncv / width;
                        err = (err + 1 / err) - 2; // error on pieces dimensions ratio)
                        err += mabs(1 - nch * ncv / npieces); // adds error on number of pieces

                        if (err < errmin) { // keep smallest error
                            errmin = err;
                            this.nx = nch;
                            this.ny = ncv;
                        }
                    } // for kx
                } // for ky
            } // computenxAndny

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            defineShapes(shapeDesc) {
                // define shapes in srcImage

                /* first, place the corners of the pieces
                  at some distance from their theoretical position, except for edges
                */

                let { coeffDecentr, twistf } = shapeDesc;

                const corners = [];
                const nx = this.nx, ny = this.ny;
                let np;
                const dx = this.srcWidth / this.nx;
                const dy = this.srcHeight / this.ny;

                for (let ky = 0; ky <= ny; ++ky) {
                    corners[ky] = [];
                    for (let kx = 0; kx <= nx; ++kx) {
                        corners[ky][kx] = {
                            x: (kx + this.prng.alea(-coeffDecentr, coeffDecentr)) * dx,
                            y: (ky + this.prng.alea(-coeffDecentr, coeffDecentr)) * dy
                        };
                        if (kx == 0) corners[ky][kx].x = 0;
                        if (kx == nx) corners[ky][kx].x = this.srcWidth;
                        if (ky == 0) corners[ky][kx].y = 0;
                        if (ky == ny) corners[ky][kx].y = this.srcHeight;
                    } // for kx
                } // for ky

                // Array of pieces
                this.pieces = [];
                for (let ky = 0; ky < ny; ++ky) {
                    this.pieces[ky] = [];
                    for (let kx = 0; kx < nx; ++kx) {
                        this.pieces[ky][kx] = np = new Piece(kx, ky);
                        // top side
                        if (ky == 0) {
                            np.ts.points = [corners[ky][kx], corners[ky][kx + 1]];
                            np.ts.type = "d";
                        } else {
                            np.ts = this.pieces[ky - 1][kx].bs.reversed();
                        }
                        // right side
                        np.rs.points = [corners[ky][kx + 1], corners[ky + 1][kx + 1]];
                        np.rs.type = "d";
                        if (kx < nx - 1) {
                            if (this.prng.intAlea(2)) // randomly twisted on one side of the side
                                twistf(np.rs, corners[ky][kx], corners[ky + 1][kx]);
                            else
                                twistf(np.rs, corners[ky][kx + 2], corners[ky + 1][kx + 2]);
                        }
                        // left side
                        if (kx == 0) {
                            np.ls.points = [corners[ky + 1][kx], corners[ky][kx]];
                            np.ls.type = "d";
                        } else {
                            np.ls = this.pieces[ky][kx - 1].rs.reversed()
                        }
                        // bottom side
                        np.bs.points = [corners[ky + 1][kx + 1], corners[ky + 1][kx]];
                        np.bs.type = "d";
                        if (ky < ny - 1) {
                            if (this.prng.intAlea(2)) // randomly twisted on one side of the side
                                twistf(np.bs, corners[ky][kx + 1], corners[ky][kx]);
                            else
                                twistf(np.bs, corners[ky + 2][kx + 1], corners[ky + 2][kx]);
                        }
                        // make paths for sides
                        np.srcPath = new Path2D();
                        np.ts.drawSrcPath(np.srcPath, true);
                        np.rs.drawSrcPath(np.srcPath, false);
                        np.bs.drawSrcPath(np.srcPath, false);
                        np.ls.drawSrcPath(np.srcPath, false);
                        // calculate minx,miny,maxx,maxy rectangle in which piece is locating (approximative)
                        // this data will be used to increase speed by not drawing off-screen pieces
                        np.minx = (kx - 0.5) * dx;
                        np.maxx = (kx + 1.5) * dx;
                        np.miny = (ky - 0.5) * dy;
                        np.maxy = (ky + 1.5) * dy;

                    } // for kx
                } // for ky

            } // Puzzle.defineShapes

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            doScale() {

                let dRef = this.srcWidth / this.nx;
                /* computes the distance below which two pieces connect
                  depends on the actual size of pieces, with lower limit */
                this.dConnect = mmax(10, this.scale * dRef / 10);

                /* computes the thickness used for emboss effect */
                // from 2 (scalex = 0)  to 4 (scalex = 200), not more than 4
                this.embossThickness = mmin(2 + this.scale * dRef / 200 * (4 - 2), 4);
                this.polyPieces.forEach(pp => pp.setTransforms());
            }
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            sweepBy(dx, dy) {
                this.polyPieces.forEach(pp => {
                    pp.moveTo(pp.x + dx, pp.y + dy);
                })
                this.drawPolyPieces();
            } // Puzzle.sweepBy
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            zoomBy(coef, center) {

                // coef if a multiplier coefficient (1= no change, 0..1 = shrink, >1 = enlarge)
                // center is not moved by the zoom

                let futWidth = this.srcWidth * this.scale * coef;
                let futHeight = this.srcHeight * this.scale * coef;
                let nsize = msqrt(futWidth * futWidth / this.pieces.length) // roughly, size of a piece

                // limits
                if ((nsize > 1000 || futWidth > 10000 || futHeight > 10000) && (coef > 1) || (nsize < 10) && (coef < 1)) return;
                if (coef == 1) return; // nothing to do;

                this.scale *= coef;
                this.doScale();
                this.polyPieces.forEach(pp => {
                    // translate to new place
                    pp.moveTo(coef * (pp.x - center.x) + center.x, coef * (pp.y - center.y) + center.y);
                });
                this.drawPolyPieces();
            } // Puzzle.zoomBy
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            relativeMouseCoordinates(event) {

                /* takes mouse coordinates from mouse event
                  returns coordinates relative to container, even if page is scrolled or zoommed */

                const br = this.container.getBoundingClientRect();
                lastMousePos = {
                    x: event.clientX - br.x,
                    y: event.clientY - br.y
                };
                return lastMousePos;
            } // Puzzle.relativeMouseCoordinates

            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            spread() {
                // calculates how to spread pieces
                /* pieces are spreaded in a grid ngx * ngy cells, each of size = kSpread * this.distPoints
                 a rectangular space is reserved for the image, with a margin around it
                */

                let kSpread = 1.7; // center-to-center distance of spreaded pieces,
                let kMargin = 1; // empty space around piece
                let pWidth, pHeight; //
                pWidth = this.srcWidth / this.nx;
                pHeight = this.srcHeight / this.ny;
                if (this.rotationAllowed) pWidth = pHeight = mmax(pWidth, pHeight);
                const gStepX = kSpread * pWidth; // size of cells where pieces will be spread
                const gStepY = kSpread * pHeight; // size of cells where pieces will be spread
                const ngx = mceil((2 * kMargin * pWidth + this.srcWidth) / gStepX);
                let ngy = mceil((2 * kMargin * pHeight + this.srcHeight) / gStepY);
                let nTotCells = this.nx * this.ny + ngx * ngy;

                let nmaxx = mceil(nTotCells / ngy) + 2;
                let nmaxy = mceil(nTotCells / ngx) + 2;
                let bestk = { cellScale: 0 }
                let cellScale;
                for (let nbx = ngx; nbx < nmaxx; ++nbx) {
                    let nby = mmax(ngy, mceil(nTotCells / nbx));
                    cellScale = mmin(this.contWidth / nbx / gStepX, this.contHeight / nby / gStepY);
                    if (cellScale > bestk.cellScale) {
                        bestk.cellScale = cellScale;
                        bestk.nbx = nbx;
                        bestk.nby = nby;
                    }
                }
                for (let nby = ngy; nby < nmaxy; ++nby) {
                    let nbx = mmax(ngx, mceil(nTotCells / nby));
                    cellScale = mmin(this.contWidth / nbx / gStepX, this.contHeight / nby / gStepY);
                    if (cellScale > bestk.cellScale) {
                        bestk.cellScale = cellScale;
                        bestk.nbx = nbx;
                        bestk.nby = nby;
                    }
                }

                this.scale = bestk.cellScale;

                let col0 = mfloor((bestk.nbx - ngx) / 2);
                let col1 = col0 + ngx - 1;
                let row0 = mfloor((bestk.nby - ngy) / 2);
                let row1 = row0 + ngy - 1;

                let offsx = (this.contWidth - bestk.nbx * bestk.cellScale * gStepX) / 2;
                let offsy = (this.contHeight - bestk.nby * bestk.cellScale * gStepY) / 2;
                let idxpc = 0;
                loopSpr:
                for (let ky = 0; ky < bestk.nby; ++ky) {
                    for (let kx = 0; kx < bestk.nbx; ++kx) {
                        if (kx >= col0 && kx <= col1 && ky >= row0 && ky <= row1) continue; // place for image
                        let pp = this.polyPieces[idxpc++];
                        this.fromSrcMatrix = getTransformMatrix(pp.pCentre.x, pp.pCentre.y, this.scale, pp.rot, offsx + (kx + 0.5) * bestk.cellScale * gStepX, offsy + (ky + 0.5) * bestk.cellScale * gStepY);
                        pp.x = this.fromSrcMatrix.e;
                        pp.y = this.fromSrcMatrix.f;
                        if (idxpc >= this.nx * this.ny) break loopSpr;
                    } // for ky;
                } // for ky
            } // spread
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            evaluateOrder() {

                /* re-evaluates order of polypieces in puzzle after a merge
                  the polypieces must be in decreasing order of size(number of pieces),
                  preserving the previous order as much as possible
                */
                for (let k = this.polyPieces.length - 1; k > 0; --k) {
                    if (this.polyPieces[k].pieces.length > this.polyPieces[k - 1].pieces.length) {
                        // swap pieces if not in right order
                        [this.polyPieces[k], this.polyPieces[k - 1]] = [this.polyPieces[k - 1], this.polyPieces[k]];
                    }
                } // for k
            } // Puzzle.evaluateOrder
            //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            getStateData() {
                /* gathers all required data so that game can be saved and restored
                 the data included here only comprises the information for the position and the shape of the PolyPieces
                 The source of the picture is included too, as a link ("https://...") or a data URL
                To avoid the clutter of field names in JSON strings, all data saved here will be put in an array, and this array
                 will be included in the final object as a "base" field
                */
                let ppData;
                let saved = { signature: fileSignature };
                if ("origin" in this.srcImage.dataset) {
                    saved.origin = this.srcImage.dataset.origin;
                }
                saved.src = this.srcImage.src;
                let base = [this.nx, this.ny, this.scale * this.srcWidth, this.prng.seed, this.rotationAllowed ? 1 : 0, this.typeOfShape, this.srcWidth, this.srcHeight];       // our data
                saved.base = base;
                let pps = []; // array of data for polypieces
                base.push(pps);
                this.polyPieces.forEach(pp => {
                    ppData = [mround(pp.x), mround(pp.y)]; // position rounded to integer, shorter string, loss of accuracy is not significant for our purpose
                    if (this.rotationAllowed) ppData.push(pp.rot);
                    pp.pieces.forEach(p => ppData.push(p.kx, p.ky));
                    pps.push(ppData);
                })
                return saved;
            }   // getStateData

        } // class Puzzle
        //-----------------------------------------------------------------------------

        let loadFile;
        { // scope for loadFile

            let options;

            let elFile = document.createElement('input');
            elFile.setAttribute('type', 'file');
            elFile.style.display = 'none';
            elFile.addEventListener("change", getFile);

            function getFile() {
                let origin;
                if (this.files.length == 0) {
                    //      returnLoadFile ({fail: 'no file'});
                    return;
                }
                let reader = new FileReader();

                reader.addEventListener('load', () => {
                    puzzle.srcImage.src = reader.result;
                    puzzle.srcImage.dataset.origin = origin;
                    makeSaveFileName(origin);
                });
                reader.readAsDataURL(this.files[0]);
                origin = this.files[0].name;

            } // getFile

            loadFile = function () {
                elFile.setAttribute("accept", "image/*");
                elFile.value = null; // else, re-selecting the same file does not trigger "change"
                elFile.click();

            } // loadFile
        } //  // scope for loadFile

        let loadSaved;
        { // scope for loadSaved
            // almost a copy of "loadFile", adapted to load saved game instead of picture
            let options;
            let loading = false; // to help detection of cancel on

            let elFile = document.createElement('input');
            elFile.setAttribute('type', 'file');
            elFile.style.display = 'none';
            elFile.addEventListener("change", getFile);

            document.body.addEventListener("mousemove", () => {
                if (loading) {
                    loading = false;
                    events.push({ event: "cancel" });
                }
            });

            function getFile() {

                if (this.files.length == 0) {
                    events.push({ event: "cancel" });
                    return;
                }
                let reader = new FileReader();
                let fname = this.files[0].name;

                reader.addEventListener('load', () => {
                    puzzle.restoredString = reader.result;
                    loading = false;
                    events.push({ event: "restored" });
                    if (fname.endsWith(fileExtension)) {
                        fname = fname.substring(0, fname.length - fileExtension.length);
                    }
                    makeSaveFileName(fname);
                });
                reader.readAsText(this.files[0]);

            } // getFile

            loadSaved = function () {
                elFile.setAttribute("accept", `${fileExtension}`);
                elFile.value = null; // else, re-selecting the same file does not trigger "change"
                elFile.click();
                loading = true;

            } // loadSaved
        } //  // scope for loadSaved

        function loadInitialFile() {

            const selected =
                Math.max(
                    0,
                    Math.min(
                        GIFT17_IMAGES.length - 1,
                        Number(ui.gift17Picture?.value || 1) - 1
                    )
                );

            gift17PictureIndex = selected;

            const src = GIFT17_IMAGES[gift17PictureIndex];

            /*
             * Do not feed the puzzle a broken image URL.
             *
             * The 18 local pictures become the real Gift 17
             * library once they are copied into /images/.
             */
            fetch(src, {
                method: "HEAD",
                cache: "no-store"
            })
            .then(response => {

                if (!response.ok) {
                    throw new Error("Gift 17 picture not installed yet");
                }

                puzzle.srcImage.dataset.origin =
                    `gift17-${String(gift17PictureIndex + 1).padStart(2, "0")}`;

                ui.saveas.value =
                    `gift17-picture-${String(gift17PictureIndex + 1).padStart(2, "0")}`;

                puzzle.srcImage.onload = () => {

                    /*
                     * Let the ORIGINAL puzzle code continue its
                     * normal image-processing path.
                     */
                    puzzle.imageLoaded = true;

                    if (typeof puzzle.startImage === "function") {
                        puzzle.startImage();
                    }

                };

                puzzle.srcImage.src = src;

            })
            .catch(() => {

                /*
                 * No local image exists yet.
                 *
                 * Do not display the browser broken-image icon.
                 * Keep the existing original game image instead.
                 */
                console.info(
                    "[Gift 17] Picture " +
                    String(gift17PictureIndex + 1).padStart(2, "0") +
                    " is not installed yet."
                );

            });
        }
        function loadRemoteFile(fileURL) {
            puzzle.srcImage.src = fileURL;
            delete puzzle.srcImage.dataset.origin; // makes difference from locally loaded pictures
        }
        //-----------------------------------------------------------------------------
        function imageLoaded() {

            puzzle.imageLoaded = true;
            let event = { event: "srcImageLoaded" };
            if (puzzle.restoring) {
                delete puzzle.restoring
                /* check image natural size against expected one */
                if (mround(puzzle.srcImage.naturalWidth) != puzzle.restoredState.base[6] ||
                    mround(puzzle.srcImage.naturalHeight) != puzzle.restoredState.base[7]) {

                    popup(["Something went wrong.", "I could not restore the game. Sorry for the inconvenience."]);
                    event.event = "wrongImage";
                } // if wrong size
            } // if restoring
            events.push(event);
        } // imageLoaded

        //-----------------------------------------------------------------------------
        function fitImage(img, width, height) {
            /* The image is a child of puzzle.container. It will be styled to be as big as possible, not wider than width,
            not higher than height, centered in puzzle.container
            (width and height must be less than or equal to the container dimensions)
            */

            let wn = img.naturalWidth;
            let hn = img.naturalHeight;
            let w = width;
            let h = w * hn / wn;
            if (h > height) {
                h = height;
                w = h * wn / hn;
            }
            img.style.position = "absolute";
            img.style.width = w + "px";
            img.style.height = h + "px";
            img.style.top = "50%";
            img.style.left = "50%";
            img.style.transform = "translate(-50%,-50%)";
        }
        //-----------------------------------------------------------------------------
        let animate;
        let events = []; // queue for events

        { // scope for animate
            let state = 0;
            let moving = {}; // for information about moved piece
            let tmpImage;
            let tInit;
            let filesave;

            animate = function (tStamp) {

                requestAnimationFrame(animate);

                let event;
                if (events.length) event = events.shift(); // read event from queue
                if (event && event.event == "reset") state = 0;
                if ((event?.event == "timeout") && (state == 10 || state == 15) && !puzzle.imageLoaded) {
                    // create empty image to avoid blocking situation
                    puzzle.srcImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAJUlEQVR4AeyQMQ0AAAyDlmrDv6XNwYKAkvBxEWCNGUnDd5TecwAAAP//4lOPOQAAAAZJREFUAwBRdRIDdhSIewAAAABJRU5ErkJggg==";
                    state = 10;
                    popup(["Something went wrong loading this image.",
                        "You can still try to play with local images or saved games."
                    ])
                } // timeout event
                // resize event
                if (event?.event == "resize") {

                    // remember dimensions of container before resize
                    puzzle.prevWidth = puzzle.contWidth;
                    puzzle.prevHeight = puzzle.contHeight;
                    puzzle.getContainerSize();
                    if (state == 15 || state == 60) { // resize initial or final picture
                        puzzle.getContainerSize();
                        fitImage(tmpImage, puzzle.contWidth * 0.95, puzzle.contHeight * 0.95);
                    }
                    else if (state >= 25) { // resize pieces
                        puzzle.getContainerSize();
                        puzzle.moveCanvas.width = puzzle.playCanvas.width = puzzle.contWidth;
                        puzzle.moveCanvas.height = puzzle.playCanvas.height = puzzle.contHeight;
                        puzzle.drawPolyPieces();
                    }
                } // resize event


                switch (state) {
                    /* initialisation */
                    case 0:
                        state = 10;
                    /* wait for image loaded and other required parameters*/
                    case 10:
                        playing = false;
                        if (!puzzle.imageLoaded) return;

                        // display centered initial image
                        puzzle.container.innerHTML = ""; // forget contents
                        tmpImage = document.createElement("img");
                        tmpImage.addEventListener("load", () => {
                            puzzle.getContainerSize();
                            fitImage(tmpImage, puzzle.contWidth * 0.95, puzzle.contHeight * 0.95);
                            puzzle.container.appendChild(tmpImage);
                        });
                        tmpImage.src = puzzle.srcImage.src;
                        tmpImage.style.boxShadow = "-4px 4px 4px rgba(0, 0, 0, 0.5)";

                        state = 15;
                        break;

                    /* wait for start */
                    case 15:
                        if (!puzzle.imageLoaded) { state = 10; return; }
                        puzzle.srcWidth = mfloor(puzzle.srcImage.naturalWidth);
                        puzzle.srcHeight = mfloor(puzzle.srcImage.naturalHeight);
                        playing = false;
                        ui.waiting();
                        if (autoStart) event = { event: "nbpieces", nbpieces: 12 }; // auto start
                        autoStart = false; // not twice
                        if (!event) return;
                        if (event.event == "nbpieces") {
                            puzzle.nbPieces = event.nbpieces;
                            state = 20;
                        } else if (event.event == "srcImageLoaded") {
                            state = 10;
                            return;
                        } else if (event.event == "restore") {
                            filesave = event.file;
                            state = 150;
                            return;
                        }
                        else return;

                    case 20:
                        puzzle.drawMode = ui.drawmode.value;
                        ui.close();
                        ui.playing();
                        playing = true;
                        /* prepare puzzle */
                        puzzle.rotationAllowed = ui.enablerot.checked;
                        if (puzzle.restoredState) {
                            puzzle.create(puzzle.restoredState.base); // retrieve polypieces
                        } else {
                            puzzle.create(); // create shape of pieces, independent of size
                        }
                        if (puzzle.restoredState) {
                            puzzle.doScale();
                            puzzle.polyPieces.forEach(pp => pp.moveTo(pp.x, pp.y));
                            delete puzzle.restoredState;
                        } else {
                            puzzle.spread(); // initial "optimal" spread position
                            puzzle.doScale()
                        };
                        puzzle.drawPolyPieces();
                        state = 50;
                    //break;
                    /* wait for user grabbing a piece or other action */
                    case 50:
                        if (puzzle.drawMode != ui.drawmode.value) {
                            puzzle.drawMode = ui.drawmode.value;
                            puzzle.drawPolyPieces();
                        }
                        if (!event) return;
                        if (event.event == "stop") { state = 10; return; }
                        if (event.event == "nbpieces") {
                            puzzle.nbPieces = event.nbpieces;
                            state = 20;
                        } else if (event.event == "save") {
                            filesave = event.file; // record if storage or file save
                            state = 120;
                        } else if (event.event == "touch" && puzzle.container.querySelector(".showimage")?.style?.display != "block") {
                            moving = {
                                xMouseInit: event.position.x,
                                yMouseInit: event.position.y,
                                tInit: tStamp
                            }

                            /* evaluates if contact inside a PolyPiece, by decreasing z-index */
                            for (let k = puzzle.polyPieces.length - 1; k >= 0; --k) {
                                let pp = puzzle.polyPieces[k];

                                if (pp.isPointInPath(event.position)) {
                                    pp.selected = true;

                                    moving.pp = pp;
                                    moving.ppXInit = pp.x;
                                    moving.ppYInit = pp.y;
                                    // move selected piece to top of PolyPieces stack
                                    puzzle.polyPieces.splice(k, 1);
                                    puzzle.polyPieces.push(pp);
                                    pp.isMoving = true;
                                    puzzle.drawPolyPieces();
                                    state = 55;
                                    return;
                                }
                            } // for k
                            /* not inside a polypiece, assume this is the beginning of a sweeping or zooming action */
                            state = 100;
                        } else if (event.event == "touches" && puzzle.container.querySelector(".showimage").style.display != "block") {
                            // re-use same object as for moves to record useful information
                            moving = { touches: event.touches };
                            state = 110; // go zooming with double touch
                        } else if (event.event == "wheel") {
                            const center = event.center ? event.center : lastMousePos;
                            if (event.wheel.deltaY > 0) puzzle.zoomBy(1.3, center);
                            if (event.wheel.deltaY < 0) puzzle.zoomBy(1 / 1.3, center);
                        }
                        break;

                    case 55:  // moving piece
                        if (!event) return;
                        if (event.event == "stop") { state = 10; return; }
                        switch (event.event) {
                            case "moves": // switch to zoom command
                            case "touches":
                                moving.pp.selected = false;
                                moving.pp.drawImage();
                                moving = { touches: event.touches };
                                state = 110; // go zooming with double touch
                                break;

                            case "move":
                                if (event?.ev?.buttons === 0) {
                                    events.push({ event: "leave" }); // buttons released while mouse out of canvas
                                    break;
                                }
                                moving.pp.moveTo(event.position.x - moving.xMouseInit + moving.ppXInit,
                                    event.position.y - moving.yMouseInit + moving.ppYInit);
                                moving.pp.drawImage();
                                break;
                            case "leave":
                                if (puzzle.rotationAllowed && tStamp < moving.tInit + 250) { // short click/touch: rotate
                                    moving.pp.rotate((moving.pp.rot + 1) % 4);
                                }
                                // check if moved polypiece is close to a matching other polypiece
                                // check repeatedly since polypieces moved by merging may come close to other polypieces
                                let doneSomething;
                                moving.pp.selected = false;
                                moving.pp.isMoving = false;
                                puzzle.moveCtx.clearRect(0, 0, puzzle.moveCanvas.width, puzzle.moveCanvas.height);
                                let merged = false;
                                do {
                                    doneSomething = false;
                                    for (let k = puzzle.polyPieces.length - 1; k >= 0; --k) {
                                        let pp = puzzle.polyPieces[k];
                                        if (pp == moving.pp) continue; // don't match with myself
                                        if (moving.pp.ifNear(pp)) { // a match !
                                            merged = true;
                                            // compare polypieces sizes to move smallest one
                                            if (pp.pieces.length > moving.pp.pieces.length) {
                                                pp.merge(moving.pp);
                                                moving.pp = pp; // memorize piece to follow
                                            } else {
                                                moving.pp.merge(pp);
                                            }
                                            doneSomething = true;
                                            break;
                                        }
                                    } // for k

                                } while (doneSomething);
                                // not at its right place
                                puzzle.evaluateOrder();
                                if (merged) {
                                    moving.pp.isMoving = true;
                                    moving.pp.selected = true;
                                    moving.pp.drawImage(true);
                                    moving.tInit = tStamp + 500; // final t in fact
                                    state = 56;
                                    break;
                                }
                                puzzle.drawPolyPieces();
                                state = 50; // just go back waiting
                                if (puzzle.polyPieces.length == 1 && puzzle.polyPieces[0].rot == 0) state = 60; // won!
                        } // switch (event.event)

                        break;
                    case 56:
                        if (tStamp < moving.tInit) return; // merged piece enlighted
                        moving.pp.isMoving = false;
                        moving.pp.selected = false;
                        puzzle.moveCtx.clearRect(0, 0, puzzle.moveCanvas.width, puzzle.moveCanvas.height);
                        puzzle.drawPolyPieces();
                        if (puzzle.polyPieces.length == 1 && puzzle.polyPieces[0].rot == 0) state = 60; // won!
                        else state = 50;
                        break;

                    case 60: // winning
                        playing = false;
                        puzzle.container.innerHTML = "";
                        puzzle.getContainerSize();

                        fitImage(tmpImage, puzzle.contWidth * 0.95, puzzle.contHeight * 0.95);
                        let finalWidth = tmpImage.style.width;
                        let finalHeight = tmpImage.style.height;
                        // set tmpImage to cover the exactly the only polypiece left, size and and position

                        tmpImage.style.width = `${puzzle.srcWidth * puzzle.scale}px`;
                        tmpImage.style.height = `${puzzle.srcHeight * puzzle.scale}px`;;
                        tmpImage.style.left = `${(puzzle.polyPieces[0].x + puzzle.srcWidth * puzzle.scale / 2) / puzzle.contWidth * 100}%`;
                        tmpImage.style.top = `${(puzzle.polyPieces[0].y + puzzle.srcHeight * puzzle.scale / 2) / puzzle.contHeight * 100}%`;
                        tmpImage.style.boxShadow = "-4px 4px 4px rgba(0, 0, 0, 0.5)";
                        //              tmpImage.style.top=(puzzle.polyPieces[0].y + puzzle.scaley / 2) / puzzle.contHeight * 100 + 50 + "%" ;
                        //              tmpImage.style.left=(puzzle.polyPieces[0].x + puzzle.scalex / 2) / puzzle.contWidth * 100 + 50 + "%" ;

                        tmpImage.classList.add("moving");
                        setTimeout(() => {
                            tmpImage.style.top = tmpImage.style.left = "50%";
                            tmpImage.style.width = finalWidth;
                            tmpImage.style.height = finalHeight;
                        }
                            , 0);
                        puzzle.container.appendChild(tmpImage);
                        state = 15;
                        break;

                    case 100:
                        if (!event) return;
                        if (event.event == "move") { // sweeping
                            if (event?.ev?.buttons === 0) { // button released while mouse out of window
                                state = 50;
                                break;
                            }
                            puzzle.sweepBy(event.position.x - moving.xMouseInit, event.position.y - moving.yMouseInit);
                            moving.xMouseInit = event.position.x;
                            moving.yMouseInit = event.position.y;
                            return;
                        }
                        if (event.event == "leave") {
                            state = 50; /* go back waiting */
                            return;
                        }
                        if (event.event == "touches") {
                            // re-use same object as for moves to record useful information
                            moving = { touches: event.touches };
                            state = 110; // go zooming with double touch
                        }
                        break;

                    case 110:
                        if (!event) return;
                        if (event.event == "leave") {
                            state = 50; /* go back waiting */
                            return;
                        }
                        if (event.event == "moves") {
                            let center = {
                                x: (moving.touches[0].x + moving.touches[1].x) / 2,
                                y: (moving.touches[0].y + moving.touches[1].y) / 2
                            }
                            let dInit = mhypot(moving.touches[0].x - moving.touches[1].x, moving.touches[0].y - moving.touches[1].y);
                            let d = mhypot(event.touches[0].x - event.touches[1].x, event.touches[0].y - event.touches[1].y);
                            // (arbitrary) reference :  the zoom factor will be 2,71828 for a change in touches == dRef
                            let dRef = msqrt(puzzle.contWidth * puzzle.contHeight) / 5;
                            puzzle.zoomBy(Math.exp((d - dInit) / dRef), center);
                            moving.touches = event.touches;
                            return;
                        }
                        break;

                    case 120: // save state
                        let savedData = puzzle.getStateData();
                        let savedString = JSON.stringify(savedData);
                        if (filesave) {
                            /* retrieve file name from user interface */
                            let name = makeSaveFileName(ui.saveas.value);
                            saveFile(savedString, `${name}${fileExtension}`);
                            ui.fsave.classList.add("enhanced");
                            setTimeout(() => ui.fsave.classList.remove("enhanced"), 500);
                        } else {
                            try {
                                localStorage.setItem("savepuzzle", savedString);
                                ui.save.classList.add("enhanced");
                                setTimeout(() => ui.save.classList.remove("enhanced"), 500);
                            } catch (exception) {
                                popup(["Something went wrong trying to save the game.",
                                    "Consider saving the game in a file.",
                                    `JS says: ${exception.message}`]);
                            }
                        }
                        state = 50;
                        break;

                    case 150: // restore game
                        puzzle.restoredString = "";
                        if (filesave) {
                            //      frestore event - loadSaved(); already done in the event
                            state = 152;
                        } else {
                            try {
                                puzzle.restoredString = localStorage.getItem("savepuzzle");
                                if (puzzle.restoredString === null) puzzle.restoredString = "";
                            } catch (exception) {
                                puzzle.restoredString = "";
                            }
                            if (puzzle.restoredString.length == 0) {
                                state = 15; // silently ignore if something wrong
                                break;
                            }

                            state = 155;
                        }
                        break;

                    case 152:
                        if (!event) return;
                        if (event.event == "cancel") {
                            state = 15;
                            return;
                        } else if (event.event !== "restored") return; //ignore other events

                        state = 155;

                    case 155:
                        try {
                            puzzle.restoredState = JSON.parse(puzzle.restoredString);
                        } catch (error) {
                            popup(["Invalid JSON data."]);
                            delete puzzle.restoredState;
                            state = 10;
                            break;
                        }
                        if (!puzzle.restoredState.signature || puzzle.restoredState.signature != fileSignature || !puzzle.restoredState.src) {
                            popup(["Not a valid game file."])
                            delete puzzle.restoredState;
                            state = 10;
                            break;
                        }
                        /* could check here if data contains expected fields */

                        puzzle.restoring = true;
                        puzzle.imageLoaded = false;
                        puzzle.srcImage.src = puzzle.restoredState.src;
                        if (puzzle.restoredState.origin) puzzle.srcImage.dataset.origin = puzzle.restoredState.origin
                        else delete puzzle.srcImage.dataset.origin;
                        if (!filesave) makeSaveFileName(puzzle.restoredState.origin || puzzle.restoredState.src);
                        tInit = tStamp; // to check that file really reads
                        state = 158;

                    case 158:
                        if (event && event.event == "srcImageLoaded") {
                            state = 160;
                        }
                        else if (event && event.event == "wrongImage") {
                            state = 10;
                            break;
                        }
                        else if (tStamp > tInit + 5000) {
                            events.push({ event: "timeout" });
                            state = 10; // give up after 5s
                        }
                        break;
                    case 160:
                        tmpImage.src = puzzle.srcImage.src;
                        fitImage(tmpImage, puzzle.contWidth * 0.95, puzzle.contHeight * 0.95);
                        state = 20; // step 20 will use puzzle.restoredState.base to re-create saved game
                        break;

                    case 9999: break;
                } // switch(state)
            } // animate
        } // scope for animate
        //-----------------------------------------------------------------------------
        //-----------------------------------------------------------------------------

        prepareUI();

        window.addEventListener("resize", event => {
            // do not accumulate resize events in events queue - keep only current one
            if (events.length && events[events.length - 1].event == "resize") return;;
            events.push({ event: "resize" });
        });

        puzzle = new Puzzle({ container: "forPuzzle" });

        /*
         * Gift 17 image safety layer.
         * A missing local image must never leave a broken-image
         * icon covering the puzzle.
         */
        if (puzzle && puzzle.srcImage) {

            puzzle.srcImage.addEventListener(
                "error",
                () => {

                    puzzle.srcImage.removeAttribute("src");
                    puzzle.srcImage.style.display = "none";

                    console.info(
                        "[Gift 17] Missing local picture handled safely."
                    );

                },
                true
            );

        }


        /*
         * ============================================================
         * Gift 17 smooth mouse interaction layer
         *
         * Required gesture:
         *
         *   first click
         *        ↓
         *   second click within the double-click window
         *        ↓
         *   keep left button held
         *        ↓
         *   move mouse
         *        ↓
         *   release
         *
         * The original jigsaw matching/merging engine is retained.
         * This layer only makes mouse dragging deterministic and
         * prevents the original event queue from becoming a bottleneck.
         * ============================================================
         */

        (() => {

            const surface = puzzle.container;

            let candidate = null;
            let candidateTime = 0;

            let directDrag = null;
            let rafPending = false;
            let latestMouse = null;

            const DOUBLE_WINDOW = 420;

            function getPieceAt(position) {

                for (let k = puzzle.polyPieces.length - 1; k >= 0; --k) {

                    const pp = puzzle.polyPieces[k];

                    if (pp.isPointInPath(position)) {
                        return {
                            pp,
                            index: k
                        };
                    }
                }

                return null;
            }

            function pointFromMouse(event) {
                return puzzle.relativeMouseCoordinates(event);
            }

            function startDirectDrag(pp, position, event) {

                if (!pp) return;

                directDrag = {
                    pp,
                    xMouseInit: position.x,
                    yMouseInit: position.y,
                    ppXInit: pp.x,
                    ppYInit: pp.y,
                    startedAt: performance.now()
                };

                /*
                 * Bring the selected piece/poly-piece to the top.
                 */
                const idx = puzzle.polyPieces.indexOf(pp);

                if (idx >= 0) {
                    puzzle.polyPieces.splice(idx, 1);
                    puzzle.polyPieces.push(pp);
                }

                pp.selected = true;
                pp.isMoving = true;

                /*
                 * Remove the old copy from the normal canvas before
                 * drawing the moving copy above it.
                 */
                puzzle.moveCtx.clearRect(
                    0,
                    0,
                    puzzle.moveCanvas.width,
                    puzzle.moveCanvas.height
                );

                puzzle.drawPolyPieces(true);
                pp.drawImage();

                surface.style.cursor = "grabbing";

                if (event) event.preventDefault();
            }

            function renderDirectDrag() {

                rafPending = false;

                if (!directDrag || !latestMouse) return;

                const pp = directDrag.pp;

                pp.moveTo(
                    latestMouse.x -
                    directDrag.xMouseInit +
                    directDrag.ppXInit,

                    latestMouse.y -
                    directDrag.yMouseInit +
                    directDrag.ppYInit
                );

                /*
                 * Draw only the moving poly-piece.
                 * This avoids redrawing 500/1000 pieces on every
                 * mousemove and makes dragging much smoother.
                 */
                pp.drawImage();
            }

            function requestDragRender() {

                if (rafPending) return;

                rafPending = true;
                requestAnimationFrame(renderDirectDrag);
            }

            function finishDirectDrag() {

                if (!directDrag) return;

                const moving = directDrag;
                directDrag = null;

                const ppMoving = moving.pp;

                ppMoving.selected = false;
                ppMoving.isMoving = false;

                puzzle.moveCtx.clearRect(
                    0,
                    0,
                    puzzle.moveCanvas.width,
                    puzzle.moveCanvas.height
                );

                let merged = false;
                let doneSomething;

                /*
                 * Use the exact original game's merge rules.
                 */
                do {

                    doneSomething = false;

                    for (
                        let k = puzzle.polyPieces.length - 1;
                        k >= 0;
                        --k
                    ) {

                        const other = puzzle.polyPieces[k];

                        if (other === moving.pp) continue;

                        if (moving.pp.ifNear(other)) {

                            merged = true;

                            if (
                                other.pieces.length >
                                moving.pp.pieces.length
                            ) {

                                other.merge(moving.pp);
                                moving.pp = other;

                            } else {

                                moving.pp.merge(other);

                            }

                            doneSomething = true;
                            break;
                        }
                    }

                } while (doneSomething);

                puzzle.evaluateOrder();

                if (merged) {

                    moving.pp.isMoving = true;
                    moving.pp.selected = true;
                    moving.pp.drawImage(true);

                    setTimeout(() => {

                        if (!moving.pp) return;

                        moving.pp.isMoving = false;
                        moving.pp.selected = false;

                        puzzle.moveCtx.clearRect(
                            0,
                            0,
                            puzzle.moveCanvas.width,
                            puzzle.moveCanvas.height
                        );

                        puzzle.drawPolyPieces();

                    }, 500);

                } else {

                    puzzle.drawPolyPieces();
                }

                if (
                    puzzle.polyPieces.length === 1 &&
                    puzzle.polyPieces[0].rot === 0
                ) {

                    events.push({ event: "leave" });
                }

                surface.style.cursor = "default";
            }

            /*
             * Capture mouse down before the original mouse handler.
             *
             * A piece now requires the requested double-click gesture.
             */
            surface.addEventListener(
                "mousedown",
                event => {

                    if (event.button !== 0) return;

                    /*
                     * Do not interfere with controls or dialogs.
                     */
                    if (
                        event.target !== surface &&
                        !surface.contains(event.target)
                    ) return;

                    const position = pointFromMouse(event);
                    const hit = getPieceAt(position);

                    if (!hit) {

                        candidate = null;
                        return;
                    }

                    const now = performance.now();

                    const samePiece =
                        candidate &&
                        candidate.pp === hit.pp &&
                        now - candidateTime <= DOUBLE_WINDOW;

                    if (!samePiece) {

                        /*
                         * First click:
                         * arm this exact piece.
                         *
                         * Stop the original handler from immediately
                         * starting its own drag.
                         */
                        candidate = hit;
                        candidateTime = now;

                        event.preventDefault();
                        event.stopImmediatePropagation();

                        surface.style.cursor = "pointer";

                        return;
                    }

                    /*
                     * Second click:
                     * start direct dragging immediately.
                     */
                    candidate = null;

                    event.preventDefault();
                    event.stopImmediatePropagation();

                    startDirectDrag(hit.pp, position, event);

                },
                true
            );

            /*
             * Direct mouse movement.
             *
             * We keep only the latest coordinate and render through
             * requestAnimationFrame.
             */
            window.addEventListener(
                "mousemove",
                event => {

                    if (!directDrag) return;

                    event.preventDefault();

                    latestMouse = pointFromMouse(event);

                    requestDragRender();

                },
                { passive: false, capture: true }
            );

            /*
             * Release can happen outside the puzzle.
             */
            window.addEventListener(
                "mouseup",
                event => {

                    if (!directDrag) return;

                    if (event.button !== 0) return;

                    event.preventDefault();

                    finishDirectDrag();

                },
                true
            );

            /*
             * Escape safely cancels the visual dragging state.
             * The piece stays at its current position.
             */
            window.addEventListener("keydown", event => {

                if (event.key !== "Escape") return;
                if (!directDrag) return;

                directDrag.pp.selected = false;
                directDrag.pp.isMoving = false;

                directDrag = null;

                puzzle.moveCtx.clearRect(
                    0,
                    0,
                    puzzle.moveCanvas.width,
                    puzzle.moveCanvas.height
                );

                puzzle.drawPolyPieces();

                surface.style.cursor = "default";
            });

        })();


        autoStart = isMiniature(); // used for nice miniature in CodePen
        requestAnimationFrame(animate);
        loadInitialFile();