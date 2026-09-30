"use strict";
        // last update: 2026/05/01
        let puzzle, autoStart;
        let playing;
        let useMouse = true;
        let lastMousePos;
        let ui; // user interface (menu)
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
                "help", "helpstorage", "helpfile", "saveas", "saveext", "drawmode", "show"].forEach(ctrlName => ui[ctrlName] = document.getElementById(ctrlName));

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
            puzzle.imageLoaded = false;
            puzzle.srcImage.src = "data:image/jpeg;base64,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"
            puzzle.srcImage.dataset.origin = "default";
            ui.saveas.value = "default";

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
        autoStart = isMiniature(); // used for nice miniature in CodePen
        requestAnimationFrame(animate);
        loadInitialFile();


/* ============================================================
   GIFT 17 — DEEP REPAIR BRIDGE
   ============================================================ */

(function () {
    "use strict";

    const IMAGE_MAP = [
        null,
        "./images/01.jpg",
        "./images/02.jpg",
        "./images/03.jpg",
        "./images/04.jpg",
        "./images/05.jpg",
        "./images/06.jpg",
        "./images/07.jpg",
        "./images/08.jpg",
        "./images/09.jpg",
        "./images/10.jpg",
        "./images/11.jpg",
        "./images/12.jpg",
        "./images/13.jpg",
        "./images/14.jpg",
        "./images/15.jpg",
        "./images/16.jpg",
        "./images/17.jpg",
        "./images/18.jpg"
    ];

    let selectedPicture = 1;
    let selectedURL = IMAGE_MAP[1];

    function $(id) {
        return document.getElementById(id);
    }

    function status(message, good) {
        const el = $("gift17ImageStatus");
        if (!el) return;

        el.textContent = message;
        el.dataset.state = good ? "ready" : "error";
    }

    function getEngineImage() {
        /*
         * The original engine uses puzzle.srcImage.
         * Do not replace that object.
         */
        if (typeof puzzle !== "undefined" &&
            puzzle &&
            puzzle.srcImage) {
            return puzzle.srcImage;
        }

        return null;
    }

    function loadIntoOriginalEngine(url, number) {

        const image = getEngineImage();

        if (!image) {
            status("Puzzle engine is still loading...", false);
            console.error("[Gift17] puzzle.srcImage unavailable");
            return false;
        }

        selectedURL = url;
        selectedPicture = number;

        /*
         * IMPORTANT:
         * We use the ORIGINAL Image object.
         * We do not create a replacement puzzle image.
         */

        try {
            image.onload = image.onload;
        } catch (_) {}

        image.removeAttribute("src");
        image.src = url + "?v=" + Date.now();

        status("Loading Picture " +
               String(number).padStart(2, "0") +
               "...", true);

        return true;
    }

    function verifyImage(url, number) {

        return new Promise(function(resolve) {

            const probe = new Image();

            probe.onload = function () {

                const preview = $("gift17Preview");

                if (preview) {
                    preview.src = url + "?preview=" + Date.now();
                    preview.style.display = "block";
                }

                status(
                    "Picture " +
                    String(number).padStart(2, "0") +
                    " loaded",
                    true
                );

                resolve(true);
            };

            probe.onerror = function () {

                status(
                    "Picture " +
                    String(number).padStart(2, "0") +
                    " failed to load",
                    false
                );

                console.error(
                    "[Gift17] Image failed:",
                    url
                );

                resolve(false);
            };

            probe.src = url + "?probe=" + Date.now();
        });
    }

    async function selectPicture(number) {

        number = Number(number);

        if (!Number.isInteger(number) ||
            number < 1 ||
            number > 18) {
            number = 1;
        }

        const url = IMAGE_MAP[number];

        if (!url) return;

        selectedPicture = number;

        status(
            "Checking Picture " +
            String(number).padStart(2, "0") +
            "...",
            true
        );

        const valid = await verifyImage(url, number);

        if (!valid) return;

        /*
         * Pass the validated image into the ORIGINAL engine.
         */
        loadIntoOriginalEngine(url, number);

        /*
         * Some versions of the modified project expose a
         * loadInitialFile() function. Use it only if necessary.
         */
        try {
            if (typeof loadInitialFile === "function") {
                /*
                 * Do NOT call it automatically.
                 * It may overwrite the selected image.
                 */
            }
        } catch (_) {}
    }

    function showSelectedImage() {

        const preview = $("gift17Preview");

        if (!preview) return;

        preview.style.display = "block";
        preview.src = selectedURL + "?show=" + Date.now();

        preview.onload = function () {
            status(
                "Showing Picture " +
                String(selectedPicture).padStart(2, "0"),
                true
            );
        };

        preview.onerror = function () {
            status("Selected picture could not be displayed", false);
        };
    }

    function forceOriginalStart() {

        /*
         * DO NOT replace the original state machine.
         *
         * Just make sure the original event queue receives
         * the same event the original Start Game button uses.
         */

        try {

            if (typeof events !== "undefined" &&
                Array.isArray(events) &&
                typeof ui !== "undefined" &&
                ui &&
                ui.nbpieces) {

                events.push({
                    event: "nbpieces",
                    nbpieces: Number(ui.nbpieces.value)
                });

                console.log(
                    "[Gift17] Original nbpieces event pushed."
                );

                return true;
            }

        } catch (e) {
            console.error(
                "[Gift17] Start bridge error:",
                e
            );
        }

        return false;
    }

    function install() {

        const selector = $("gift17PictureSelect");

        if (selector) {

            selector.addEventListener(
                "change",
                function () {
                    selectPicture(this.value);
                }
            );

            /*
             * Start with Picture 01.
             */
            selector.value = "1";
        }

        const show = $("gift17ForceShow");

        if (show) {
            show.addEventListener(
                "click",
                showSelectedImage
            );
        }

        /*
         * Find the ORIGINAL Start Game button.
         * We don't remove it.
         */
        const candidates =
            Array.from(
                document.querySelectorAll("button")
            );

        const start = candidates.find(function (button) {

            const text =
                (button.textContent || "")
                .trim()
                .toLowerCase();

            return (
                text === "start game" ||
                text.includes("start game")
            );

        });

        if (start) {

            /*
             * Capture the click only to make sure an image
             * is loaded first. Then allow the original handler
             * to execute.
             */
            start.addEventListener(
                "click",
                function () {

                    const image = getEngineImage();

                    if (!image) {
                        console.error(
                            "[Gift17] No original puzzle image."
                        );
                        return;
                    }

                    if (!image.complete ||
                        image.naturalWidth === 0) {

                        console.warn(
                            "[Gift17] Image not loaded yet."
                        );

                        loadIntoOriginalEngine(
                            selectedURL,
                            selectedPicture
                        );
                    }

                },
                true
            );
        }

        /*
         * Make the selected image available to debugging.
         */
        window.GIFT17_SELECTED_PICTURE =
            function () {
                return {
                    number: selectedPicture,
                    url: selectedURL
                };
            };

        window.GIFT17_FORCE_START =
            forceOriginalStart;

        window.GIFT17_LOAD =
            selectPicture;

        /*
         * Give the original engine enough time to construct
         * puzzle.srcImage before loading Picture 01.
         */
        setTimeout(function () {
            selectPicture(1);
        }, 700);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            install
        );
    } else {
        install();
    }

})();
