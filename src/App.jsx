import { useEffect, useRef, useState } from 'react';
import './App.css';

import { motion, scale } from 'motion/react';

const imageModules = import.meta.glob('./assets/images/*.{png,jpg,jpeg,svg}', { eager: true });
const variantImages = Object.values(imageModules).map((module) => module.default);

function randint(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function genRandomColor() {
    const red = randint(0, 255);
    const blue = randint(0, 255);
    const green = randint(0, 255);
    return green | blue << 8 | red << 16
}

function getChannels(bytes) {
    return [(bytes >> 16) & 255, (bytes >> 8) & 255, bytes & 255]
}

class WallpaperGenerator {
    constructor(variant, layers, layerGap, bgColor, primaryColor, targetColor, canvasRef) {
        this.variant = variant;
        this.layers = layers;
        this.layerGap = layerGap;
        this.color = 0n;
        this.bgColor = bgColor;
        this.canvasRef = canvasRef;
        this.setColors(primaryColor, targetColor);
        this.setNewPattern();
        this.draw();
    }

    setNewPattern() {
        if ([0, 1, 2, 5].includes(this.variant)) {
            this.setPeaks();
        }
    }

    generateLayerPeaks(layer) {
        let coords = [];
        const peaksCount = randint(1, 5);
        if (this.variant === 0 || this.variant === 1) {
            coords.push([0, randint(this.layerGap * layer, (this.layerGap * layer) + this.layerGap)])
        } else if (this.variant === 2) {
            coords.push([0, randint(this.layerGap * layer, this.layerGap * (this.layers + 1))])
        } else if (this.variant === 5) {
            coords.push([0, this.layerGap * (layer + 1)]);
        }
        for (let i = 0; i < peaksCount; i++) {
            if (this.variant === 0 || this.variant === 1) {
                coords.push([randint(coords[coords.length - 1][0], 1920 - peaksCount + i), randint(this.layerGap * layer, this.layerGap * (layer + 1))]);
            } else if (this.variant === 2) {
                coords.push([randint(coords[coords.length - 1][0], 1920 - peaksCount + i), randint(coords[coords.length - 1][1], this.layerGap * (layer + 1))]);
            } else if (this.variant === 5) {
                coords.push([randint(coords[coords.length - 1][0], 1920 - peaksCount + i), i / peaksCount < 0.5 ? randint(this.layerGap * layer, (this.layerGap * layer) + coords[coords.length - 1][1]) : randint(coords[coords.length - 1][1], this.layerGap * (layer + 1))])
            }
        }
        if (this.variant === 0 || this.variant === 1) {
            coords.push([1920, randint(this.layerGap * layer, this.layerGap * (layer + 1))])
        } else if (this.variant === 2) {
            coords.push([1920, randint(coords[coords.length - 1][1], this.layerGap * (layer + 1))]);
        } else if (this.variant === 5) {
            coords.push([1920, this.layerGap * (layer + 1)])
        }
        return coords
    }

    setPeaks() {
        let peaks = []
        for (let i = 0; i < this.layers; i++) {
            peaks.push(this.generateLayerPeaks(i))
        }
        this.peaks = peaks;
    }

    setColors(primaryColor, targetColor) {
        const target = parseInt(targetColor.replace('#', ''), 16);
        const primary = parseInt(primaryColor.replace('#', ''), 16)
        const targetR = (target >> 16) & 255
        const targetG = (target >> 8) & 255
        const targetB = target & 255
        const mr = (targetR - ((primary >> 16) & 255)) / (this.layers - 1);
        const mg = (targetG - ((primary >> 8) & 255)) / (this.layers - 1);
        const mb = (targetB - (primary & 255)) / (this.layers - 1);
        for (let i = 0; i < this.layers; i++) {
            this.color |= BigInt(((Math.floor(mr * i) + ((primary >> 16) & 255)) << 16) | ((Math.floor(mg * i) + ((primary >> 8) & 255)) << 8) | (Math.floor(mb * i) + (primary & 255))) << BigInt(24 * i)
        }
    }

    setNewData(variant, layers, layerGap, bgColor, primaryColor, targetColor) {
        this.variant = variant;
        this.layers = layers;
        this.layerGap = layerGap;
        this.color = 0n;
        this.bgColor = bgColor;
        this.setColors(primaryColor, targetColor);
    }

    getLayerColor(layer) {
        return (this.color >> BigInt(24 * layer)) & BigInt((2 ** 24) - 1);
    }

    draw() {
        const ctx = this.canvasRef.current.getContext("2d");
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, 1920, 1200)
        if (this.variant === 4) {
            for (let i = 0; i < this.layers; i++) {
                let layerColor = `#${this.getLayerColor(i).toString(16).padStart(6, "0")}`
                ctx.fillStyle = layerColor;
                ctx.fillRect(0, 1200 - (this.layers - i) * this.layerGap, 1920, (this.layers - i) * this.layerGap);
            }
        } else if (this.variant === 3) {
            for (let i = 0; i < this.layers; i++) {
                let layerColor = `#${this.getLayerColor(i).toString(16).padStart(6, "0")}`
                ctx.fillStyle = layerColor;
                ctx.beginPath();
                ctx.arc(960, 1200, (this.layers - i) * this.layerGap, Math.PI, 2 * Math.PI);
                ctx.fill()
            }
        } else if ([0, 1, 2, 5].includes(this.variant)) {
            for (let i = this.layers - 1; i >= 0; i--) {
                let layerPeaks = this.peaks[i];
                if (!layerPeaks || layerPeaks.length === 0) continue;

                ctx.beginPath();

                ctx.moveTo(layerPeaks[0][0], 1200 - layerPeaks[0][1]);
                if (this.variant === 0) {
                    for (let j = 1; j < layerPeaks.length - 1; j++) {
                        const currentPeakX = layerPeaks[j][0];
                        const currentPeakY = 1200 - layerPeaks[j][1];

                        const nextPeakX = layerPeaks[j + 1][0];
                        const nextPeakY = 1200 - layerPeaks[j + 1][1];

                        const midX = (currentPeakX + nextPeakX) / 2;
                        const midY = (currentPeakY + nextPeakY) / 2;

                        ctx.quadraticCurveTo(currentPeakX, currentPeakY, midX, midY);
                    }

                    const lastIdx = layerPeaks.length - 1;
                    ctx.lineTo(layerPeaks[lastIdx][0], 1200 - layerPeaks[lastIdx][1]);

                } else {
                    for (let j = 1; j < layerPeaks.length; j++) {
                        ctx.lineTo(layerPeaks[j][0], 1200 - layerPeaks[j][1]);
                    }
                }

                ctx.lineTo(1920, 1200);
                ctx.lineTo(0, 1200);
                ctx.closePath();

                let layerColor = `#${this.getLayerColor(i).toString(16).padStart(6, "0")}`;
                ctx.fillStyle = layerColor;
                ctx.fill();
            }
        }
    }
}



function ThemeButton() {
    const [theme, setTheme] = useState(1);
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 1) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme])

    return <motion.button className='themeButton' whileTap={{ scale: 0.9 }} initial={{ x: 100, scale: 0, opacity: 0 }} animate={{ x: 0, opacity: 1, scale: 1 }} onClick={() => {
        setTheme(theme === 0 ? 1 : 0);
    }}>
        {
            theme ? <motion.svg key={1} initial={{ x: -10, opacity: 0, scale: 0 }} animate={{ x: 0, opacity: 1, scale: 1 }} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M560-80q-82 0-155-31.5t-127.5-86Q223-252 191.5-325T160-480.5q0-82.5 31.5-155t86-127Q332-817 405-848.5T560-880q54 0 105 14t95 40q-91 53-145.5 143.5T560-480q0 112 54.5 202.5T760-134q-44 26-95 40T560-80Zm0-80h21q10 0 19-2-57-66-88.5-147.5T480-480q0-89 31.5-170.5T600-798q-9-2-19-2h-21q-133 0-226.5 93.5T240-480q0 133 93.5 226.5T560-160Zm-80-320Z" /></motion.svg> : <motion.svg key={0} initial={{ x: 10, opacity: 0, scale: 0 }} animate={{ x: 0, opacity: 1, scale: 1 }} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M565-395q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm-226.5 56.5Q280-397 280-480t58.5-141.5Q397-680 480-680t141.5 58.5Q680-563 680-480t-58.5 141.5Q563-280 480-280t-141.5-58.5ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Zm326-268Z" /></motion.svg>
        }
    </motion.button>
}


function App() {
    const width = 1920;
    const height = 1200;
    const [layers, setLayers] = useState(6);
    const [layerGap, setLayerGap] = useState(50);
    const [layersMax, setLayersMax] = useState(600);
    const [layerGapMax, setLayerGapMax] = useState(1200 / layers);
    const [bgColor, setBgColor] = useState("#0A0A0A");
    const [primaryColor, setPrimaryColor] = useState(`#${genRandomColor().toString(16).padStart(6, "0")}`);
    const [targetColor, setTargetColor] = useState('#FFFFFF')
    const [variant, setVariant] = useState(0);
    const canvasRef = useRef(null);
    const myGenerator = useRef(null);
    const [copiedState, setCopiedState] = useState(0)
    useEffect(() => {
        myGenerator.current = new WallpaperGenerator(variant, layers, layerGap, bgColor, primaryColor, targetColor, canvasRef);
    }, [])

    useEffect(() => {
        myGenerator.current.setNewData(variant, layers, layerGap, bgColor, primaryColor, targetColor);
        myGenerator.current.draw();
    }, [bgColor, primaryColor, targetColor]);

    useEffect(() => {
        myGenerator.current.setNewData(variant, layers, layerGap, bgColor, primaryColor, targetColor);
        myGenerator.current.setNewPattern();
        myGenerator.current.draw()
    }, [variant, layers, layerGap])

    function generateNew() {
        setPrimaryColor(`#${genRandomColor().toString(16).padStart(6, '0')}`);
        setTargetColor('#FFFFFF')
        setBgColor('#0A0A0A');
        myGenerator.current.setNewPattern();
    }

    function shareWebsite() {
        const shareText = "Hi, check out this awesome custom wallpaper generator!\nhttps://anshhh-btw.github.io/wall-gen/";
        if (!copiedState) {
            navigator.clipboard.writeText(shareText)
                .then(() => {
                    setCopiedState(1);
                    setTimeout(() => {
                        setCopiedState(0);
                    }, 2000)
                })
                .catch((err) => {
                    console.error("Could not copy text: ", err);
                });
        }
    }

    return (
        <>
            <nav>
                <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                    <p>WALL - GEN</p>
                    <p>GENERATE UNIQUE CUSTOMIZABLE WALLPAPERS</p>
                </motion.div>
                <div>
                    <ThemeButton />
                </div>
            </nav>
            <main>
                <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <div>
                        <canvas width={width} height={height} ref={canvasRef}></canvas>
                    </div>
                </motion.div>
                <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <div>
                        <p>VARIANTS</p>
                        <div>
                            <div onClick={() => { setVariant(0) }} className={variant === 0 ? "activeVariant" : ""} title="Smooth Irregularities"><img src={variantImages[0]} alt="Smooth Irregularities" /></div>
                            <div onClick={() => { setVariant(1) }} className={variant === 1 ? "activeVariant" : ""} title="Irregular Surfaces"><img src={variantImages[1]} alt="Irregular Surfaces" /></div>
                            <div onClick={() => { setVariant(2) }} className={variant === 2 ? "activeVariant" : ""} title="One sided inclined Surfaces"><img src={variantImages[2]} alt="One sided inclined Surfaces" /></div>
                            <div onClick={() => { setVariant(3) }} className={variant === 3 ? "activeVariant" : ""} title="Circles"><img src={variantImages[3]} alt="Circles" /></div>
                            <div onClick={() => { setVariant(4) }} className={variant === 4 ? "activeVariant" : ""} title="Plain Beds"><img src={variantImages[4]} alt="Plain Beds" /></div>
                            <div onClick={() => { setVariant(5) }} className={variant === 5 ? "activeVariant" : ""} title="Mountains"><img src={variantImages[5]} alt="Mountains" /></div>
                        </div>
                        <div>
                            <div>
                                <p>LAYERS: {layers}</p>
                                <input type='range' title='Layers' min={2} max={layersMax} value={layers} onChange={(e) => {
                                    setLayers(parseInt(e.currentTarget.value));
                                    setLayerGapMax(Math.floor(1200 / parseInt(e.currentTarget.value)));
                                    setLayerGap(Math.floor(1200 / parseInt(e.currentTarget.value)));
                                }}></input>
                            </div>
                            <div>
                                <p>LAYER GAP: {layerGap}px</p>
                                <input type='range' title='Layer Gap' min={1} max={layerGapMax} value={layerGap} onChange={(e) => {
                                    setLayerGap(parseInt(e.currentTarget.value));
                                }}></input>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p>PALETTE</p>
                        <div>
                            <div><p>BACKGROUND</p><input type='color' value={bgColor} onChange={(e) => { setBgColor(e.currentTarget.value) }}></input></div>
                            <div><p>PRIMARY</p><input type='color' value={primaryColor} onChange={(e) => { setPrimaryColor(e.currentTarget.value) }}></input></div>
                            <div><p>TARGET</p><input type='color' value={targetColor} onChange={(e) => { setTargetColor(e.currentTarget.value) }}></input></div>
                        </div>
                    </div>
                    <div>
                        <button onClick={generateNew}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M682.5-277.5Q700-295 700-320t-17.5-42.5Q665-380 640-380t-42.5 17.5Q580-345 580-320t17.5 42.5Q615-260 640-260t42.5-17.5Zm-160-160Q540-455 540-480t-17.5-42.5Q505-540 480-540t-42.5 17.5Q420-505 420-480t17.5 42.5Q455-420 480-420t42.5-17.5Zm-160-160Q380-615 380-640t-17.5-42.5Q345-700 320-700t-42.5 17.5Q260-665 260-640t17.5 42.5Q295-580 320-580t42.5-17.5ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" /></svg><p>GENERATE NEW</p></button>
                    </div>

                    <div>
                        <button onClick={() => {
                            if (!canvasRef.current) return;
                            canvasRef.current.toBlob((blob) => {
                                if (!blob) return;

                                const url = URL.createObjectURL(blob);

                                const link = document.createElement("a");
                                link.download = `wallpaper-${variant}-${layers}.png`;
                                link.href = url;

                                document.body.appendChild(link);
                                link.click();

                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            }, "image/png");
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" /></svg><p>DOWNLOAD</p>
                        </button>
                        <p>1920 x 1200 px</p>
                    </div>

                    <div>
                        <button onClick={shareWebsite}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M680-80q-50 0-85-35t-35-85q0-6 3-28L282-392q-16 15-37 23.5t-45 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 8.5t37 23.5l281-164q-2-7-2.5-13.5T560-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-24 0-45-8.5T598-672L317-508q2 7 2.5 13.5t.5 14.5q0 8-.5 14.5T317-452l281 164q16-15 37-23.5t45-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T720-200q0-17-11.5-28.5T680-240q-17 0-28.5 11.5T640-200q0 17 11.5 28.5T680-160ZM200-440q17 0 28.5-11.5T240-480q0-17-11.5-28.5T200-520q-17 0-28.5 11.5T160-480q0 17 11.5 28.5T200-440Zm508.5-291.5Q720-743 720-760t-11.5-28.5Q697-800 680-800t-28.5 11.5Q640-777 640-760t11.5 28.5Q663-720 680-720t28.5-11.5ZM680-200ZM200-480Zm480-280Z" /></svg>
                            <p>{copiedState ? "COPIED!" : "SHARE"}</p>
                        </button>
                    </div>
                </motion.div>
            </main>
            <motion.footer initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <hr></hr>
                <p>CREATED BY <a href='https://www.instagram.com/anshhh.btw'>@anshhh-btw</a></p>
            </motion.footer>
        </>)
}

export default App;